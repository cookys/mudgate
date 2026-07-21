import type { Attrs } from "@assmud/vt";

/** Soft ANSI 16 — less 90s VGA, more ink terminal (shared by terminal + companion). */
export const ANSI_FG: string[] = [
  "#1a1b22",
  "#e06c75",
  "#7fd962",
  "#e5c07b",
  "#61afef",
  "#c678dd",
  "#56b6c2",
  "#c8cdd5",
  "#5c6370",
  "#ff7b86",
  "#a6e38a",
  "#f0d48a",
  "#7dc4ff",
  "#d9a0ef",
  "#7ee8f2",
  "#f5f7fa",
];

export const VOID_BG = "#0a0b0e";

/** Map SGR attrs (or companion MapFrameCell fields) to CSS colors. */
export function colorForAttrs(attrs: {
  fg: number | null;
  bg: number | null;
  bold?: boolean;
  dim?: boolean;
  reverse?: boolean;
  inverse?: boolean;
}): { fg: string; bg: string } {
  const reverse = attrs.reverse ?? attrs.inverse ?? false;
  let fg =
    attrs.fg != null ? (ANSI_FG[attrs.fg] ?? "#c8cdd5") : "#c8cdd5";
  let bg =
    attrs.bg != null ? (ANSI_FG[attrs.bg] ?? VOID_BG) : VOID_BG;
  if (attrs.bold && attrs.fg != null && attrs.fg < 8) {
    fg = ANSI_FG[attrs.fg + 8] ?? fg;
  }
  if (attrs.dim) {
    fg = fg + "99";
  }
  if (reverse) {
    const t = fg;
    fg = bg === VOID_BG ? "#c8cdd5" : bg;
    bg = t;
  }
  return { fg, bg };
}

/** @deprecated use colorForAttrs — kept for canvas2d internal clarity */
export function colorFor(attrs: Attrs): { fg: string; bg: string } {
  return colorForAttrs(attrs);
}
