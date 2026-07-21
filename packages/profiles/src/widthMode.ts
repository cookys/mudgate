/** Charset-aware terminal cell width mode (CJK dual-width vs western). */

export type WidthMode = "cjk" | "western";

export type NormalizedCharset =
  | "big5"
  | "big5hkscs"
  | "gbk"
  | "gb18030"
  | "utf8"
  | "unknown";

/**
 * Common aliases only (non-exhaustive). Unlisted → unknown → western.
 * @see docs/plans/2026-07-21-cjk-cell-width-taiwanmud.md §1.2
 */
const ALIAS: Record<string, NormalizedCharset> = {
  big5: "big5",
  "cn-big5": "big5",
  big5hkscs: "big5hkscs",
  "big5-hkscs": "big5hkscs",
  cp950: "big5hkscs",
  ms950: "big5hkscs",
  gbk: "gbk",
  gb2312: "gbk",
  cp936: "gbk",
  gb18030: "gb18030",
  utf8: "utf8",
  "utf-8": "utf8",
};

export function normalizeCharset(raw: string | undefined | null): NormalizedCharset {
  if (raw == null || raw === "") return "unknown";
  const key = String(raw).trim().toLowerCase();
  return ALIAS[key] ?? "unknown";
}

export type WidthModeSource = {
  charset?: string;
  /** Explicit override; never "auto". */
  widthMode?: WidthMode;
};

/**
 * Resolve effective width mode before calling isWide(ch, mode).
 * isWide must never receive "auto".
 */
export function resolveWidthMode(src: WidthModeSource): WidthMode {
  if (src.widthMode === "cjk" || src.widthMode === "western") {
    return src.widthMode;
  }
  const cs = normalizeCharset(src.charset);
  if (
    cs === "big5" ||
    cs === "big5hkscs" ||
    cs === "gbk" ||
    cs === "gb18030"
  ) {
    return "cjk";
  }
  // utf8 | unknown — conservative western
  return "western";
}
