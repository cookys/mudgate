export type AccentId = "mint" | "blue";

const KEY = "assmud.accent";

export function loadAccent(): AccentId {
  try {
    const v = localStorage.getItem(KEY);
    return v === "blue" ? "blue" : "mint";
  } catch {
    return "mint";
  }
}

export function applyAccent(id: AccentId): void {
  document.documentElement.dataset.accent = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

/** @deprecated use pickTagline from i18n */
export { pickTagline, TAGLINES } from "../i18n/taglines";
