import { describe, it, expect } from "vitest";
import { ScreenBuffer } from "../src/buffer.js";
import { visibleText } from "@assmud/vt";

describe("ScreenBuffer", () => {
  it("writes SGR colored text", () => {
    const b = new ScreenBuffer(40, 5);
    b.writeDecoded("\x1b[1;31mX\x1b[0m");
    expect(b.cells[0]![0]!.ch).toBe("X");
    expect(b.cells[0]![0]!.attrs.bold).toBe(true);
    expect(b.cells[0]![0]!.attrs.fg).toBe(1);
  });

  it("exports plain without color codes", () => {
    const b = new ScreenBuffer(40, 5);
    b.writeDecoded("\x1b[1;32m中\x1b[0mAB");
    const plain = b.snapshotText();
    expect(plain.startsWith("中AB")).toBe(true);
    expect(plain.includes("\x1b")).toBe(false);
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
});
