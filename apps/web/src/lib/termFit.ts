/**
 * Terminal grid fit for mudgate play.
 *
 * Policy (hetero codex gpt-5.6-sol + Qwen3.8-Max 2026-07-22):
 * - Lock cols = 80 (VT / map_d).
 * - **Only shrink fontSize** until measure(S).cellW * 80 <= stageW.
 * - **Never** set cellW < measured advance (that causes glyph overlap).
 * - cellH only from metrics at the same S.
 * - If 80 still impossible at abs min font: keep measured pitch + cols=80;
 *   stage must allow horizontal scroll (caller).
 */

export type TermFit = { cols: number; rows: number };

export type CellMetrics = { cellW: number; cellH: number };

export type FitTypographyResult = {
  fontSizePx: number;
  lineHeightScale: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  /** True when 80×cellW > stageW even at min font — need overflow-x scroll */
  needsHScroll: boolean;
};

/**
 * Soft keyboards are a temporary visual occlusion, not a remote terminal
 * geometry change. Keep the live grid intact until the full viewport returns.
 */
export function resolveTerminalGrid(
  fitted: Pick<FitTypographyResult, "cols" | "rows">,
  current: TermFit,
  keyboardOpen: boolean,
): TermFit {
  return keyboardOpen
    ? { cols: VT_CLASSIC_COLS, rows: current.rows }
    : { cols: VT_CLASSIC_COLS, rows: fitted.rows };
}

/** Classic teletype / MUD map width (half-width cells). */
export const VT_CLASSIC_COLS = 80;

/** Absolute floor — below this CJK is generally unreadable. */
export const ABS_MIN_FONT_PX = 6;

/**
 * Visual width of the scrollback rail grid column (CSS only).
 * Fit must read **stage** clientWidth after layout — never hostW − this.
 */
export const V_SCROLLBAR_GUTTER_PX = 18;

export const TERM_FIT = {
  minRows: 8,
  maxCols: 200,
  maxRows: 80,
  defaultCols: VT_CLASSIC_COLS,
  defaultRows: 28,
} as const;

export function fitTermSize(
  cssW: number,
  cssH: number,
  cellW: number,
  cellH: number,
): TermFit {
  const cw = Math.max(1, cellW);
  const ch = Math.max(1, cellH);
  if (cssW < 1 || cssH < 1) return { cols: 0, rows: 0 };
  return {
    cols: Math.min(TERM_FIT.maxCols, Math.max(0, Math.floor(cssW / cw))),
    rows: Math.min(TERM_FIT.maxRows, Math.max(0, Math.floor(cssH / ch))),
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
 * @param measure returns cell metrics for exact (fontPx, lineScale) — advance must match draw()
 */
export function fitTypographyToStage(
  stageW: number,
  stageH: number,
  userFontPx: number,
  userLineScale: number,
  measure: (fontPx: number, lineScale: number) => CellMetrics,
  opts?: {
    classicCols?: number | null;
  },
): FitTypographyResult {
  const classic =
    opts?.classicCols === null
      ? null
      : (opts?.classicCols ?? VT_CLASSIC_COLS);
  const L = userLineScale;
  const minFont = ABS_MIN_FONT_PX;

  // Free-form: xterm style, no col lock
  if (classic == null) {
    const m = measure(userFontPx, L);
    const g = clampFitToStage(
      fitTermSize(stageW, stageH, m.cellW, m.cellH),
      stageW,
      stageH,
      m.cellW,
      m.cellH,
    );
    return {
      fontSizePx: userFontPx,
      lineHeightScale: L,
      cellW: m.cellW,
      cellH: m.cellH,
      cols: Math.max(1, g.cols),
      rows: Math.max(TERM_FIT.minRows, g.rows),
      needsHScroll: false,
    };
  }

  const cols = classic;
  const packs = (S: number) => {
    const m = measure(S, L);
    // INVARIANT: use measured cellW only — never invent a smaller pitch.
    // Canvas and CSS both retain fractional widths, so an exact 80-cell fit
    // must not create an unnecessary horizontal scrollbar.
    return { m, ok: m.cellW * cols <= Math.max(0, stageW) + 0.01 };
  };

  let S = userFontPx;
  const atUser = packs(S);
  if (!atUser.ok) {
    const atMin = packs(minFont);
    if (!atMin.ok) {
      // Cannot fit 80 measured cells — keep pitch honest; h-scroll
      const m = atMin.m;
      const rows = Math.max(
        TERM_FIT.minRows,
        Math.floor(stageH / Math.max(1, m.cellH)),
      );
      return {
        fontSizePx: minFont,
        lineHeightScale: L,
        cellW: m.cellW,
        cellH: m.cellH,
        cols,
        rows: Math.min(TERM_FIT.maxRows, rows),
        needsHScroll: true,
      };
    }
    // Binary search largest S in [minFont, userFont] that packs 80 measured cells
    let lo = minFont;
    let hi = userFontPx;
    S = minFont;
    for (let i = 0; i < 18 && hi - lo > 0.25; i++) {
      const mid = Math.round(((lo + hi) / 2) * 2) / 2;
      if (packs(mid).ok) {
        S = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }

  const m = measure(S, L);
  // Never assign cellW smaller than measure — that was the overlap bug
  const cellW = m.cellW;
  const cellH = m.cellH;
  const rows = Math.max(
    TERM_FIT.minRows,
    Math.min(TERM_FIT.maxRows, Math.floor(stageH / Math.max(1, cellH))),
  );
  const needsHScroll = cellW * cols > stageW + 0.01;

  return {
    fontSizePx: S,
    lineHeightScale: L,
    cellW,
    cellH,
    cols,
    rows,
    needsHScroll,
  };
}
