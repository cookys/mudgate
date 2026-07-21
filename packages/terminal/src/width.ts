/**
 * Cell width for dual-width terminals.
 * mode is always effective ("cjk" | "western") — resolve via @assmud/profiles first.
 *
 * western: pragmatic Fullwidth/Wide ranges (Ambiguous box-drawing = 1).
 * cjk: F/W + pragmatic Ambiguous ranges (box drawing / common banner symbols) = 2.
 *
 * Not a full Unicode TR11 dump — scoped for TW/Big5 MUD MOTD + map art.
 * Optional later: pin full EAW tables if multi-script UTF-8 needs it.
 */

export type WidthMode = "cjk" | "western";

/** Combining marks — never advance as wide cells alone. */
function isCombining(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  );
}

/** Fullwidth / Wide (EAW F/W style, pragmatic ranges). */
function isFullwidthOrWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x2fffd)
  );
}

/**
 * East Asian Ambiguous (A) — treat as wide only in cjk mode.
 * Covers box drawing / block / geometric / common math symbols used in Big5 MOTD art.
 * Not a full TR11 table; enough for TW MUD banners + safe default for rare N.
 */
function isAmbiguous(cp: number): boolean {
  return (
    // Latin-1 punctuation often A (¡ ¢ £ § ¨ © « ¬ ® ° ± …)
    (cp >= 0x00a1 && cp <= 0x00ff && cp !== 0x00ad) ||
    // General punctuation subset
    (cp >= 0x2010 && cp <= 0x2027) ||
    (cp >= 0x2030 && cp <= 0x205e) ||
    // Box drawing
    (cp >= 0x2500 && cp <= 0x257f) ||
    // Block elements
    (cp >= 0x2580 && cp <= 0x259f) ||
    // Geometric shapes
    (cp >= 0x25a0 && cp <= 0x25ff) ||
    // Misc symbols (arrows, etc.)
    (cp >= 0x2600 && cp <= 0x27bf) ||
    // Misc math / technical that appear in banners (≡ ∩ ∠ …)
    (cp >= 0x2190 && cp <= 0x21ff) ||
    (cp >= 0x2200 && cp <= 0x22ff) ||
    // Modifier / presentation that Big5 maps to (e.g. ˍ)
    (cp >= 0x02c2 && cp <= 0x02df) ||
    // Square symbols (㎜)
    (cp >= 0x3300 && cp <= 0x33ff)
  );
}

/**
 * western: Ambiguous box-drawing stays 1 (UTF-8 Western MUD art).
 * cjk: Ambiguous + F/W → 2 (BBS / zMUD / Big5 MOTD).
 * EAW Neutral rare symbols → 1 in both modes.
 */
export function isWide(ch: string, mode: WidthMode = "western"): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x20) return false;
  if (cp < 0x80) return false;
  if (isCombining(cp)) return false;
  if (isFullwidthOrWide(cp)) return true;
  if (mode === "cjk" && isAmbiguous(cp)) return true;
  return false;
}

export function charDisplayWidth(ch: string, mode: WidthMode): number {
  return isWide(ch, mode) ? 2 : 1;
}
