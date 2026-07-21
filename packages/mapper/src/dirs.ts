/**
 * Compass + special direction lexicon for Chinese / English MUDs.
 * Layout deltas are presentation-only (not room identity).
 */

export type CompassDir =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "u"
  | "d"
  | "in"
  | "out";

export type MoveDialect = "en" | "zh";

/** Canonical 8+vertical for HUD pad (in/out omitted from pad). */
export const HUD_DIRS: CompassDir[] = [
  "nw",
  "n",
  "ne",
  "w",
  "e",
  "sw",
  "s",
  "se",
  "u",
  "d",
];

const EN_CMD: Record<CompassDir, string> = {
  n: "n",
  s: "s",
  e: "e",
  w: "w",
  ne: "ne",
  nw: "nw",
  se: "se",
  sw: "sw",
  u: "u",
  d: "d",
  in: "in",
  out: "out",
};

const ZH_CMD: Record<CompassDir, string> = {
  n: "北",
  s: "南",
  e: "東",
  w: "西",
  ne: "東北",
  nw: "西北",
  se: "東南",
  sw: "西南",
  u: "上",
  d: "下",
  in: "進",
  out: "出",
};

const ZH_LABEL: Record<CompassDir, string> = { ...ZH_CMD };

const EN_LABEL: Record<CompassDir, string> = {
  n: "N",
  s: "S",
  e: "E",
  w: "W",
  ne: "NE",
  nw: "NW",
  se: "SE",
  sw: "SW",
  u: "U",
  d: "D",
  in: "in",
  out: "out",
};

/** Aliases → canonical dir (lowercased latin; CJK as-is). */
const ALIAS: Record<string, CompassDir> = {
  n: "n",
  north: "n",
  北: "n",
  s: "s",
  south: "s",
  南: "s",
  e: "e",
  east: "e",
  東: "e",
  东: "e",
  w: "w",
  west: "w",
  西: "w",
  ne: "ne",
  northeast: "ne",
  東北: "ne",
  东北: "ne",
  nw: "nw",
  northwest: "nw",
  西北: "nw",
  se: "se",
  southeast: "se",
  東南: "se",
  东南: "se",
  sw: "sw",
  southwest: "sw",
  西南: "sw",
  u: "u",
  up: "u",
  上: "u",
  d: "d",
  down: "d",
  下: "d",
  in: "in",
  進: "in",
  进: "in",
  入: "in",
  out: "out",
  出: "out",
};

export function parseDirection(token: string): CompassDir | null {
  const t = token.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  return ALIAS[lower] ?? ALIAS[t] ?? null;
}

/** Command string to send for a compass dir (per profile dialect). */
export function commandForDir(
  dir: CompassDir,
  dialect: MoveDialect = "en",
): string {
  return dialect === "zh" ? ZH_CMD[dir] : EN_CMD[dir];
}

export function labelForDir(
  dir: CompassDir,
  locale: "zh" | "en" = "zh",
): string {
  return locale === "en" ? EN_LABEL[dir] : ZH_LABEL[dir];
}

/** Layout delta for graph POC (u/d change z). */
export const DELTA: Record<CompassDir, [number, number, number]> = {
  n: [0, -1, 0],
  s: [0, 1, 0],
  e: [1, 0, 0],
  w: [-1, 0, 0],
  ne: [1, -1, 0],
  nw: [-1, -1, 0],
  se: [1, 1, 0],
  sw: [-1, 1, 0],
  u: [0, 0, 1],
  d: [0, 0, -1],
  in: [0, 0, 0],
  out: [0, 0, 0],
};

export function reverseDir(d: CompassDir): CompassDir | null {
  const m: Partial<Record<CompassDir, CompassDir>> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
    ne: "sw",
    sw: "ne",
    nw: "se",
    se: "nw",
    u: "d",
    d: "u",
    in: "out",
    out: "in",
  };
  return m[d] ?? null;
}

/** True if line is only a movement command (after alias expand). */
export function parseMoveCommand(line: string): CompassDir | null {
  const t = line.trim();
  if (!t || /\s/.test(t)) {
    // allow "go east" later; for now single token only
    const parts = t.split(/\s+/);
    if (parts.length === 2 && /^(go|walk|走)$/i.test(parts[0]!)) {
      return parseDirection(parts[1]!);
    }
    return null;
  }
  return parseDirection(t);
}
