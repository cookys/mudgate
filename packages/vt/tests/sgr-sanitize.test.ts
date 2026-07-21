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
    const { tokens } = tokenizeAnsi("\x1b[1;32mOK\x1b[0m!");
    const texts = tokens.filter((t) => t.kind === "text");
    expect(texts.some((t) => t.kind === "text" && t.text === "OK" && t.attrs.bold)).toBe(true);
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
