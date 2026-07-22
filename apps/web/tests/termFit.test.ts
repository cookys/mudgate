import { describe, it, expect } from "vitest";
import {
  clampFitToStage,
  fitTermSize,
  fitTypographyToStage,
  TERM_FIT,
  VT_CLASSIC_COLS,
} from "../src/lib/termFit";

/** Linear mono model for tests: cellW ≈ 0.6*S, cellH ≈ S*L */
function fakeMeasure(S: number, L: number) {
  return {
    cellW: Math.max(6, Math.ceil(S * 0.6)),
    cellH: Math.max(12, Math.round(S * L)),
  };
}

describe("fitTermSize", () => {
  it("floors grid to fit viewport without clipping", () => {
    expect(fitTermSize(900, 540, 9, 18)).toEqual({ cols: 100, rows: 30 });
  });

  it("never inflates cols/rows past what physically fits", () => {
    const tiny = fitTermSize(50, 50, 9, 18);
    expect(tiny.cols).toBe(Math.floor(50 / 9));
    expect(tiny.rows).toBe(Math.floor(50 / 18));
  });

  it("zero geometry returns 0 grid (caller keeps previous)", () => {
    expect(fitTermSize(0, 100, 9, 18)).toEqual({ cols: 0, rows: 0 });
  });

  it("clampFitToStage trims overflow", () => {
    const c = clampFitToStage({ cols: 100, rows: 50 }, 360, 200, 10, 18);
    expect(c.cols * 10).toBeLessThanOrEqual(360);
    expect(c.rows * 18).toBeLessThanOrEqual(200);
  });
});

describe("fitTypographyToStage (no magic phone targets)", () => {
  it("keeps user font when stage already fits classic 80 cols (desktop)", () => {
    // Wide stage: 15px → cellW=9 → 1200/9=133 cols
    const r = fitTypographyToStage(1200, 600, 15, 1.2, fakeMeasure);
    expect(r.fontSizePx).toBe(15);
    expect(r.cols).toBeGreaterThanOrEqual(VT_CLASSIC_COLS);
  });

  it("shrinks only enough to reach classic 80 when stage is narrow", () => {
    // 400px wide, 15px → cellW=9 → 44 cols < 80
    // At 11px → cellW=7 → 57 cols still < 80 with ratio 0.72 min ~11
    // Need smaller: minFont = max(10, 15*0.72)=10.8→11, cellW=7 → still 57
    // So falls to min font and fills — cols = floor(400/7)=57
    const r = fitTypographyToStage(400, 500, 15, 1.2, fakeMeasure);
    expect(r.fontSizePx).toBeLessThanOrEqual(15);
    expect(r.cols * r.cellW).toBeLessThanOrEqual(400);
    expect(r.rows * r.cellH).toBeLessThanOrEqual(500);
  });

  it("with classicCols null never auto-shrinks (pure xterm)", () => {
    const r = fitTypographyToStage(400, 500, 15, 1.2, fakeMeasure, {
      classicCols: null,
    });
    expect(r.fontSizePx).toBe(15);
    expect(r.cols).toBe(Math.floor(400 / Math.ceil(15 * 0.6)));
  });

  it("wide enough for 80 at user font does not shrink", () => {
    // 80 * 9 = 720
    const r = fitTypographyToStage(720, 400, 15, 1.2, fakeMeasure);
    expect(r.fontSizePx).toBe(15);
    expect(r.cols).toBeGreaterThanOrEqual(80);
  });

  it("exposes VT_CLASSIC_COLS as 80 (semantic, not a phone constant)", () => {
    expect(VT_CLASSIC_COLS).toBe(80);
    expect(TERM_FIT.maxCols).toBeGreaterThan(VT_CLASSIC_COLS);
  });
});
