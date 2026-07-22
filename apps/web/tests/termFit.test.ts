import { describe, it, expect } from "vitest";
import { clampFitToStage, fitTermSize, TERM_FIT } from "../src/lib/termFit";

describe("fitTermSize", () => {
  it("floors grid to fit viewport without clipping", () => {
    // 900×540 CSS px at 9×18 cell → 100×30
    expect(fitTermSize(900, 540, 9, 18)).toEqual({ cols: 100, rows: 30 });
  });

  it("never inflates cols/rows past what physically fits", () => {
    // 50×50 CSS → floor 5×2 cells; must not force preferred min 40×12
    const tiny = fitTermSize(50, 50, 9, 18);
    expect(tiny.cols).toBe(Math.floor(50 / 9));
    expect(tiny.rows).toBe(Math.floor(50 / 18));

    const huge = fitTermSize(10_000, 10_000, 9, 18);
    expect(huge.cols).toBe(TERM_FIT.maxCols);
    expect(huge.rows).toBe(TERM_FIT.maxRows);
  });

  it("never claims more rows than fit (bottom-half clip bug)", () => {
    const r = fitTermSize(720, 15 * 18 + 5, 9, 18);
    expect(r.rows).toBeLessThanOrEqual(15);
    expect(r.rows).toBe(15);
  });

  it("keyboard-sized stage can go below preferred min rows", () => {
    const r = fitTermSize(360, 6 * 18 + 2, 9, 18);
    expect(r.rows).toBeLessThan(TERM_FIT.preferredMinRows);
    expect(r.rows).toBe(6);
  });

  it("clampFitToStage trims overflow cols/rows", () => {
    const c = clampFitToStage({ cols: 100, rows: 50 }, 360, 200, 10, 18);
    expect(c.cols * 10).toBeLessThanOrEqual(360);
    expect(c.rows * 18).toBeLessThanOrEqual(200);
  });
});
