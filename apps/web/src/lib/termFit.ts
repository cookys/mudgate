/** Fit terminal cell grid into a CSS-pixel viewport. */

export type TermFit = { cols: number; rows: number };

export const TERM_FIT = {
  minCols: 40,
  maxCols: 200,
  minRows: 12,
  maxRows: 80,
  defaultCols: 80,
  defaultRows: 28,
} as const;

/**
 * Compute cols/rows that fit `cssW`×`cssH` at the given cell size.
 * Floor so the full grid is always visible (no clipped bottom half).
 */
export function fitTermSize(
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  const cols = Math.floor(Math.max(0, cssW) / cw);
  const rows = Math.floor(Math.max(0, cssH) / ch);
  return {
    cols: clamp(
      cols || TERM_FIT.defaultCols,
      TERM_FIT.minCols,
      TERM_FIT.maxCols,
    ),
    rows: clamp(
      rows || TERM_FIT.defaultRows,
      TERM_FIT.minRows,
      TERM_FIT.maxRows,
    ),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
