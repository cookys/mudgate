/**
 * Encrypted profile secrets vault (AES-256-GCM + PBKDF2-SHA-256).
 * Spec: docs/plans/2026-07-22-profile-secrets-vault.md
 * Remember-unlock: docs/plans/2026-07-22-vault-remember-unlock.md
 *
 * Backend:
 * - Prefer WebCrypto `crypto.subtle` (HTTPS / localhost secure context)
 * - Fallback `@noble/*` when subtle is missing (e.g. http://192.168.x.x LAN)
 * - Optional remember-unlock: non-extractable CryptoKey in IndexedDB (never raw key in storage)
 */

export const VAULT_KEY = "assmud.vault.v1";
export const VAULT_META_KEY = "assmud.vault.meta.v1";
export const LEGACY_SECRETS_KEY = "assmud.profileSecrets";
export const REMEMBER_UNLOCK_KEY = "assmud.vault.rememberUnlock";
export const RESTORE_ALLOWED_KEY = "assmud.vault.restoreAllowed";

const IDB_NAME = "assmud-vault-keys";
const IDB_VERSION = 1;
const IDB_STORE = "keys";
const IDB_DEFAULT_ID = "default";
const IDB_PROBE_ID = "__probe__";
const VAULT_LOCK_NAME = "assmud-vault-lifecycle";

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

export type LockResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

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
      | "iter"
      | "capability"
      | "superseded",
  ) {
    super(message);
    this.name = "VaultError";
  }
}

/** True when browser WebCrypto SubtleCrypto is usable (secure context). */
export function hasWebCryptoSubtle(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

function randomBytes(n: number): Uint8Array {
  const u = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(u);
    return u;
  }
  throw new VaultError("no CSPRNG", "capability");
}

function mintOpToken(id: number): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${crypto.randomUUID()}:${id}`;
  }
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    throw new VaultError("no CSPRNG", "capability");
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex}:${id}`;
}

/** Raw 32-byte AES key via PBKDF2-SHA-256 (noble — works without subtle). */
async function deriveKeyBytes(
  password: string,
  salt: Uint8Array,
  iter: number,
): Promise<Uint8Array> {
  if (iter < VAULT_MIN_ITER || iter > VAULT_MAX_ITER) {
    throw new VaultError("iter out of range", "iter");
  }
  if (hasWebCryptoSubtle()) {
    const subtle = globalThis.crypto.subtle;
    const base = await subtle.importKey(
      "raw",
      utf8(password) as BufferSource,
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: iter,
        hash: "SHA-256",
      },
      base,
      256,
    );
    return new Uint8Array(bits);
  }
  const { pbkdf2 } = await import("@noble/hashes/pbkdf2.js");
  const { sha256 } = await import("@noble/hashes/sha2.js");
  return pbkdf2(sha256, password, salt, { c: iter, dkLen: 32 });
}

async function importAesCryptoKey(
  keyBytes: Uint8Array,
): Promise<CryptoKey> {
  if (!hasWebCryptoSubtle()) {
    throw new VaultError("no subtle", "capability");
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function validateCryptoKey(key: CryptoKey): boolean {
  if (key.type !== "secret") return false;
  if (key.extractable !== false) return false;
  const usages = new Set(key.usages);
  return usages.has("encrypt") && usages.has("decrypt");
}

async function aesGcmEncryptBytes(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  plain: Uint8Array,
): Promise<Uint8Array> {
  if (hasWebCryptoSubtle()) {
    const subtle = globalThis.crypto.subtle;
    const key = await subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    return new Uint8Array(
      await subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        plain as BufferSource,
      ),
    );
  }
  const { gcm } = await import("@noble/ciphers/aes.js");
  return gcm(keyBytes, iv).encrypt(plain);
}

async function aesGcmDecryptBytes(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ct: Uint8Array,
): Promise<Uint8Array> {
  if (hasWebCryptoSubtle()) {
    const subtle = globalThis.crypto.subtle;
    const key = await subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    try {
      return new Uint8Array(
        await subtle.decrypt(
          { name: "AES-GCM", iv: iv as BufferSource },
          key,
          ct as BufferSource,
        ),
      );
    } catch {
      throw new VaultError("wrong password or corrupt vault", "auth");
    }
  }
  try {
    const { gcm } = await import("@noble/ciphers/aes.js");
    return gcm(keyBytes, iv).decrypt(ct);
  } catch {
    throw new VaultError("wrong password or corrupt vault", "auth");
  }
}

async function aesGcmEncryptKey(
  cryptoKey: CryptoKey,
  iv: Uint8Array,
  plain: Uint8Array,
): Promise<Uint8Array> {
  return new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      plain as BufferSource,
    ),
  );
}

async function aesGcmDecryptKey(
  cryptoKey: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array,
): Promise<Uint8Array> {
  try {
    return new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        cryptoKey,
        ct as BufferSource,
      ),
    );
  } catch {
    throw new VaultError("wrong password or corrupt vault", "auth");
  }
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

/** In-memory IDB stand-in — **tests only** when vaultTestAllowMemoryKeys(true) */
type KeyRecord = {
  id: string;
  cryptoKey: CryptoKey;
  gen: number;
  rev: number;
  createdAt: number;
  opToken: string;
};
const memoryKeys = new Map<string, KeyRecord>();
/** When true, allow memoryKeys as IDB stand-in (vitest). Production always false. */
let allowMemoryKeys = false;

function hasIdbBackend(): boolean {
  return typeof indexedDB !== "undefined" || allowMemoryKeys;
}

/** Test helper */
export function vaultTestResetStorage(): void {
  memoryKV.clear();
  memoryKeys.clear();
  allowMemoryKeys = false;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(VAULT_META_KEY);
    localStorage.removeItem(LEGACY_SECRETS_KEY);
    localStorage.removeItem(REMEMBER_UNLOCK_KEY);
    localStorage.removeItem(RESTORE_ALLOWED_KEY);
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("assmud.vault.tabSession.v1");
    }
  } catch {
    /* ignore */
  }
  session = null;
  opEpoch = 0;
  vaultOpTail = Promise.resolve();
  probeCache = null;
}

/** Test-only: enable in-memory CryptoKey store (simulates IDB). */
export function vaultTestAllowMemoryKeys(on: boolean): void {
  allowMemoryKeys = on;
  probeCache = null;
}

/** Test-only: drop RAM session without lock (simulate F5 mid-session). */
export function vaultTestClearSessionRam(): void {
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

/** Encrypt envelope with CryptoKey or raw keyBytes — never exportKey. */
export async function encryptEnvelope(
  key: CryptoKey | Uint8Array,
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
  let ct: Uint8Array;
  if (key instanceof Uint8Array) {
    ct = await aesGcmEncryptBytes(key, iv, plain);
  } else {
    ct = await aesGcmEncryptKey(key, iv, plain);
  }
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

async function decryptEnvelopeWithPassword(
  password: string,
  raw: string,
): Promise<{ keyBytes: Uint8Array; payload: VaultPayload; env: Envelope }> {
  const env = parseEnvelope(raw);
  const salt = b64decode(env.salt_b64);
  const iv = b64decode(env.iv_b64);
  const ct = b64decode(env.ct_b64);
  if (ct.length > MAX_CT_BYTES) {
    throw new VaultError("ciphertext too large", "size");
  }
  const keyBytes = await deriveKeyBytes(password, salt, env.iter);
  const plain = await aesGcmDecryptBytes(keyBytes, iv, ct);
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
  return { keyBytes, payload, env };
}

async function decryptEnvelopeWithCryptoKey(
  cryptoKey: CryptoKey,
  raw: string,
): Promise<VaultPayload> {
  const env = parseEnvelope(raw);
  const iv = b64decode(env.iv_b64);
  const ct = b64decode(env.ct_b64);
  if (ct.length > MAX_CT_BYTES) {
    throw new VaultError("ciphertext too large", "size");
  }
  const plain = await aesGcmDecryptKey(cryptoKey, iv, ct);
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
  return payload;
}

type Session = {
  keyBytes?: Uint8Array;
  cryptoKey?: CryptoKey;
  payload: VaultPayload;
  gen: number;
  rev: number;
  raw: string;
  salt: Uint8Array;
  iter: number;
};

let session: Session | null = null;

// --- Mutation protocol (plan §4.5) ---

let opEpoch = 0;
let vaultOpTail: Promise<unknown> = Promise.resolve();

type MutationTicket = {
  id: number;
  opToken: string;
  kind: string;
  stillOwner: () => boolean;
};

function beginMutation(kind: string): MutationTicket {
  opEpoch += 1;
  const id = opEpoch;
  const opToken = mintOpToken(id);
  return {
    id,
    opToken,
    kind,
    stillOwner: () => id === opEpoch,
  };
}

async function withExclusiveVaultLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (
    globalThis as unknown as {
      navigator?: {
        locks?: {
          request: (
            name: string,
            opts: { mode: string },
            cb: () => Promise<T>,
          ) => Promise<T>;
        };
      };
    }
  ).navigator?.locks;

  if (!locks?.request) {
    return fn();
  }

  let bodyStarted = false;
  try {
    return await locks.request(
      VAULT_LOCK_NAME,
      { mode: "exclusive" },
      async () => {
        bodyStarted = true;
        return fn();
      },
    );
  } catch (err) {
    if (bodyStarted) throw err;
    console.warn(
      "[vault] Web Lock acquire failed; multi-tab IDB races weakened",
      err,
    );
    return fn();
  }
}

function enqueueVaultOp<T>(
  kind: string,
  body: (ticket: MutationTicket) => Promise<T>,
): Promise<T> {
  const run = vaultOpTail.catch(() => {}).then(async () => {
    return withExclusiveVaultLock(async () => {
      const ticket = beginMutation(kind);
      return body(ticket);
    });
  });
  vaultOpTail = run.then(
    () => {},
    () => {},
  );
  return run;
}

// --- Durable flags ---

export function getRememberUnlock(): boolean {
  return storageGet(REMEMBER_UNLOCK_KEY) === "1";
}

export function getRestoreAllowed(): boolean {
  return storageGet(RESTORE_ALLOWED_KEY) === "1";
}

function setDurableRememberUnlock(v: 0 | 1): void {
  storageSet(REMEMBER_UNLOCK_KEY, String(v));
}

function setDurableRestoreAllowed(v: 0 | 1): void {
  storageSet(RESTORE_ALLOWED_KEY, String(v));
}

// --- IndexedDB key store ---

function openKeysDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    req.onblocked = () => reject(new Error("idb blocked"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPut(rec: KeyRecord): Promise<void> {
  if (typeof indexedDB === "undefined") {
    if (!allowMemoryKeys) throw new Error("no indexedDB");
    memoryKeys.set(rec.id, rec);
    return;
  }
  const db = await openKeysDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
      tx.objectStore(IDB_STORE).put(rec);
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<KeyRecord | null> {
  if (typeof indexedDB === "undefined") {
    if (!allowMemoryKeys) throw new Error("no indexedDB");
    return memoryKeys.get(id) ?? null;
  }
  const db = await openKeysDb();
  try {
    return await new Promise<KeyRecord | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve((req.result as KeyRecord) ?? null);
      req.onerror = () => reject(req.error ?? new Error("idb get failed"));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    if (!allowMemoryKeys) throw new Error("no indexedDB");
    memoryKeys.delete(id);
    return;
  }
  const db = await openKeysDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
      tx.objectStore(IDB_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}

/** Single-tx compare-and-delete by opToken. */
async function atomicDeleteIfOpToken(expectedToken: string): Promise<boolean> {
  if (!expectedToken) return false;
  if (typeof indexedDB === "undefined") {
    if (!allowMemoryKeys) return false;
    const rec = memoryKeys.get(IDB_DEFAULT_ID);
    if (rec && rec.opToken === expectedToken) {
      memoryKeys.delete(IDB_DEFAULT_ID);
      return true;
    }
    return false;
  }
  const db = await openKeysDb();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      let deleted = false;
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(IDB_DEFAULT_ID);
      getReq.onsuccess = () => {
        const rec = getReq.result as KeyRecord | undefined;
        if (rec && rec.opToken === expectedToken) {
          store.delete(IDB_DEFAULT_ID);
          deleted = true;
        }
      };
      tx.onerror = () => reject(tx.error ?? new Error("idb cas delete failed"));
      tx.oncomplete = () => resolve(deleted);
    });
  } finally {
    db.close();
  }
}

// --- Capability probe ---

let probeCache: boolean | null = null;

export function canRememberUnlock(): boolean {
  if (probeCache != null) return probeCache;
  return hasWebCryptoSubtle() && hasIdbBackend();
}

export async function probeRememberUnlock(): Promise<boolean> {
  try {
    if (!hasWebCryptoSubtle() || !hasIdbBackend()) {
      probeCache = false;
      return false;
    }
    const keyBytes = randomBytes(32);
    const cryptoKey = await importAesCryptoKey(keyBytes);
    keyBytes.fill(0);
    if (!validateCryptoKey(cryptoKey)) {
      probeCache = false;
      return false;
    }
    const opToken = mintOpToken(-1);
    const rec: KeyRecord = {
      id: IDB_PROBE_ID,
      cryptoKey,
      gen: 0,
      rev: 0,
      createdAt: Date.now(),
      opToken,
    };
    await idbPut(rec);
    const got = await idbGet(IDB_PROBE_ID);
    await idbDelete(IDB_PROBE_ID);
    if (!got || !validateCryptoKey(got.cryptoKey)) {
      probeCache = false;
      return false;
    }
    // smoke encrypt/decrypt
    const iv = randomBytes(12);
    const plain = utf8("probe");
    const ct = await aesGcmEncryptKey(got.cryptoKey, iv, plain);
    const back = await aesGcmDecryptKey(got.cryptoKey, iv, ct);
    if (new TextDecoder().decode(back) !== "probe") {
      probeCache = false;
      return false;
    }
    probeCache = true;
    return true;
  } catch {
    probeCache = false;
    return false;
  }
}

// --- Public vault API ---

export function vaultExists(): boolean {
  return storageGet(VAULT_KEY) != null;
}

export function hasLegacyPlaintextSecrets(): boolean {
  return storageGet(LEGACY_SECRETS_KEY) != null;
}

export function isVaultUnlocked(): boolean {
  return session != null;
}

const vaultListeners = new Set<() => void>();

/** Notify UI (e.g. autologin) when unlock/lock/create changes session. */
export function subscribeVault(cb: () => void): () => void {
  vaultListeners.add(cb);
  return () => {
    vaultListeners.delete(cb);
  };
}

function notifyVaultListeners(): void {
  for (const cb of [...vaultListeners]) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

function structuredClonePayload(p: VaultPayload): VaultPayload {
  return JSON.parse(JSON.stringify(p)) as VaultPayload;
}

function requireSession(): Session {
  if (!session) throw new VaultError("vault locked", "locked");
  return session;
}

async function persistSession(s: Session): Promise<void> {
  const key = s.cryptoKey ?? s.keyBytes;
  if (!key) throw new VaultError("vault locked", "locked");
  await enqueueVaultOp("persist", async () => {
    const before = readSnap();
    if (before.kind !== "present") {
      throw new VaultError("vault missing", "missing");
    }
    if (before.gen !== s.gen || before.rev !== s.rev || before.raw !== s.raw) {
      throw new VaultError("vault conflict", "conflict");
    }
    const nextRev = s.rev + 1;
    const raw = await encryptEnvelope(
      key,
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

async function maybePutRememberKey(
  ticket: MutationTicket,
  cryptoKey: CryptoKey | undefined,
  gen: number,
  rev: number,
): Promise<void> {
  if (!getRememberUnlock()) return;
  if (!cryptoKey) return;
  if (!(await probeRememberUnlock())) return;
  try {
    await idbPut({
      id: IDB_DEFAULT_ID,
      cryptoKey,
      gen,
      rev,
      createdAt: Date.now(),
      opToken: ticket.opToken,
    });
    if (!ticket.stillOwner()) {
      await atomicDeleteIfOpToken(ticket.opToken);
      return;
    }
    setDurableRestoreAllowed(1);
  } catch (e) {
    console.warn("[vault] IDB put failed; memory-only unlock", e);
  }
}

export async function createVault(masterPassword: string): Promise<void> {
  if (!masterPassword || masterPassword.length < 4) {
    throw new VaultError("master password too short", "auth");
  }
  await enqueueVaultOp("create", async (ticket) => {
    const before = readSnap();
    if (before.kind === "present") {
      throw new VaultError("vault already exists", "exists");
    }
    if (storageGet(VAULT_KEY) != null) {
      throw new VaultError("vault conflict", "conflict");
    }
    const metaGen = before.metaGen + 1;
    const salt = randomBytes(16);
    const iter = VAULT_DEFAULT_ITER;
    const keyBytes = await deriveKeyBytes(masterPassword, salt, iter);
    let cryptoKey: CryptoKey | undefined;
    if (hasWebCryptoSubtle()) {
      try {
        cryptoKey = await importAesCryptoKey(keyBytes);
      } catch {
        cryptoKey = undefined;
      }
    }
    const payload: VaultPayload = { profiles: {} };
    const raw = await encryptEnvelope(
      cryptoKey ?? keyBytes,
      payload,
      metaGen,
      1,
      salt,
      iter,
    );
    if (storageGet(VAULT_KEY) != null) {
      throw new VaultError("vault conflict", "conflict");
    }
    if (!ticket.stillOwner()) {
      keyBytes.fill(0);
      throw new VaultError("superseded", "superseded");
    }
    writeMeta({ gen: metaGen });
    storageSet(VAULT_KEY, raw);
    const after = readSnap();
    if (after.kind !== "present" || after.raw !== raw || after.gen !== metaGen) {
      throw new VaultError("persist failed", "persist");
    }
    session = {
      keyBytes,
      cryptoKey,
      payload,
      gen: metaGen,
      rev: 1,
      raw,
      salt,
      iter,
    };
    await maybePutRememberKey(ticket, cryptoKey, metaGen, 1);
    if (ticket.stillOwner()) notifyVaultListeners();
  });
}

export async function unlockVault(masterPassword: string): Promise<void> {
  await enqueueVaultOp("unlock", async (ticket) => {
    const raw = storageGet(VAULT_KEY);
    if (!raw) throw new VaultError("no vault", "missing");
    const { keyBytes, payload, env } = await decryptEnvelopeWithPassword(
      masterPassword,
      raw,
    );
    const salt = b64decode(env.salt_b64);
    let cryptoKey: CryptoKey | undefined;
    if (hasWebCryptoSubtle()) {
      try {
        cryptoKey = await importAesCryptoKey(keyBytes);
      } catch {
        cryptoKey = undefined;
      }
    }
    if (!ticket.stillOwner()) {
      keyBytes.fill(0);
      throw new VaultError("superseded", "superseded");
    }
    session = {
      keyBytes,
      cryptoKey,
      payload: structuredClonePayload(payload),
      gen: env.gen,
      rev: env.rev,
      raw,
      salt,
      iter: env.iter,
    };
    await maybePutRememberKey(ticket, cryptoKey, env.gen, env.rev);
    if (ticket.stillOwner()) notifyVaultListeners();
  });
}

export async function setRememberUnlock(on: boolean): Promise<LockResult> {
  if (on) {
    return enqueueVaultOp("remember-on", async (ticket) => {
      const s = session;
      if (!s) throw new VaultError("vault locked", "locked");
      if (!(await probeRememberUnlock())) {
        throw new VaultError("remember unlock unavailable", "capability");
      }
      let cryptoKey = s.cryptoKey;
      if (!cryptoKey) {
        if (!s.keyBytes) throw new VaultError("no key material", "locked");
        cryptoKey = await importAesCryptoKey(s.keyBytes);
        s.cryptoKey = cryptoKey;
      }
      if (!validateCryptoKey(cryptoKey)) {
        throw new VaultError("bad crypto key", "capability");
      }
      await idbPut({
        id: IDB_DEFAULT_ID,
        cryptoKey,
        gen: s.gen,
        rev: s.rev,
        createdAt: Date.now(),
        opToken: ticket.opToken,
      });
      if (!ticket.stillOwner()) {
        await atomicDeleteIfOpToken(ticket.opToken);
        throw new VaultError("superseded", "superseded");
      }
      setDurableRememberUnlock(1);
      setDurableRestoreAllowed(1);
      return { ok: true as const };
    });
  }

  return enqueueVaultOp("remember-off", async () => {
    const reasons: string[] = [];
    try {
      setDurableRestoreAllowed(0);
    } catch {
      reasons.push("restore_flag_write_failed");
    }
    try {
      setDurableRememberUnlock(0);
    } catch {
      reasons.push("remember_flag_write_failed");
    }
    try {
      await idbDelete(IDB_DEFAULT_ID);
    } catch {
      reasons.push("idb_delete_failed");
    }
    try {
      setDurableRestoreAllowed(0);
    } catch {
      /* ignore */
    }
    return reasons.length === 0
      ? { ok: true as const }
      : { ok: false as const, reasons };
  });
}

export async function tryRestoreVaultSession(): Promise<boolean> {
  return enqueueVaultOp("restore", async (ticket) => {
    if (session) return true;
    if (!getRememberUnlock()) return false;
    if (!getRestoreAllowed()) return false;
    if (!(await probeRememberUnlock())) return false;
    const rec = await idbGet(IDB_DEFAULT_ID);
    if (!rec || !validateCryptoKey(rec.cryptoKey)) return false;
    const seenToken = rec.opToken;
    const raw = storageGet(VAULT_KEY);
    if (!raw) {
      await atomicDeleteIfOpToken(seenToken);
      return false;
    }
    let env: Envelope;
    try {
      env = parseEnvelope(raw);
    } catch {
      await atomicDeleteIfOpToken(seenToken);
      return false;
    }
    if (env.gen !== rec.gen) {
      await atomicDeleteIfOpToken(seenToken);
      return false;
    }
    if (!ticket.stillOwner()) return false;
    let payload: VaultPayload;
    try {
      payload = await decryptEnvelopeWithCryptoKey(rec.cryptoKey, raw);
    } catch {
      await atomicDeleteIfOpToken(seenToken);
      return false;
    }
    if (!ticket.stillOwner()) return false;
    session = {
      cryptoKey: rec.cryptoKey,
      // no keyBytes after restore
      payload: structuredClonePayload(payload),
      gen: env.gen,
      rev: env.rev,
      raw,
      salt: b64decode(env.salt_b64),
      iter: env.iter,
    };
    notifyVaultListeners();
    return true;
  });
}

export async function lockVault(): Promise<LockResult> {
  return enqueueVaultOp("lock", async () => {
    const reasons: string[] = [];
    try {
      setDurableRestoreAllowed(0);
    } catch {
      reasons.push("restore_flag_write_failed");
    }
    session = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("assmud.vault.tabSession.v1");
      }
    } catch {
      /* ignore */
    }
    try {
      notifyVaultListeners();
    } catch {
      /* ignore */
    }
    try {
      await idbDelete(IDB_DEFAULT_ID);
    } catch {
      reasons.push("idb_delete_failed");
    }
    try {
      setDurableRestoreAllowed(0);
    } catch {
      /* ignore */
    }
    return reasons.length === 0
      ? { ok: true as const }
      : { ok: false as const, reasons };
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

export async function clearVault(): Promise<LockResult> {
  return enqueueVaultOp("clear", async () => {
    const reasons: string[] = [];
    try {
      setDurableRestoreAllowed(0);
    } catch {
      reasons.push("restore_flag_write_failed");
    }
    try {
      setDurableRememberUnlock(0);
    } catch {
      reasons.push("remember_flag_write_failed");
    }
    session = null;
    try {
      notifyVaultListeners();
    } catch {
      /* ignore */
    }
    try {
      await idbDelete(IDB_DEFAULT_ID);
    } catch {
      reasons.push("idb_delete_failed");
    }
    try {
      const before = readSnap();
      const metaGen = before.metaGen + 1;
      writeMeta({ gen: metaGen });
      storageDel(VAULT_KEY);
    } catch {
      reasons.push("envelope_delete_failed");
    }
    try {
      setDurableRestoreAllowed(0);
      setDurableRememberUnlock(0);
    } catch {
      /* ignore */
    }
    return reasons.length === 0
      ? { ok: true as const }
      : { ok: false as const, reasons };
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
    if (s.payload.profiles[id]) continue;
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
