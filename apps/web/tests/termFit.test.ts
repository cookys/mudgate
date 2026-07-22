import { describe, it, expect } from "vitest";
import {
  fitTypographyToStage,
  resolveTerminalGrid,
  VT_CLASSIC_COLS,
  ABS_MIN_FONT_PX,
} from "../src/lib/termFit";

function fakeMeasure(S: number, L: number) {
  return {
    cellW: Math.max(3, Math.ceil(S * 0.6)),
    cellH: Math.max(8, Math.round(S * L)),
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
    // 480px stage: need cellW*80 <= 480 → cellW <= 6 → S <= 10
    const r = fitTypographyToStage(480, 500, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cellW * 80).toBeLessThanOrEqual(480);
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

  it("matches the proxy NAWS minimum of eight rows on a very short stage", () => {
    const r = fitTypographyToStage(360, 32, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.rows).toBe(8);
  });
});

describe("resolveTerminalGrid — keyboard never mutates remote geometry", () => {
  it("keeps rows and 80 columns while keyboard temporarily occludes the stage", () => {
    expect(
      resolveTerminalGrid({ cols: 80, rows: 16 }, { cols: 80, rows: 42 }, true),
    ).toEqual({ cols: 80, rows: 42 });
  });

  it("adopts recovered viewport rows after keyboard closes", () => {
    expect(
      resolveTerminalGrid({ cols: 80, rows: 48 }, { cols: 80, rows: 42 }, false),
    ).toEqual({ cols: 80, rows: 48 });
  });
});

describe("fitTypographyToStage — preserve MUD 80 columns", () => {
  it("keeps classic 80 columns when measured glyphs fit", () => {
    const r = fitTypographyToStage(800, 400, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.needsHScroll).toBe(false);
  });

  it("shrinks typography instead of changing NAWS columns on portrait", () => {
    const r = fitTypographyToStage(360, 600, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cellW * r.cols).toBeLessThanOrEqual(360);
    expect(r.needsHScroll).toBe(false);
  });

  it("keeps 80 columns and contains horizontal scroll only when physically impossible", () => {
    const r = fitTypographyToStage(239, 600, 15, 1.2, fakeMeasure);
    expect(r.cols).toBe(80);
    expect(r.cellW * r.cols).toBeGreaterThan(239);
    expect(r.needsHScroll).toBe(true);
  });

  it("retains fractional advances to avoid unnecessary horizontal scroll", () => {
    const fractionalMeasure = (_S: number, L: number) => ({
      cellW: 3.6,
      cellH: Math.max(8, Math.round(6 * L)),
    });
    const fits = fitTypographyToStage(288, 600, 15, 1.2, fractionalMeasure);
    expect(fits.cols).toBe(80);
    expect(fits.cellW * fits.cols).toBeCloseTo(288);
    expect(fits.needsHScroll).toBe(false);

    const impossible = fitTypographyToStage(
      287,
      600,
      15,
      1.2,
      fractionalMeasure,
    );
    expect(impossible.cols).toBe(80);
    expect(impossible.needsHScroll).toBe(true);
  });
});
