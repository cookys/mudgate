import { describe, it, expect } from "vitest";
import {
  clampFitToStage,
  fitTermSize,
  fitTypographyToStage,
  VT_CLASSIC_COLS,
} from "../src/lib/termFit";

function fakeMeasure(S: number, L: number) {
  return {
    cellW: Math.max(6, Math.ceil(S * 0.6)),
    cellH: Math.max(12, Math.round(S * L)),
  };
}

describe("fitTermSize", () => {
  it("floors grid to fit viewport", () => {
    expect(fitTermSize(900, 540, 9, 18)).toEqual({ cols: 100, rows: 30 });
  });

  it("clampFitToStage trims overflow", () => {
    const c = clampFitToStage({ cols: 100, rows: 50 }, 360, 200, 10, 18);
    expect(c.cols * 10).toBeLessThanOrEqual(360);
    expect(c.rows * 18).toBeLessThanOrEqual(200);
  });
});

describe("fitTypographyToStage — always lock 80 cols for MUD", () => {
  it("locks cols to 80 on wide desktop without shrinking font", () => {
    // 15px → cellW=9; 80*9=720 fits in 1200
    const r = fitTypographyToStage(1200, 600, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(VT_CLASSIC_COLS);
    expect(r.fontSizePx).toBe(15);
    expect(r.cols * r.cellW).toBeLessThanOrEqual(1200);
  });

  it("locks cols to 80 on narrow portrait (shrink or force cellW)", () => {
    const r = fitTypographyToStage(360, 500, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cols * r.cellW).toBeLessThanOrEqual(360);
    expect(r.rows).toBeGreaterThanOrEqual(1);
  });

  it("locks cols to 80 on short landscape too", () => {
    const r = fitTypographyToStage(800, 280, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cols * r.cellW).toBeLessThanOrEqual(800);
  });

  it("classicCols null is free-form (xterm)", () => {
    const r = fitTypographyToStage(400, 500, 15, 1.2, fakeMeasure, {
      classicCols: null,
    });
    expect(r.fontSizePx).toBe(15);
    expect(r.cols).not.toBe(80);
  });
});
