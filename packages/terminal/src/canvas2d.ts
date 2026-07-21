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

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cellW = 9;
  private cellH = 18;

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }

  draw(buf: ScreenBuffer): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const w = buf.cols * this.cellW;
    const h = buf.rows * this.cellH;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `500 ${this.cellH - 4}px "JetBrains Mono", "Noto Sans Mono", ui-monospace, monospace`;
    ctx.textBaseline = "top";
    for (let r = 0; r < buf.rows; r++) {
      for (let c = 0; c < buf.cols; c++) {
        const cell = buf.cells[r]![c]!;
        const { fg, bg } = colorFor(cell.attrs);
        if (bg !== VOID) {
          ctx.fillStyle = bg;
          ctx.fillRect(c * this.cellW, r * this.cellH, this.cellW, this.cellH);
        }
        if (cell.ch && cell.ch !== " ") {
          ctx.fillStyle = fg;
          ctx.fillText(cell.ch, c * this.cellW, r * this.cellH + 2);
        }
      }
    }
  }
}
