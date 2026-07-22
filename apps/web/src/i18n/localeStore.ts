import type { Locale } from "./types";

export const LOCALES = ["zh-TW", "zh-CN", "en"] as const satisfies readonly Locale[];

const STORAGE_KEY = "mudgate.locale";
const FALLBACK: Locale = "zh-TW";

export function isLocale(v: unknown): v is Locale {
  return v === "zh-TW" || v === "zh-CN" || v === "en";
}

/**
 * Map navigator / BCP47 tags → product locales.
 * zh-TW / zh-HK / zh-Hant* → zh-TW; zh-CN / zh-SG / zh-Hans* → zh-CN; else en.
 */
export function detectLocale(tag: string | undefined | null): Locale {
  if (!tag) return "en";
  const raw = tag.trim();
  if (!raw) return "en";
  const lower = raw.toLowerCase().replace(/_/g, "-");

  if (lower === "zh-tw" || lower === "zh-hk" || lower.startsWith("zh-hant")) {
    return "zh-TW";
  }
  if (lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")) {
    return "zh-CN";
  }
  // bare "zh" — product default warehouse is Traditional
  if (lower === "zh") return "zh-TW";
  if (lower.startsWith("zh-")) {
    // other Chinese variants: prefer TW for Hant-ish, else CN for Hans-ish
    if (lower.includes("hant") || lower.includes("tw") || lower.includes("hk")) {
      return "zh-TW";
    }
    if (lower.includes("hans") || lower.includes("cn") || lower.includes("sg")) {
      return "zh-CN";
    }
    return "zh-TW";
  }
  return "en";
}

type SimpleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getStorage(): SimpleStorage | null {
  try {
    const s = (globalThis as { localStorage?: SimpleStorage }).localStorage;
    if (!s || typeof s.getItem !== "function") return null;
    return s;
  } catch {
    return null;
  }
}

export function loadStoredLocale(): Locale | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const v = storage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLocale(locale: Locale): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    if (!isLocale(locale)) return;
    storage.setItem(STORAGE_KEY, locale);
  } catch {
    /* memory-only fallback */
  }
}

type MudgateSite = { defaultLocale?: string };

function readSiteDefault(): Locale | null {
  try {
    if (typeof window !== "undefined") {
      const w = (window as unknown as { __MUDGATE_SITE__?: MudgateSite })
        .__MUDGATE_SITE__;
      if (isLocale(w?.defaultLocale)) return w.defaultLocale;
    }
  } catch {
    /* ignore */
  }
  try {
    const env =
      typeof import.meta !== "undefined"
        ? (import.meta as ImportMeta & { env?: { VITE_DEFAULT_LOCALE?: string } })
            .env?.VITE_DEFAULT_LOCALE
        : undefined;
    if (isLocale(env)) return env;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve order: storage → site → browser detect → zh-TW.
 */
export function resolveLocale(): Locale {
  const stored = loadStoredLocale();
  if (stored) return stored;

  const site = readSiteDefault();
  if (site) return site;

  try {
    const nav =
      typeof navigator !== "undefined" ? navigator.language : undefined;
    if (nav) return detectLocale(nav);
  } catch {
    /* ignore */
  }

  return FALLBACK;
}
