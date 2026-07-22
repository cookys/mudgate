import { describe, it, expect } from "vitest";
import {
  fitTypographyToStage,
  VT_CLASSIC_COLS,
  ABS_MIN_FONT_PX,
} from "../src/lib/termFit";

function fakeMeasure(S: number, L: number) {
  return {
    cellW: Math.max(6, Math.ceil(S * 0.6)),
    cellH: Math.max(12, Math.round(S * L)),
  };
}

describe("fitTypographyToStage — never squeeze pitch below measure", () => {
  it("locks 80 cols and keeps measured cellW on wide stage", () => {
    const r = fitTypographyToStage(1200, 600, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(VT_CLASSIC_COLS);
    expect(r.fontSizePx).toBe(15);
    expect(r.cellW).toBe(Math.ceil(15 * 0.6));
    expect(r.needsHScroll).toBe(false);
  });

  it("shrinks font so measured cellW*80 fits — never cellW < measure(S)", () => {
    // 481px stage (1px slack): need cellW*80 <= 480 → cellW <= 6 → S <= 10
    const r = fitTypographyToStage(481, 500, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cellW * 80).toBeLessThanOrEqual(481);
    const m = fakeMeasure(r.fontSizePx, r.lineHeightScale);
    expect(r.cellW).toBe(m.cellW);
    expect(r.needsHScroll).toBe(false);
  });

  it("at impossible width: keep measured pitch + needsHScroll (no squeeze)", () => {
    // 200px: even S=6 → cellW=6 → 480 > 200
    const r = fitTypographyToStage(200, 400, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    const m = fakeMeasure(r.fontSizePx, 1.2);
    expect(r.cellW).toBe(m.cellW);
    expect(r.cellW * 80).toBeGreaterThan(200);
    expect(r.needsHScroll).toBe(true);
    expect(r.fontSizePx).toBeGreaterThanOrEqual(ABS_MIN_FONT_PX);
  });

  it("cellH only from metrics at same S", () => {
    const r = fitTypographyToStage(800, 300, 15, 1.2, fakeMeasure);
    expect(r.cellH).toBe(fakeMeasure(r.fontSizePx, r.lineHeightScale).cellH);
  });
});
