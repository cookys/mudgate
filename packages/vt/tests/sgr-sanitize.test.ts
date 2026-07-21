import { describe, it, expect } from "vitest";
import { tokenizeAnsi, applySgr, defaultAttrs } from "../src/sgr.js";
import { sanitizeMudTextForHtml, escapeHtml } from "../src/sanitize.js";

describe("SGR", () => {
  it("applies bold red", () => {
    const a = applySgr(defaultAttrs(), [1, 31]);
    expect(a.bold).toBe(true);
    expect(a.fg).toBe(1);
  });

  it("tokenizes mixed SGR and text", () => {
    const { tokens, residual } = tokenizeAnsi("\x1b[1;32mOK\x1b[0m!");
    expect(residual).toBe("");
    const texts = tokens.filter((t) => t.kind === "text");
    expect(texts.some((t) => t.kind === "text" && t.text === "OK" && t.attrs.bold)).toBe(true);
  });

  it("holds incomplete CSI as residual (does not paint [1;34m as text)", () => {
    const a = tokenizeAnsi("name(\x1b[1;34");
    expect(a.residual).toBe("\x1b[1;34");
    const textsA = a.tokens.filter((t) => t.kind === "text").map((t) => (t as { text: string }).text).join("");
    expect(textsA).toBe("name(");
    expect(textsA).not.toContain("[1;34");

    // complete on next chunk
    const b = tokenizeAnsi(a.residual + "mYe\x1b[0m", a.attrs);
    expect(b.residual).toBe("");
    const textsB = b.tokens.filter((t) => t.kind === "text");
    expect(textsB.some((t) => t.kind === "text" && t.text === "Ye" && t.attrs.fg === 4)).toBe(
      true,
    );
  });
});

describe("sanitize", () => {
  it("escapes script tags", () => {
    const evil = '<script>alert(1)</script>';
    const out = sanitizeMudTextForHtml(evil);
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("escapeHtml is idempotent-ish for plain text", () => {
    expect(escapeHtml("重生")).toBe("重生");
  });
});
