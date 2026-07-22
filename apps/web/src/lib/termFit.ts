/** Terminal grid fit — pure geometry + font metrics (xterm FitAddon style). */

export type TermFit = { cols: number; rows: number };

export type CellMetrics = { cellW: number; cellH: number };

export type FitTypographyResult = {
  fontSizePx: number;
  lineHeightScale: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
};

/**
 * VT / teletype classic width. Not a phone breakpoint — MUD map_d / banners
 * are authored for ~80 half-width columns. Used only as an *optional* shrink
 * goal when the user font cannot already fit that many columns.
 */
export const VT_CLASSIC_COLS = 80;

export const TERM_FIT = {
  maxCols: 200,
  maxRows: 80,
  defaultCols: 80,
  defaultRows: 28,
} as const;

/** cols/rows that physically fit the stage at a given cell size. */
export function fitTermSize(
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  if (cssW < 1 || cssH < 1) {
    return { cols: 0, rows: 0 };
  }
  const cols = Math.floor(cssW / cw);
  const rows = Math.floor(cssH / ch);
  return {
    cols: Math.min(TERM_FIT.maxCols, Math.max(0, cols)),
    rows: Math.min(TERM_FIT.maxRows, Math.max(0, rows)),
  };
}

/** Ensure grid never exceeds stage (fractional / rounding safety). */
export function clampFitToStage(
  fit: TermFit,
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  let { cols, rows } = fit;
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  while (cols > 1 && cols * cw > cssW) cols -= 1;
  while (rows > 1 && rows * ch > cssH) rows -= 1;
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}

/**
 * xterm.js FitAddon default: keep user font, floor grid to container.
 *
 * Optional classicCols (default VT 80): if the user font yields fewer columns
 * than classicCols, binary-search the *largest* font in
 * [minFontFromUserPref, userFont] that still reaches classicCols.
 * If even min font cannot, use min font and fill whatever cols/rows fit.
 *
 * No device breakpoints (no 52×22, no "if phone").
 *
 * @param measure  Returns cellW/cellH for exact (fontPx, lineScale)
 * @param classicCols  Shrink goal when user font is too big for stage width; null = never auto-shrink
 */
export function fitTypographyToStage(
  stageW: number,
  stageH: number,
  userFontPx: number,
  userLineScale: number,
  measure: (fontPx: number, lineScale: number) => CellMetrics,
  opts?: {
    /** VT classic width; default 80. Pass null to disable auto-shrink entirely. */
    classicCols?: number | null;
    /**
     * Readable floor as a fraction of user preference (default 0.72).
     * Absolute floor never below 10px (accessibility).
     */
    minFontRatio?: number;
  },
): FitTypographyResult {
  const classic =
    opts?.classicCols === null
      ? null
      : (opts?.classicCols ?? VT_CLASSIC_COLS);
  const minRatio = opts?.minFontRatio ?? 0.72;
  const minFont = Math.max(10, Math.round(userFontPx * minRatio * 2) / 2);

  const gridAt = (S: number, L: number) => {
    const m = measure(S, L);
    const g = clampFitToStage(
      fitTermSize(stageW, stageH, m.cellW, m.cellH),
      stageW,
      stageH,
      m.cellW,
      m.cellH,
    );
    return { ...g, ...m, fontSizePx: S, lineHeightScale: L };
  };

  // 1) Prefer user typography (desktop / wide enough)
  let best = gridAt(userFontPx, userLineScale);
  if (classic == null || best.cols >= classic || stageW < 1 || stageH < 1) {
    return best.cols < 1 || best.rows < 1
      ? {
          fontSizePx: userFontPx,
          lineHeightScale: userLineScale,
          cellW: best.cellW || 9,
          cellH: best.cellH || 18,
          cols: Math.max(1, best.cols),
          rows: Math.max(1, best.rows),
        }
      : best;
  }

  // 2) User font too big for classic width: largest S in [minFont, user] with cols >= classic
  const atMin = gridAt(minFont, userLineScale);
  if (atMin.cols < classic) {
    // Cannot reach classic even at floor — fill stage at readable floor
    return atMin;
  }

  let lo = minFont;
  let hi = userFontPx;
  best = atMin;
  // binary search largest font that still yields classic cols
  for (let i = 0; i < 16 && hi - lo > 0.25; i++) {
    const mid = Math.round(((lo + hi) / 2) * 2) / 2;
    const g = gridAt(mid, userLineScale);
    if (g.cols >= classic) {
      best = g;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // 3) Optionally tighten line scale so short stages get more rows (geometry-derived)
  //    L_max for at least ~H/cellH growth: keep user line if rows already OK.
  //    Only reduce L when rows are very few relative to height budget at this font.
  if (best.rows < 8 && userLineScale > 1.05) {
    const tighter = Math.max(1.05, Math.round(userLineScale * 0.9 * 100) / 100);
    const g2 = gridAt(best.fontSizePx, tighter);
    if (g2.rows > best.rows) best = g2;
  }

  return best;
}
