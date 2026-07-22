/** Fit terminal cell grid into a CSS-pixel viewport. */

export type TermFit = { cols: number; rows: number };

export const TERM_FIT = {
  /** Soft preference only — never force above what the stage can hold. */
  preferredMinCols: 40,
  preferredMinRows: 12,
  /** Phone portrait targets (auto-shrink font until met or min font). */
  mobileTargetCols: 52,
  mobileTargetRows: 22,
  mobileMinFontPx: 11,
  mobileMinLineScale: 1.05,
  /** Hard floor when stage is tiny (keyboard open). */
  emergencyMinCols: 20,
  emergencyMinRows: 4,
  maxCols: 200,
  maxRows: 80,
  defaultCols: 80,
  defaultRows: 28,
} as const;

/** Shrink fit so grid never exceeds stage pixels. */
export function clampFitToStage(
  fit: TermFit,
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  let cols = fit.cols;
  let rows = fit.rows;
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  while (cols > 1 && cols * cw > cssW) cols -= 1;
  while (rows > 1 && rows * ch > cssH) rows -= 1;
  return { cols, rows };
}

/**
 * Compute cols/rows that fit `cssW`×`cssH` at the given cell size.
 * Floor so the full grid is always visible (no clipped bottom half).
 * Never inflate cols/rows past what physically fits — that overflowed mobile.
 */
export function fitTermSize(
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  const rawCols = Math.floor(Math.max(0, cssW) / cw);
  const rawRows = Math.floor(Math.max(0, cssH) / ch);
  // If measurement failed, fall back to defaults (desktop first paint).
  if (rawCols < 1 || rawRows < 1) {
    return { cols: TERM_FIT.defaultCols, rows: TERM_FIT.defaultRows };
  }
  // Never inflate past physical fit (that overflowed mobile). Soft prefs are docs only.
  return {
    cols: Math.min(TERM_FIT.maxCols, Math.max(1, rawCols)),
    rows: Math.min(TERM_FIT.maxRows, Math.max(1, rawRows)),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
