import type { ScreenBuffer } from "./buffer.js";
import type { Attrs } from "@assmud/vt";

/** Soft ANSI 16 — less 90s VGA, more ink terminal */
const ANSI_FG = [
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

const VOID = "#0a0b0e";

function colorFor(attrs: Attrs): { fg: string; bg: string } {
  let fg = attrs.fg != null ? ANSI_FG[attrs.fg] ?? "#c8cdd5" : "#c8cdd5";
  let bg = attrs.bg != null ? ANSI_FG[attrs.bg] ?? VOID : VOID;
  if (attrs.bold && attrs.fg != null && attrs.fg < 8) {
    fg = ANSI_FG[attrs.fg + 8] ?? fg;
  }
  if (attrs.dim) {
    fg = fg + "99";
  }
  if (attrs.reverse) {
    const t = fg;
    fg = bg === VOID ? "#c8cdd5" : bg;
    bg = t;
  }
  return { fg, bg };
}

export type SelectionRange = {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
};

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

  /**
   * Apply typography for dual-width mono stacks.
   * fontFamily should already be a full CSS stack (primary + TC fallbacks).
   */
  setTypography(opts: {
    fontFamily: string;
    fontSizePx?: number;
    cellWidthScale?: number;
    lineHeightScale?: number;
    letterSpacingPx?: number;
  }): void {
    this.fontFamily = opts.fontFamily;
    const size = opts.fontSizePx ?? 15;
    const lineScale = opts.lineHeightScale ?? 1.2;
    const widthScale = opts.cellWidthScale ?? 1;
    this.cellH = Math.max(12, Math.round(size * lineScale));
    // half-width cell ≈ 0.6em of font size (mono heuristic), then scale
    this.cellW = Math.max(6, Math.round(size * 0.6 * widthScale + (opts.letterSpacingPx ?? 0)));
  }

  /** alignScore ≈ width(中)/width(M); ideal ~2.0 for dual-width. */
  measureAlignScore(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const fontPx = Math.max(10, this.cellH - 4);
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

    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, cssW, cssH);

    const fontPx = Math.max(10, this.cellH - 4);
    ctx.font = `500 ${fontPx}px ${this.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const off = Math.max(0, Math.min(scrollOffset, buf.scrollbackDepth()));

    for (let r = 0; r < buf.rows; r++) {
      // Continuous history: [scrollback tail…] then live cells[0…]
      const hist = buf.scrollbackViewLine(off, r);
      if (hist != null) {
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
          col += 1;
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

    // Selection only on live viewport
    if (selection && off === 0) {
      this.paintSelection(ctx, buf, selection);
    }
  }

  private paintSelection(
    ctx: CanvasRenderingContext2D,
    buf: ScreenBuffer,
    sel: SelectionRange,
  ): void {
    // linear selection highlight
    let sr = sel.r0;
    let sc = sel.c0;
    let er = sel.r1;
    let ec = sel.c1;
    if (sr > er || (sr === er && sc > ec)) {
      sr = sel.r1;
      sc = sel.c1;
      er = sel.r0;
      ec = sel.c0;
    }
    sr = Math.max(0, Math.min(buf.rows - 1, sr));
    er = Math.max(0, Math.min(buf.rows - 1, er));
    sc = Math.max(0, Math.min(buf.cols - 1, sc));
    ec = Math.max(0, Math.min(buf.cols - 1, ec));

    ctx.fillStyle = "rgba(91, 157, 255, 0.32)";
    for (let r = sr; r <= er; r++) {
      const ca = r === sr ? sc : 0;
      const cb = r === er ? ec : buf.cols - 1;
      ctx.fillRect(
        ca * this.cellW,
        r * this.cellH,
        (cb - ca + 1) * this.cellW,
        this.cellH,
      );
    }
  }
}
