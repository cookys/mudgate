import type { Locale, MessageKey, MessageVars } from "./types";
import { en } from "./messages/en";
import { zhTW } from "./messages/zh-TW";
import { zhCN } from "./messages/zh-CN";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
};

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}

/**
 * Translate a message key for the given locale.
 * Missing key → English → raw key string (never blank).
 */
export function t(
  locale: Locale,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const primary = catalogs[locale]?.[key];
  if (primary != null && primary !== "") {
    return interpolate(primary, vars);
  }
  const fallback = catalogs.en[key];
  if (fallback != null && fallback !== "") {
    return interpolate(fallback, vars);
  }
  return key;
}

/** Exported for parity tests. */
export function messageCatalog(locale: Locale): Record<MessageKey, string> {
  return catalogs[locale];
}
