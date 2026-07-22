/** Connection profiles (Phase 4) — no secrets required; token optional. */

export type { WidthMode, NormalizedCharset, WidthModeSource } from "./widthMode.js";
export {
  normalizeCharset,
  resolveWidthMode,
} from "./widthMode.js";
export {
  getProfilePassword,
  getProfileAccount,
  getProfileAutoLogin,
  setProfileSecretEntry,
  getProfileSecret,
  clearProfileSecret,
  type ProfileSecrets,
  type ProfileSecretEntry,
} from "./secrets.js";
export {
  vaultExists,
  hasLegacyPlaintextSecrets,
  isVaultUnlocked,
  lockVault,
  createVault,
  unlockVault,
  subscribeVault,
  clearVault,
  getVaultSecret,
  setVaultSecret,
  migrateLegacyIntoVault,
  tryFinishLegacyDelete,
  discardLegacyPlaintext,
  vaultTestResetStorage,
  hasWebCryptoSubtle,
  getRememberUnlock,
  getRestoreAllowed,
  setRememberUnlock,
  tryRestoreVaultSession,
  probeRememberUnlock,
  canRememberUnlock,
  encryptEnvelope,
  VaultError,
  VAULT_KEY,
  VAULT_META_KEY,
  LEGACY_SECRETS_KEY,
  REMEMBER_UNLOCK_KEY,
  RESTORE_ALLOWED_KEY,
  type VaultSecretEntry,
  type VaultPayload,
  type LockResult,
} from "./vault.js";
import type { WidthMode } from "./widthMode.js";

export type MudCharset = "big5hkscs" | "big5" | "utf8" | "gbk";

/** Compass click / speedwalk command dialect (map HUD). RW default: en. */
export type MoveDialect = "en" | "zh";

export type MudProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  charset: MudCharset;
  /** Optional cell-width override; omit to derive from charset. */
  widthMode?: WidthMode;
  /** Map pad / path commands: en → e/n/… · zh → 東/北/… */
  moveDialect?: MoveDialect;
  tlsToMud?: boolean;
  notes?: string;
};

/** Resolve dialect; RW seeds and omit → en. */
export function resolveMoveDialect(
  p: Pick<MudProfile, "moveDialect" | "host"> | undefined,
): MoveDialect {
  if (p?.moveDialect === "zh" || p?.moveDialect === "en") return p.moveDialect;
  return "en";
}

const CHARSETS = new Set<MudCharset>(["big5hkscs", "big5", "utf8", "gbk"]);

/** Strict validate one profile object. */
export function validateProfile(p: unknown): MudProfile {
  if (!p || typeof p !== "object") throw new Error("profile not object");
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) throw new Error("id required");
  if (typeof o.name !== "string" || !o.name.trim())
    throw new Error("name required");
  if (typeof o.host !== "string" || !o.host.trim())
    throw new Error("host required");
  const port = Number(o.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("port 1-65535");
  const charset = String(o.charset ?? "big5hkscs") as MudCharset;
  if (!CHARSETS.has(charset)) throw new Error("invalid charset");
  return sanitizeProfileForExport({
    id: o.id.trim(),
    name: o.name.trim(),
    host: o.host.trim(),
    port,
    charset,
    widthMode:
      o.widthMode === "cjk" || o.widthMode === "western"
        ? o.widthMode
        : undefined,
    moveDialect:
      o.moveDialect === "zh" || o.moveDialect === "en"
        ? o.moveDialect
        : undefined,
    tlsToMud: Boolean(o.tlsToMud) || undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
  } as MudProfile & Record<string, unknown>);
}

const KEY = "assmud.profiles.v1";

/** Built-in seeds. Users can always add custom host:port via ProfileManager. */
export const DEFAULT_PROFILES: MudProfile[] = [
  {
    id: "rw-4000",
    name: "Revival World",
    host: "mud.revivalworld.org",
    port: 4000,
    charset: "big5hkscs",
    moveDialect: "en",
  },
  {
    id: "rw-4001",
    name: "Revival World (wiz 4001)",
    host: "mud.revivalworld.org",
    port: 4001,
    charset: "big5hkscs",
    moveDialect: "en",
  },
  {
    id: "rw-5000",
    name: "Revival World (5000)",
    host: "mud.revivalworld.org",
    port: 5000,
    charset: "big5hkscs",
    moveDialect: "en",
  },
  {
    id: "rw-6000",
    name: "Revival World (6000)",
    host: "mud.revivalworld.org",
    port: 6000,
    charset: "big5hkscs",
    moveDialect: "en",
  },
];

/**
 * Load profiles; merge in any missing DEFAULT seed ids (e.g. new rw-4001)
 * without overwriting user-edited entries of the same id.
 */
export function loadProfiles(): MudProfile[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_PROFILES];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_PROFILES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_PROFILES];
    const out: MudProfile[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      try {
        const p = validateProfile(item);
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      } catch {
        /* skip invalid entry */
      }
    }
    if (!out.length) return [...DEFAULT_PROFILES];
    // Append new built-in seeds the user does not have yet (wiz 4001, etc.)
    for (const seed of DEFAULT_PROFILES) {
      if (!seen.has(seed.id)) {
        out.push({ ...seed });
        seen.add(seed.id);
      }
    }
    return out;
  } catch {
    return [...DEFAULT_PROFILES];
  }
}

export function saveProfiles(list: MudProfile[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

const SECRET_KEYS = new Set([
  "proxyToken",
  "assmud_token",
  "password",
  "token",
  "secret",
]);

/** Strip secret-like keys; never re-export imported credentials. */
export function sanitizeProfileForExport(
  p: MudProfile & Record<string, unknown>,
): MudProfile {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (SECRET_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out as unknown as MudProfile;
}

export function exportProfilesJson(list: MudProfile[]): string {
  const clean = list.map((p) =>
    sanitizeProfileForExport(p as MudProfile & Record<string, unknown>),
  );
  return JSON.stringify(clean, null, 2);
}

export function importProfilesJson(json: string): MudProfile[] {
  let list: unknown;
  try {
    list = JSON.parse(json);
  } catch {
    throw new Error("invalid profiles JSON");
  }
  if (!Array.isArray(list)) throw new Error("invalid profiles");
  if (list.length === 0) throw new Error("empty profiles");
  return list.map((p) => validateProfile(p));
}
