import { describe, expect, it } from "vitest";
import { ScreenBuffer } from "../src/buffer.js";
import { Canvas2DRenderer } from "../src/canvas2d.js";

function fakeCanvas(opts?: { latinWidth?: number; cjkWidth?: number }) {
  const text: string[] = [];
  const scales: number[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    textBaseline: "top",
    textAlign: "left",
    measureText: (value: string) => ({
      width:
        value === "中"
          ? (opts?.cjkWidth ?? 7.2)
          : (opts?.latinWidth ?? 3.6),
    }),
    setTransform: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    translate: () => undefined,
    scale: (x: number) => scales.push(x),
    fillRect: () => undefined,
    fillText: (value: string) => text.push(value),
  };
  const canvas = {
    width: 0,
    height: 0,
    style: { width: "", height: "" },
    getContext: () => ctx,
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, text, scales };
}

describe("Canvas2DRenderer compact 80-column paint", () => {
  it("measures and draws the actual 6px font without silently clamping to 10px", () => {
    const renderer = new Canvas2DRenderer();
    const { canvas, text } = fakeCanvas();
    renderer.mount(canvas);

    const metrics = renderer.measureCellMetrics(6, 1.2);
    expect(metrics).toEqual({ cellW: 3.6, cellH: 8 });

    renderer.setTypography({ fontFamily: "monospace", fontSizePx: 6 });
    renderer.setCellMetrics(metrics.cellW, metrics.cellH);
    const buffer = new ScreenBuffer(80, 24);
    buffer.writeDecoded("look");
    renderer.draw(buffer);

    expect(canvas.style.width).toBe("288px");
    expect(text.join("")).toContain("look");
  });

  it("preserves content and repaints after viewport shrink then grow", () => {
    const renderer = new Canvas2DRenderer();
    const { canvas, text } = fakeCanvas();
    renderer.mount(canvas);
    renderer.setTypography({ fontFamily: "monospace", fontSizePx: 6 });
    renderer.setCellMetrics(3.6, 8);
    const buffer = new ScreenBuffer(80, 24);
    buffer.writeDecoded("north");
    renderer.draw(buffer);
    const firstPaintCount = text.length;

    buffer.resize(80, 12);
    renderer.draw(buffer);
    buffer.resize(80, 40);
    renderer.draw(buffer);

    expect(buffer.cols).toBe(80);
    expect(buffer.snapshotText()).toContain("north");
    expect(text.length).toBeGreaterThan(firstPaintCount);
    expect(canvas.style.height).toBe("320px");
  });

  it("scales painted glyphs when compact cell width is below measured ink", () => {
    const renderer = new Canvas2DRenderer();
    const { canvas, scales } = fakeCanvas({ latinWidth: 3.6, cjkWidth: 10 });
    renderer.mount(canvas);
    renderer.setTypography({
      fontFamily: "monospace",
      fontSizePx: 6,
      cellWidthScale: 0.8,
    });
    const metrics = renderer.measureCellMetrics(6, 1.2);
    expect(metrics.cellW).toBe(4);
    expect(10 * 0.8).toBeLessThanOrEqual(metrics.cellW * 2);
    renderer.setCellMetrics(metrics.cellW, metrics.cellH);
    const buffer = new ScreenBuffer(80, 24);
    buffer.writeDecoded("中A");

    renderer.draw(buffer);

    expect(scales).toContain(0.8);
  });
});
