import { describe, it, expect } from "vitest";
import { ScreenBuffer } from "../src/buffer.js";

describe("ScreenBuffer", () => {
  it("writes SGR colored text", () => {
    const b = new ScreenBuffer(40, 5);
    b.writeDecoded("\x1b[1;31mX\x1b[0m");
    expect(b.cells[0]![0]!.ch).toBe("X");
    expect(b.cells[0]![0]!.attrs.bold).toBe(true);
    expect(b.cells[0]![0]!.attrs.fg).toBe(1);
  });
});
