import type { ScreenBuffer } from "./buffer.js";
import type { Attrs } from "@assmud/vt";

const ANSI_FG = [
  "#000",
  "#a00",
  "#0a0",
  "#a50",
  "#00a",
  "#a0a",
  "#0aa",
  "#aaa",
  "#555",
  "#f55",
  "#5f5",
  "#ff5",
  "#55f",
  "#f5f",
  "#5ff",
  "#fff",
];

function colorFor(attrs: Attrs): { fg: string; bg: string } {
  let fg = attrs.fg != null ? ANSI_FG[attrs.fg] ?? "#ccc" : "#ccc";
  let bg = attrs.bg != null ? ANSI_FG[attrs.bg] ?? "#111" : "#111";
  if (attrs.bold && attrs.fg != null && attrs.fg < 8) {
    fg = ANSI_FG[attrs.fg + 8] ?? fg;
  }
  if (attrs.reverse) {
    const t = fg;
    fg = bg;
    bg = t;
  }
  return { fg, bg };
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cellW = 9;
  private cellH = 16;

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
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${this.cellH - 2}px ui-monospace, monospace`;
    ctx.textBaseline = "top";
    for (let r = 0; r < buf.rows; r++) {
      for (let c = 0; c < buf.cols; c++) {
        const cell = buf.cells[r]![c]!;
        const { fg, bg } = colorFor(cell.attrs);
        if (bg !== "#111") {
          ctx.fillStyle = bg;
          ctx.fillRect(c * this.cellW, r * this.cellH, this.cellW, this.cellH);
        }
        if (cell.ch !== " ") {
          ctx.fillStyle = fg;
          ctx.fillText(cell.ch, c * this.cellW, r * this.cellH + 1);
        }
      }
    }
  }
}
