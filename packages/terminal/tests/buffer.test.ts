import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScreenBuffer } from "../src/buffer.js";
import { isWide } from "../src/width.js";
import { visibleText } from "@assmud/vt";
import { Big5StreamDecoder } from "@assmud/codec-big5";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("isWide modes", () => {
  it("box-drawing Ambiguous: wide only in cjk", () => {
    for (const ch of ["─", "│", "┌", "╮"]) {
      expect(isWide(ch, "cjk")).toBe(true);
      expect(isWide(ch, "western")).toBe(false);
    }
  });

  it("ASCII never wide", () => {
    expect(isWide("A", "cjk")).toBe(false);
    expect(isWide("A", "western")).toBe(false);
  });

  it("CJK ideograph wide in both", () => {
    expect(isWide("中", "cjk")).toBe(true);
    expect(isWide("中", "western")).toBe(true);
  });
});

describe("ScreenBuffer", () => {
  it("writes SGR colored text", () => {
    const b = new ScreenBuffer(40, 5);
    b.writeDecoded("\x1b[1;31mX\x1b[0m");
    expect(b.cells[0]![0]!.ch).toBe("X");
    expect(b.cells[0]![0]!.attrs.bold).toBe(true);
    expect(b.cells[0]![0]!.attrs.fg).toBe(1);
  });

  it("exports plain without color codes", () => {
    // western still treats 中 as wide (F/W range)
    const b = new ScreenBuffer(40, 5, "western");
    b.writeDecoded("\x1b[1;32m中\x1b[0mAB");
    const plain = b.snapshotText();
    expect(plain.startsWith("中AB")).toBe(true);
    expect(plain.includes("\x1b")).toBe(false);
  });

  it("setWidthMode clears buffer", () => {
    const b = new ScreenBuffer(20, 3, "western");
    b.writeDecoded("Hi");
    expect(b.cells[0]![0]!.ch).toBe("H");
    b.setWidthMode("cjk");
    expect(b.cells[0]![0]!.ch).toBe(" ");
    expect(b.cursor).toEqual({ r: 0, c: 0 });
  });

  it("cjk mode advances two cells for box drawing", () => {
    const b = new ScreenBuffer(10, 2, "cjk");
    b.writeDecoded("──");
    expect(b.cursor.c).toBe(4);
    expect(b.cells[0]![0]!.ch).toBe("─");
    expect(b.cells[0]![1]!.ch).toBe("");
  });

  it("western mode advances one cell for box drawing", () => {
    const b = new ScreenBuffer(10, 2, "western");
    b.writeDecoded("──");
    expect(b.cursor.c).toBe(2);
  });

  it("exports ANSI with SGR and round-trips visible text", () => {
    const b = new ScreenBuffer(40, 5);
    b.writeDecoded("\x1b[1;31mHi\x1b[0m!");
    const ansi = b.snapshotAnsi();
    expect(ansi.includes("\x1b[")).toBe(true);
    expect(visibleText(ansi).replace(/\s+$/m, "").startsWith("Hi!")).toBe(true);
  });

  it("exports linear selection", () => {
    const b = new ScreenBuffer(10, 3);
    b.writeDecoded("ABCDEFGHIJ\r\n0123456789");
    const plain = b.exportSelectionPlain(0, 2, 1, 4);
    // CDEFGHIJ + newline + 01234
    expect(plain.split("\n")[0]).toContain("C");
    expect(plain.includes("\n")).toBe(true);
  });

  it("RW MOTD: committed golden cols under cjk mode", () => {
    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures/rw-motd-cols.json",
    );
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
      rows: { line: number; cols: number }[];
    };
    const big5Path = join(root, "tests/fixtures/streams/rw-banner-4000.big5.txt");
    const rawFile = readFileSync(big5Path);
    const lineBytesList: Uint8Array[] = [];
    let start = 0;
    for (let i = 0; i <= rawFile.length; i++) {
      if (i === rawFile.length || rawFile[i] === 0x0a) {
        let end = i;
        if (end > start && rawFile[end - 1] === 0x0d) end -= 1;
        const slice = rawFile.subarray(start, end);
        const out: number[] = [];
        for (let j = 0; j < slice.length; j++) {
          if (slice[j] === 0x1b && slice[j + 1] === 0x5b) {
            j += 2;
            while (j < slice.length && !(slice[j]! >= 0x40 && slice[j]! <= 0x7e))
              j += 1;
            continue;
          }
          out.push(slice[j]!);
        }
        lineBytesList.push(Uint8Array.from(out));
        start = i + 1;
      }
    }

    expect(golden.rows.length).toBeGreaterThan(8);
    for (const row of golden.rows) {
      const lb = lineBytesList[row.line]!;
      expect(lb).toBeDefined();
      const text = new Big5StreamDecoder("big5hkscs").push(lb);
      const buf = new ScreenBuffer(80, 3, "cjk");
      buf.writeDecoded(text);
      expect(buf.cursor.c).toBe(row.cols);
    }
  });
});
