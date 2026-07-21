import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Big5StreamDecoder, decodeBig5 } from "../src/index.js";
import { TelnetParser } from "../../protocol/src/telnet.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Big5StreamDecoder", () => {
  it("decodes banner fixture without mojibake for 重生", () => {
    const raw = readFileSync(join(root, "tests/fixtures/streams/rw-banner-4000.bin"));
    const parser = new TelnetParser();
    const events = parser.push(raw);
    const data = events
      .filter((e): e is { type: "data"; bytes: Uint8Array } => e.type === "data")
      .map((e) => e.bytes);
    const merged = Buffer.concat(data.map((b) => Buffer.from(b)));
    const text = decodeBig5(merged);
    expect(text).toContain("重生");
    expect(text).toMatch(/BIG5/i);
  });

  it("handles split DBCS lead across chunks", () => {
    const d = new Big5StreamDecoder();
    // 中 = A4 A4 in Big5
    expect(d.push(Uint8Array.of(0xa4))).toBe("");
    expect(d.push(Uint8Array.of(0xa4))).toBe("中");
  });
});
