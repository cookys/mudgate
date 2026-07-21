/** Connection profiles (Phase 4) — no secrets required; token optional. */

export type { WidthMode, NormalizedCharset, WidthModeSource } from "./widthMode.js";
export {
  normalizeCharset,
  resolveWidthMode,
} from "./widthMode.js";
import type { WidthMode } from "./widthMode.js";

export type MudProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  charset: "big5hkscs" | "big5" | "utf8" | "gbk";
  /** Optional cell-width override; omit to derive from charset. */
  widthMode?: WidthMode;
  tlsToMud?: boolean;
  notes?: string;
};

const KEY = "assmud.profiles.v1";

export const DEFAULT_PROFILES: MudProfile[] = [
  {
    id: "rw-4000",
    name: "Revival World",
    host: "mud.revivalworld.org",
    port: 4000,
    charset: "big5hkscs",
  },
  {
    id: "rw-5000",
    name: "Revival World (5000)",
    host: "mud.revivalworld.org",
    port: 5000,
    charset: "big5hkscs",
  },
];

export function loadProfiles(): MudProfile[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_PROFILES];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_PROFILES];
    const parsed = JSON.parse(raw) as MudProfile[];
    return parsed.length ? parsed : [...DEFAULT_PROFILES];
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
  const list = JSON.parse(json) as MudProfile[];
  if (!Array.isArray(list)) throw new Error("invalid profiles");
  return list
    .filter((p) => p.id && p.host && p.port)
    .map((p) =>
      sanitizeProfileForExport(p as MudProfile & Record<string, unknown>),
    );
}
