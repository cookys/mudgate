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
  });

  it("resolveFontStackProbed matches resolveFontStack in node", () => {
    const a = resolveFontStack(DEFAULT_TERM_FONT, "zh-TW");
    const b = resolveFontStackProbed(DEFAULT_TERM_FONT, "zh-TW");
    expect(b).toBe(a);
  });
});
