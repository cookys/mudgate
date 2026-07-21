import { describe, it, expect } from "vitest";
import { isAlignScoreGood, probeCjkGlyph, TRIAL_FIXTURE } from "../src/termFonts/trial";
import {
  resolveFontStack,
  resolveFontStackProbed,
  DEFAULT_TERM_FONT,
} from "../src/termFonts/catalog";

describe("font trial", () => {
  it("marks scores near 2.0 as good dual-width", () => {
    expect(isAlignScoreGood(2.0)).toBe(true);
    expect(isAlignScoreGood(1.85)).toBe(true);
    expect(isAlignScoreGood(1.0)).toBe(false);
    expect(isAlignScoreGood(0)).toBe(false);
  });

  it("trial fixture includes CJK + box drawing", () => {
    expect(TRIAL_FIXTURE).toContain("中");
    expect(TRIAL_FIXTURE).toContain("─");
  });

  it("resolveFontStack includes primary and monospace fallback", () => {
    const s = resolveFontStack(DEFAULT_TERM_FONT, "zh-TW");
    expect(s).toContain("Sarasa Term TC");
    expect(s.toLowerCase()).toContain("monospace");
  });

  it("custom primary appears first in stack", () => {
    const s = resolveFontStack(
      { ...DEFAULT_TERM_FONT, primary: "MyFont", presetId: "custom" },
      "zh-TW",
    );
    expect(s.startsWith("MyFont") || s.startsWith('"MyFont"')).toBe(true);
  });

  it("probeCjkGlyph is exported and returns structure", () => {
    // node test env: no document → fail closed
    const r = probeCjkGlyph("monospace");
    expect(r).toHaveProperty("ok");
    expect(r).toHaveProperty("width");
    expect(typeof r.ok).toBe("boolean");
    expect(r.ok).toBe(false);
    expect(r.width).toBe(0);
  });

  it("probeCjkGlyph never treats fonts.check alone as CJK proof", () => {
    // Minimal document stub: fonts.check always true (Latin-only trap), canvas
    // measures same width for requested vs missing → must fail closed.
    const g = globalThis as unknown as {
      document?: {
        createElement: (tag: string) => unknown;
        fonts?: { check: (s: string) => boolean };
      };
    };
    const prev = g.document;
    g.document = {
      fonts: { check: () => true },
      createElement: () => ({
        getContext: () => ({
          font: "",
          measureText: () => ({ width: 12 }),
        }),
      }),
    };
    try {
      const r = probeCjkGlyph("LatinOnlyFace");
      expect(r.ok).toBe(false);
      expect(r.width).toBe(12);
    } finally {
      if (prev === undefined) delete g.document;
      else g.document = prev;
    }
  });

  it("resolveFontStackProbed matches resolveFontStack in node", () => {
    const a = resolveFontStack(DEFAULT_TERM_FONT, "zh-TW");
    const b = resolveFontStackProbed(DEFAULT_TERM_FONT, "zh-TW");
    expect(b).toBe(a);
  });
});
