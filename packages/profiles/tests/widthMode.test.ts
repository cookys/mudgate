import { describe, it, expect } from "vitest";
import {
  normalizeCharset,
  resolveWidthMode,
} from "../src/widthMode.js";

describe("normalizeCharset", () => {
  it("maps common aliases", () => {
    expect(normalizeCharset("big5hkscs")).toBe("big5hkscs");
    expect(normalizeCharset("Big5-HKSCS")).toBe("big5hkscs");
    expect(normalizeCharset("cp950")).toBe("big5hkscs");
    expect(normalizeCharset("gbk")).toBe("gbk");
    expect(normalizeCharset("gb2312")).toBe("gbk");
    expect(normalizeCharset("utf-8")).toBe("utf8");
  });

  it("unknown for unlisted", () => {
    expect(normalizeCharset("euc-kr")).toBe("unknown");
    expect(normalizeCharset("")).toBe("unknown");
    expect(normalizeCharset(undefined)).toBe("unknown");
  });
});

describe("resolveWidthMode", () => {
  it("big5* / gbk → cjk", () => {
    expect(resolveWidthMode({ charset: "big5hkscs" })).toBe("cjk");
    expect(resolveWidthMode({ charset: "big5" })).toBe("cjk");
    expect(resolveWidthMode({ charset: "gbk" })).toBe("cjk");
  });

  it("utf8 / unknown → western", () => {
    expect(resolveWidthMode({ charset: "utf8" })).toBe("western");
    expect(resolveWidthMode({ charset: "mystery" })).toBe("western");
    expect(resolveWidthMode({})).toBe("western");
  });

  it("explicit widthMode overrides charset", () => {
    expect(resolveWidthMode({ charset: "utf8", widthMode: "cjk" })).toBe(
      "cjk",
    );
    expect(
      resolveWidthMode({ charset: "big5hkscs", widthMode: "western" }),
    ).toBe("western");
  });
});
