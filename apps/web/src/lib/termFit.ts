/** Terminal grid fit — geometry + metrics; MUD policy locks cols to VT 80. */

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
 * Classic teletype / MUD map width (half-width cells).
 * Always used as the **locked column count** for mudgate play (portrait + landscape).
 */
export const VT_CLASSIC_COLS = 80;

export const TERM_FIT = {
  maxCols: 200,
  maxRows: 80,
  defaultCols: VT_CLASSIC_COLS,
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
 * MUD play fit: **always lock cols = classicCols (default 80)** so map_d / banners
 * match authoring width. Portrait and landscape both keep 80.
 *
 * Font: largest S in [minFont, userFont] such that measure(S).cellW * 80 <= stageW.
 * If even minFont is too wide, force cellW = stageW/80 (layout) so 80 still fits;
 * glyphs may be slightly tight but NAWS stays 80.
 *
 * Rows: floor(stageH / cellH) at the chosen font (vertical scrollbar covers history).
 */
export function fitTypographyToStage(
  stageW: number,
  stageH: number,
  userFontPx: number,
  userLineScale: number,
  measure: (fontPx: number, lineScale: number) => CellMetrics,
  opts?: {
    /** Locked column count; default 80. Pass null only for free-form desktop experiments. */
    classicCols?: number | null;
    minFontRatio?: number;
  },
): FitTypographyResult {
  const classic =
    opts?.classicCols === null
      ? null
      : (opts?.classicCols ?? VT_CLASSIC_COLS);
  const minRatio = opts?.minFontRatio ?? 0.65;
  const minFont = Math.max(10, Math.round(userFontPx * minRatio * 2) / 2);

  // Free-form (no lock): xterm style
  if (classic == null) {
    const m = measure(userFontPx, userLineScale);
    const g = clampFitToStage(
      fitTermSize(stageW, stageH, m.cellW, m.cellH),
      stageW,
      stageH,
      m.cellW,
      m.cellH,
    );
    return {
      fontSizePx: userFontPx,
      lineHeightScale: userLineScale,
      cellW: m.cellW,
      cellH: m.cellH,
      cols: Math.max(1, g.cols),
      rows: Math.max(1, g.rows),
    };
  }

  const colsTarget = classic;
  const L = userLineScale;

  const fits = (S: number) => {
    const m = measure(S, L);
    return m.cellW * colsTarget <= stageW + 0.5;
  };

  // Prefer user font when 80 cols fit
  let S = userFontPx;
  if (!fits(S)) {
    if (!fits(minFont)) {
      // Force 80 cols into width: derive cellW from geometry
      const m = measure(minFont, L);
      const cellW = Math.max(4, Math.floor(stageW / colsTarget));
      const cellH = m.cellH;
      const rows = Math.max(1, Math.floor(stageH / Math.max(1, cellH)));
      return {
        fontSizePx: minFont,
        lineHeightScale: L,
        cellW,
        cellH,
        cols: colsTarget,
        rows: Math.min(TERM_FIT.maxRows, rows),
      };
    }
    // Binary search largest font that packs 80 cells into stageW
    let lo = minFont;
    let hi = userFontPx;
    S = minFont;
    for (let i = 0; i < 18 && hi - lo > 0.25; i++) {
      const mid = Math.round(((lo + hi) / 2) * 2) / 2;
      if (fits(mid)) {
        S = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }

  const m = measure(S, L);
  // Exact cellW so 80 * cellW <= stageW (use measured, but never overflow)
  let cellW = m.cellW;
  if (cellW * colsTarget > stageW) {
    cellW = Math.max(4, Math.floor(stageW / colsTarget));
  }
  const cellH = m.cellH;
  const rows = Math.max(1, Math.min(TERM_FIT.maxRows, Math.floor(stageH / Math.max(1, cellH))));

  return {
    fontSizePx: S,
    lineHeightScale: L,
    cellW,
    cellH,
    cols: colsTarget,
    rows,
  };
}
