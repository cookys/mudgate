import type { ScreenBuffer } from "./buffer.js";
import { colorFor, VOID_BG } from "./colors.js";
import { isWide } from "./width.js";

const VOID = VOID_BG;

/**
 * Selection in **document** (absolute) row coordinates:
 * - abs row 0..scrollbackDepth-1 = history lines
 * - abs row scrollbackDepth..scrollbackDepth+rows-1 = live cells
 * Viewport paint converts via scrollOffset.
 */
export type SelectionRange = {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
};

/** Viewport row → absolute document row for current scroll. */
export function viewportToAbs(
  scrollbackLen: number,
  scrollOffset: number,
  viewRow: number,
): number {
  return scrollbackLen - scrollOffset + viewRow;
}

/** Absolute document row → viewport row, or null if off-screen. */
export function absToViewport(
  scrollbackLen: number,
  scrollOffset: number,
  rows: number,
  absRow: number,
): number | null {
  const viewRow = absRow - (scrollbackLen - scrollOffset);
  if (viewRow < 0 || viewRow >= rows) return null;
  return viewRow;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  /** CSS pixel size of one half-width cell */
  cellW = 9;
  cellH = 18;
  private dpr = 1;
  private fontFamily =
    '"Sarasa Mono TC", "Sarasa Term TC", "Noto Sans Mono CJK TC", "Noto Sans Mono", ui-monospace, monospace';
  /** last draw buffer size for hit-test clamp */
  private lastCols = 80;
  private lastRows = 28;

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }

  setFontFamily(family: string): void {
    this.fontFamily = family;
  }

  private widthScale = 1;
  private letterSpacingPx = 0;
  /** Exact CSS px used in draw() — do not reverse from cellH. */
  fontSizePx = 15;
  lineHeightScale = 1.2;

  /**
   * Apply typography for dual-width mono stacks.
   * fontFamily should already be a full CSS stack (primary + TC fallbacks).
   * Cell width prefers **measured** mono advance (never under-estimate — that
   * makes cols×cellW wider than the stage and clips MUD text on phones).
   */
  setTypography(opts: {
    fontFamily: string;
    fontSizePx?: number;
    cellWidthScale?: number;
    lineHeightScale?: number;
    letterSpacingPx?: number;
  }): void {
    this.fontFamily = opts.fontFamily;
    this.fontSizePx = opts.fontSizePx ?? 15;
    this.lineHeightScale = opts.lineHeightScale ?? 1.2;
    this.widthScale = opts.cellWidthScale ?? 1;
    this.letterSpacingPx = opts.letterSpacingPx ?? 0;
    this.cellH = Math.max(12, Math.round(this.fontSizePx * this.lineHeightScale));
    this.recomputeCellWidth();
  }

  /**
   * Re-measure half-width cell from real font metrics at **stored fontSizePx**.
   * Uses ceil so grid never claims more columns than glyphs can paint without overflow.
   */
  recomputeCellWidth(): void {
    const fontPx = Math.max(10, this.fontSizePx);
    const heuristic = Math.max(
      6,
      Math.round(fontPx * 0.6 * this.widthScale + this.letterSpacingPx),
    );
    this.cellH = Math.max(12, Math.round(fontPx * this.lineHeightScale));
    const ctx = this.ctx;
    if (!ctx) {
      this.cellW = heuristic;
      return;
    }
    ctx.font = `500 ${fontPx}px ${this.fontFamily}`;
    const wM = ctx.measureText("M").width || 0;
    const w0 = ctx.measureText("0").width || 0;
    const wW = ctx.measureText("W").width || 0;
    const measured = Math.max(wM, w0, wW);
    if (measured < 4) {
      this.cellW = heuristic;
      return;
    }
    this.cellW = Math.max(
      6,
      Math.ceil(measured * this.widthScale + this.letterSpacingPx),
    );
  }

  /** Measure cell metrics for a candidate size without permanently applying it. */
  measureCellMetrics(
    fontPx: number,
    lineScale: number,
  ): { cellW: number; cellH: number } {
    const size = Math.max(10, fontPx);
    const cellH = Math.max(12, Math.round(size * lineScale));
    const heuristic = Math.max(
      6,
      Math.round(size * 0.6 * this.widthScale + this.letterSpacingPx),
    );
    const ctx = this.ctx;
    if (!ctx) return { cellW: heuristic, cellH };
    ctx.font = `500 ${size}px ${this.fontFamily}`;
    const wM = ctx.measureText("M").width || 0;
    const w0 = ctx.measureText("0").width || 0;
    const wW = ctx.measureText("W").width || 0;
    const measured = Math.max(wM, w0, wW);
    const cellW =
      measured < 4
        ? heuristic
        : Math.max(6, Math.ceil(measured * this.widthScale + this.letterSpacingPx));
    return { cellW, cellH };
  }

  /** alignScore ≈ width(中)/width(M); ideal ~2.0 for dual-width. */
  measureAlignScore(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const fontPx = Math.max(10, this.fontSizePx);
    ctx.font = `500 ${fontPx}px ${this.fontFamily}`;
    const wM = ctx.measureText("M").width || 1;
    const wC = ctx.measureText("中").width || 0;
    return wC / wM;
  }

  /** Map pointer client coords → cell index. */
  hitTest(clientX: number, clientY: number): { r: number; c: number } | null {
    const canvas = this.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * this.lastCols * this.cellW;
    const y = ((clientY - rect.top) / rect.height) * this.lastRows * this.cellH;
    const c = Math.floor(x / this.cellW);
    const r = Math.floor(y / this.cellH);
    if (r < 0 || c < 0 || r >= this.lastRows || c >= this.lastCols) return null;
    return { r, c };
  }

  private syncBackingStore(cssW: number, cssH: number): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    this.dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const bw = Math.max(1, Math.round(cssW * this.dpr));
    const bh = Math.max(1, Math.round(cssH * this.dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /**
   * @param scrollOffset lines above live bottom (0 = follow live screen).
   * When > 0, top rows are filled from plain scrollback history.
   */
  draw(
    buf: ScreenBuffer,
    selection?: SelectionRange | null,
    scrollOffset = 0,
  ): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    this.lastCols = buf.cols;
    this.lastRows = buf.rows;
    const cssW = buf.cols * this.cellW;
    const cssH = buf.rows * this.cellH;
    this.syncBackingStore(cssW, cssH);

    // Clip glyph ink that extends past the last cell (CJK / box-drawing)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cssW, cssH);
    ctx.clip();

    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, cssW, cssH);

    const fontPx = Math.max(10, this.fontSizePx);
    ctx.font = `500 ${fontPx}px ${this.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const off = Math.max(0, Math.min(scrollOffset, buf.scrollbackDepth()));
    const sbLen = buf.scrollbackDepth();

    for (let r = 0; r < buf.rows; r++) {
      // Continuous history: [scrollback tail…] then live cells[0…]
      const hist = buf.scrollbackViewLine(off, r);
      if (hist != null) {
        // Dim history; respect dual-width (same as live buffer paint)
        ctx.fillStyle = "#7a808c";
        let col = 0;
        for (const ch of hist) {
          if (col >= buf.cols) break;
          if (ch !== " ") {
            ctx.fillText(
              ch,
              Math.round(col * this.cellW),
              Math.round(r * this.cellH + 1),
            );
          }
          col += isWide(ch, buf.widthMode) ? 2 : 1;
        }
        continue;
      }
      const cr = r - off;
      if (cr < 0 || cr >= buf.rows) continue;
      for (let c = 0; c < buf.cols; c++) {
        const cell = buf.cells[cr]![c]!;
        const { fg, bg } = colorFor(cell.attrs);
        const x = c * this.cellW;
        const y = r * this.cellH;
        if (bg !== VOID) {
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, this.cellW, this.cellH);
        }
        if (cell.ch && cell.ch !== " ") {
          ctx.fillStyle = fg;
          ctx.fillText(cell.ch, Math.round(x), Math.round(y + 1));
        }
      }
    }

    if (selection) {
      this.paintSelection(ctx, buf, selection, off, sbLen);
    }
    ctx.restore();
  }

  private paintSelection(
    ctx: CanvasRenderingContext2D,
    buf: ScreenBuffer,
    sel: SelectionRange,
    scrollOffset: number,
    sbLen: number,
  ): void {
    // Selection stored as absolute document rows; map into viewport
    let ar0 = sel.r0;
    let sc = sel.c0;
    let ar1 = sel.r1;
    let ec = sel.c1;
    if (ar0 > ar1 || (ar0 === ar1 && sc > ec)) {
      ar0 = sel.r1;
      sc = sel.c1;
      ar1 = sel.r0;
      ec = sel.c0;
    }
    const maxAbs = sbLen + buf.rows - 1;
    ar0 = Math.max(0, Math.min(maxAbs, ar0));
    ar1 = Math.max(0, Math.min(maxAbs, ar1));
    sc = Math.max(0, Math.min(buf.cols - 1, sc));
    ec = Math.max(0, Math.min(buf.cols - 1, ec));

    ctx.fillStyle = "rgba(91, 157, 255, 0.32)";
    for (let abs = ar0; abs <= ar1; abs++) {
      const vr = absToViewport(sbLen, scrollOffset, buf.rows, abs);
      if (vr == null) continue;
      const ca = abs === ar0 ? sc : 0;
      const cb = abs === ar1 ? ec : buf.cols - 1;
      ctx.fillRect(
        ca * this.cellW,
        vr * this.cellH,
        (cb - ca + 1) * this.cellW,
        this.cellH,
      );
    }
  }
}
