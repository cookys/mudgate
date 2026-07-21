import { describe, it, expect } from "vitest";
import { fitTermSize, TERM_FIT } from "../src/lib/termFit";

describe("fitTermSize", () => {
  it("floors grid to fit viewport without clipping", () => {
    // 900×540 CSS px at 9×18 cell → 100×30
    expect(fitTermSize(900, 540, 9, 18)).toEqual({ cols: 100, rows: 30 });
  });

  it("clamps to min/max", () => {
    const tiny = fitTermSize(50, 50, 9, 18);
    expect(tiny.cols).toBe(TERM_FIT.minCols);
    expect(tiny.rows).toBe(TERM_FIT.minRows);

    const huge = fitTermSize(10_000, 10_000, 9, 18);
    expect(huge.cols).toBe(TERM_FIT.maxCols);
    expect(huge.rows).toBe(TERM_FIT.maxRows);
  });

  it("never claims more rows than fit (bottom-half clip bug)", () => {
    // Stage only ~15 rows tall but old code hardcoded 28
    const r = fitTermSize(720, 15 * 18 + 5, 9, 18);
    expect(r.rows).toBeLessThanOrEqual(15);
    expect(r.rows).toBeGreaterThanOrEqual(TERM_FIT.minRows);
  });
});
