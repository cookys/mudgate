/**
 * Encrypted profile secrets vault (WebCrypto AES-256-GCM + PBKDF2).
 * Spec: docs/plans/2026-07-22-profile-secrets-vault.md
 */

export const VAULT_KEY = "assmud.vault.v1";
export const VAULT_META_KEY = "assmud.vault.meta.v1";
export const LEGACY_SECRETS_KEY = "assmud.profileSecrets";

export const VAULT_DEFAULT_ITER = 600_000;
export const VAULT_MAX_ITER = 2_000_000;
export const VAULT_MIN_ITER = 100_000;
const MAX_ENVELOPE_CHARS = 512 * 1024;
const MAX_CT_BYTES = 384 * 1024;
const MAX_PLAIN_BYTES = 256 * 1024;

export type VaultSecretEntry = {
  account?: string;
  password?: string;
  autoLogin?: boolean;
};

export type VaultPayload = {
  profiles: Record<string, VaultSecretEntry>;
  migration?: {
    from: string;
    at: number;
    entries: Record<string, VaultSecretEntry>;
  };
};

type Envelope = {
  v: 1;
  gen: number;
  rev: number;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt_b64: string;
  iv_b64: string;
  ct_b64: string;
};

type Meta = { gen: number };

type VaultSnap =
  | { kind: "absent"; metaGen: number }
  | {
      kind: "present";
      metaGen: number;
      gen: number;
      rev: number;
      raw: string;
    };

export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | "locked"
      | "exists"
      | "missing"
      | "auth"
      | "corrupt"
      | "conflict"
      | "persist"
      | "legacy"
      | "size"
      | "iter",
  ) {
    super(message);
    this.name = "VaultError";
  }
}

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new VaultError("WebCrypto subtle unavailable", "corrupt");
  }
  return c.subtle;
}

function randomBytes(n: number): Uint8Array {
  const u = new Uint8Array(n);
  globalThis.crypto.getRandomValues(u);
  return u;
}

function b64encode(u: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(u).toString("base64");
  }
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(s, "base64"));
  }
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function storageGet(key: string): string | null {
  if (typeof localStorage === "undefined") return memoryKV.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, val: string): void {
  if (typeof localStorage === "undefined") {
    memoryKV.set(key, val);
    return;
  }
  localStorage.setItem(key, val);
}

function storageDel(key: string): void {
  if (typeof localStorage === "undefined") {
    memoryKV.delete(key);
    return;
  }
  localStorage.removeItem(key);
}

/** Node/test memory backend when no localStorage */
const memoryKV = new Map<string, string>();

/** Test helper */
export function vaultTestResetStorage(): void {
  memoryKV.clear();
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(VAULT_META_KEY);
    localStorage.removeItem(LEGACY_SECRETS_KEY);
  }
  session = null;
}

function readMeta(): Meta {
  const raw = storageGet(VAULT_META_KEY);
  if (!raw) return { gen: 0 };
  try {
    const j = JSON.parse(raw) as Meta;
    const gen = Number(j.gen);
    return { gen: Number.isFinite(gen) && gen >= 0 ? Math.floor(gen) : 0 };
  } catch {
    return { gen: 0 };
  }
}

function writeMeta(m: Meta): void {
  storageSet(VAULT_META_KEY, JSON.stringify({ gen: m.gen }));
}

function readSnap(): VaultSnap {
  const metaGen = readMeta().gen;
  const raw = storageGet(VAULT_KEY);
  if (raw == null) return { kind: "absent", metaGen };
  if (raw.length > MAX_ENVELOPE_CHARS) {
    throw new VaultError("envelope too large", "size");
  }
  try {
    const env = JSON.parse(raw) as Envelope;
    if (env.v !== 1 || env.kdf !== "PBKDF2-SHA256") {
      throw new VaultError("bad envelope version", "corrupt");
    }
    return {
      kind: "present",
      metaGen,
      gen: Number(env.gen) || 0,
      rev: Number(env.rev) || 0,
      raw,
    };
  } catch (e) {
    if (e instanceof VaultError) throw e;
    throw new VaultError("corrupt envelope", "corrupt");
  }
}

function snapEqual(a: VaultSnap, b: VaultSnap): boolean {
  if (a.kind !== b.kind) return false;
  if (a.metaGen !== b.metaGen) return false;
  if (a.kind === "absent") return true;
  if (b.kind !== "present") return false;
  return a.gen === b.gen && a.rev === b.rev && a.raw === b.raw;
}

function parseEnvelope(raw: string): Envelope {
  if (raw.length > MAX_ENVELOPE_CHARS) {
    throw new VaultError("envelope too large", "size");
  }
  let env: Envelope;
  try {
    env = JSON.parse(raw) as Envelope;
  } catch {
    throw new VaultError("corrupt envelope json", "corrupt");
  }
  if (env.v !== 1 || env.kdf !== "PBKDF2-SHA256") {
    throw new VaultError("unsupported envelope", "corrupt");
  }
  const iter = Number(env.iter);
  if (!Number.isInteger(iter) || iter < VAULT_MIN_ITER || iter > VAULT_MAX_ITER) {
    throw new VaultError("iter out of range", "iter");
  }
  if (!env.salt_b64 || !env.iv_b64 || !env.ct_b64) {
    throw new VaultError("missing crypto fields", "corrupt");
  }
  return env;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iter: number,
): Promise<CryptoKey> {
  if (iter < VAULT_MIN_ITER || iter > VAULT_MAX_ITER) {
    throw new VaultError("iter out of range", "iter");
  }
  const subtle = getSubtle();
  const base = await subtle.importKey(
    "raw",
    utf8(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: iter,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPayload(
  key: CryptoKey,
  payload: VaultPayload,
  gen: number,
  rev: number,
  salt: Uint8Array,
  iter: number,
): Promise<string> {
  const plain = utf8(JSON.stringify(payload));
  if (plain.length > MAX_PLAIN_BYTES) {
    throw new VaultError("payload too large", "size");
  }
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await getSubtle().encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      plain as BufferSource,
    ),
  );
  if (ct.length > MAX_CT_BYTES) {
    throw new VaultError("ciphertext too large", "size");
  }
  const env: Envelope = {
    v: 1,
    gen,
    rev,
    kdf: "PBKDF2-SHA256",
    iter,
    salt_b64: b64encode(salt),
    iv_b64: b64encode(iv),
    ct_b64: b64encode(ct),
  };
  return JSON.stringify(env);
}

async function decryptEnvelope(
  password: string,
  raw: string,
): Promise<{ key: CryptoKey; payload: VaultPayload; env: Envelope }> {
  const env = parseEnvelope(raw);
  const salt = b64decode(env.salt_b64);
  const iv = b64decode(env.iv_b64);
  const ct = b64decode(env.ct_b64);
  if (ct.length > MAX_CT_BYTES) {
    throw new VaultError("ciphertext too large", "size");
  }
  const key = await deriveKey(password, salt, env.iter);
  let plain: ArrayBuffer;
  try {
    plain = await getSubtle().decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
  } catch {
    throw new VaultError("wrong password or corrupt vault", "auth");
  }
  if (plain.byteLength > MAX_PLAIN_BYTES) {
    throw new VaultError("plaintext too large", "size");
  }
  let payload: VaultPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plain)) as VaultPayload;
  } catch {
    throw new VaultError("bad payload json", "corrupt");
  }
  if (!payload.profiles || typeof payload.profiles !== "object") {
    payload = { profiles: {} };
  }
  return { key, payload, env };
}

type Session = {
  key: CryptoKey;
  payload: VaultPayload;
  gen: number;
  rev: number;
  raw: string;
  salt: Uint8Array;
  iter: number;
};

let session: Session | null = null;

export function vaultExists(): boolean {
  return storageGet(VAULT_KEY) != null;
}

export function hasLegacyPlaintextSecrets(): boolean {
  return storageGet(LEGACY_SECRETS_KEY) != null;
}

export function isVaultUnlocked(): boolean {
  return session != null;
}

export function lockVault(): void {
  session = null;
}

async function withVaultLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (
    globalThis as unknown as {
      navigator?: { locks?: { request: Function } };
    }
  ).navigator?.locks;
  if (locks?.request) {
    return locks.request("assmud.vault", { mode: "exclusive" }, () => fn());
  }
  return fn();
}

export async function createVault(masterPassword: string): Promise<void> {
  if (!masterPassword || masterPassword.length < 4) {
    throw new VaultError("master password too short", "auth");
  }
  await withVaultLock(async () => {
    const before = readSnap();
    if (before.kind === "present") {
      throw new VaultError("vault already exists", "exists");
    }
    // Envelope must still be absent
    if (storageGet(VAULT_KEY) != null) {
      throw new VaultError("vault conflict", "conflict");
    }
    const metaGen = before.metaGen + 1;
    const salt = randomBytes(16);
    const iter = VAULT_DEFAULT_ITER;
    const key = await deriveKey(masterPassword, salt, iter);
    const payload: VaultPayload = { profiles: {} };
    const raw = await encryptPayload(key, payload, metaGen, 1, salt, iter);
    if (storageGet(VAULT_KEY) != null) {
      throw new VaultError("vault conflict", "conflict");
    }
    writeMeta({ gen: metaGen });
    storageSet(VAULT_KEY, raw);
    const after = readSnap();
    if (after.kind !== "present" || after.raw !== raw || after.gen !== metaGen) {
      throw new VaultError("persist failed", "persist");
    }
    session = {
      key,
      payload,
      gen: metaGen,
      rev: 1,
      raw,
      salt,
      iter,
    };
  });
}

export async function unlockVault(masterPassword: string): Promise<void> {
  const raw = storageGet(VAULT_KEY);
  if (!raw) throw new VaultError("no vault", "missing");
  const { key, payload, env } = await decryptEnvelope(masterPassword, raw);
  const salt = b64decode(env.salt_b64);
  session = {
    key,
    payload: structuredClonePayload(payload),
    gen: env.gen,
    rev: env.rev,
    raw,
    salt,
    iter: env.iter,
  };
}

function structuredClonePayload(p: VaultPayload): VaultPayload {
  return JSON.parse(JSON.stringify(p)) as VaultPayload;
}

function requireSession(): Session {
  if (!session) throw new VaultError("vault locked", "locked");
  return session;
}

async function persistSession(s: Session): Promise<void> {
  await withVaultLock(async () => {
    const before = readSnap();
    if (before.kind !== "present") {
      throw new VaultError("vault missing", "missing");
    }
    if (before.gen !== s.gen || before.rev !== s.rev || before.raw !== s.raw) {
      throw new VaultError("vault conflict", "conflict");
    }
    const nextRev = s.rev + 1;
    const raw = await encryptPayload(
      s.key,
      s.payload,
      s.gen,
      nextRev,
      s.salt,
      s.iter,
    );
    const still = readSnap();
    if (!snapEqual(before, still)) {
      throw new VaultError("vault conflict", "conflict");
    }
    storageSet(VAULT_KEY, raw);
    const after = readSnap();
    if (after.kind !== "present" || after.raw !== raw) {
      throw new VaultError("persist failed", "persist");
    }
    s.rev = nextRev;
    s.raw = raw;
  });
}

export function getVaultSecret(profileId: string): VaultSecretEntry | undefined {
  const s = requireSession();
  const e = s.payload.profiles[profileId];
  return e ? { ...e } : undefined;
}

export async function setVaultSecret(
  profileId: string,
  entry: VaultSecretEntry | null,
): Promise<void> {
  const s = requireSession();
  if (entry == null) {
    delete s.payload.profiles[profileId];
  } else {
    const clean: VaultSecretEntry = {};
    if (entry.account?.trim()) clean.account = entry.account.trim();
    if (entry.password) clean.password = entry.password;
    if (entry.autoLogin) clean.autoLogin = true;
    if (!clean.account && !clean.password && !clean.autoLogin) {
      delete s.payload.profiles[profileId];
    } else {
      s.payload.profiles[profileId] = clean;
    }
  }
  await persistSession(s);
}

export async function clearVault(): Promise<void> {
  await withVaultLock(async () => {
    const before = readSnap();
    const metaGen = before.metaGen + 1;
    writeMeta({ gen: metaGen });
    storageDel(VAULT_KEY);
    session = null;
  });
}

function deepEqualEntry(
  a: VaultSecretEntry | undefined,
  b: VaultSecretEntry | undefined,
): boolean {
  return (
    (a?.account ?? "") === (b?.account ?? "") &&
    (a?.password ?? "") === (b?.password ?? "") &&
    Boolean(a?.autoLogin) === Boolean(b?.autoLogin)
  );
}

function keySetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((k, i) => k === sb[i]);
}

/** Load legacy plaintext secrets shape */
export function readLegacyPlaintext(): Record<string, VaultSecretEntry> {
  const raw = storageGet(LEGACY_SECRETS_KEY);
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as Record<string, VaultSecretEntry>;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

/**
 * Migrate legacy plaintext into vault (must be unlocked or will create).
 * Atomic: only deletes legacy after full receipt verify.
 */
export async function migrateLegacyIntoVault(
  masterPassword: string,
): Promise<{ imported: number }> {
  const legacy = readLegacyPlaintext();
  const legacyKeys = Object.keys(legacy);
  if (legacyKeys.length === 0) {
    return { imported: 0 };
  }

  if (!vaultExists()) {
    await createVault(masterPassword);
  } else if (!isVaultUnlocked()) {
    await unlockVault(masterPassword);
  }

  const s = requireSession();
  const entries: Record<string, VaultSecretEntry> = {};
  for (const id of legacyKeys) {
    if (s.payload.profiles[id]) continue; // skip existing
    const e = legacy[id]!;
    const clean: VaultSecretEntry = {};
    if (e.account?.trim()) clean.account = e.account.trim();
    if (e.password) clean.password = e.password;
    if (e.autoLogin) clean.autoLogin = true;
    if (clean.account || clean.password || clean.autoLogin) {
      s.payload.profiles[id] = clean;
      entries[id] = { ...clean };
    }
  }
  s.payload.migration = {
    from: LEGACY_SECRETS_KEY,
    at: Date.now(),
    entries,
  };
  await persistSession(s);

  // verify receipt
  if (!canDeleteLegacy(s.payload, legacy)) {
    throw new VaultError("migration verify failed", "legacy");
  }
  storageDel(LEGACY_SECRETS_KEY);
  delete s.payload.migration;
  await persistSession(s);
  return { imported: Object.keys(entries).length };
}

function canDeleteLegacy(
  payload: VaultPayload,
  currentLegacy: Record<string, VaultSecretEntry>,
): boolean {
  const receipt = payload.migration?.entries;
  if (!receipt || Object.keys(receipt).length === 0) return false;
  const rKeys = Object.keys(receipt);
  const lKeys = Object.keys(currentLegacy);
  if (!keySetEqual(rKeys, lKeys)) return false;
  for (const id of rKeys) {
    if (!deepEqualEntry(payload.profiles[id], receipt[id])) return false;
    if (!deepEqualEntry(currentLegacy[id], receipt[id])) return false;
  }
  return true;
}

/** On boot: if both vault + legacy, finish-delete when safe */
export async function tryFinishLegacyDelete(
  masterPassword?: string,
): Promise<boolean> {
  if (!hasLegacyPlaintextSecrets() || !vaultExists()) return false;
  if (!isVaultUnlocked()) {
    if (!masterPassword) return false;
    await unlockVault(masterPassword);
  }
  const s = requireSession();
  const legacy = readLegacyPlaintext();
  if (!s.payload.migration?.entries) return false;
  if (!canDeleteLegacy(s.payload, legacy)) return false;
  storageDel(LEGACY_SECRETS_KEY);
  delete s.payload.migration;
  await persistSession(s);
  return true;
}

export function discardLegacyPlaintext(): void {
  storageDel(LEGACY_SECRETS_KEY);
}
