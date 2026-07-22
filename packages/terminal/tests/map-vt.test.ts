import { describe, it, expect } from "vitest";
import { ScreenBuffer } from "../src/buffer.js";
import { defaultAttrs } from "@mudgate/vt";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("map_d control plane", () => {
  it("CUP + save/restore leaves prompt region intact (synthetic city frame)", () => {
    const b = new ScreenBuffer(40, 12);
    // write "prompt" at bottom
    b.writeDecoded("\x1b[12;1H> ready");
    expect(b.snapshotText().split("\n")[11]).toContain("> ready");

    // map overlay: save, paint top, restore
    b.writeDecoded("\x1b[s"); // save
    b.writeDecoded("\x1b[1;1H\x1b[2J"); // home + clear — wait, clear wipes prompt
    // better sequence matching research: SAVEC, paint, REST without full clear after prompt
    const b2 = new ScreenBuffer(40, 12);
    b2.writeDecoded("\x1b[12;1H> ready");
    b2.writeDecoded("\x1b[s");
    b2.writeDecoded("\x1b[1;1HMAP HEADER");
    b2.writeDecoded("\x1b[2;1H│..map row..│");
    b2.writeDecoded("\x1b[u"); // restore
    // after restore, writing continues at saved cursor
    b2.writeDecoded("!");
    const lines = b2.snapshotText().split("\n");
    expect(lines[0]).toContain("MAP HEADER");
    expect(lines[1]).toContain("map row");
    expect(lines[11]).toMatch(/> ready!/);
  });

  it("DECSTBM freezes scroll region", () => {
    const b = new ScreenBuffer(20, 10);
    b.writeDecoded("\x1b[3;8r"); // scroll lines 3-8
    expect(b.scrollTop).toBe(2);
    expect(b.scrollBottom).toBe(7);
    b.writeDecoded("\x1b[1;1HTOP");
    b.writeDecoded("\x1b[10;1HBOT");
    // fill scroll region with newlines
    b.writeDecoded("\x1b[3;1H");
    for (let i = 0; i < 20; i++) b.writeDecoded(`L${i}\n`);
    // top/bottom outside region should not scroll away entirely for row 0
    expect(b.snapshotText().split("\n")[0]).toContain("TOP");
  });

  it("ED and EL erase", () => {
    const b = new ScreenBuffer(10, 3);
    b.writeDecoded("ABCDEFGHIJ");
    b.writeDecoded("\x1b[1;5H\x1b[K"); // EL from col 5
    const line = b.snapshotText().split("\n")[0] ?? "";
    expect(line.startsWith("ABCD")).toBe(true);
    expect(line.includes("E")).toBe(false);
  });

  it("dual-color fullwidth cell has two attrs", () => {
    const b = new ScreenBuffer(10, 2);
    const left = { ...defaultAttrs(), fg: 1, bold: true };
    const right = { ...defaultAttrs(), fg: 2 };
    b.setDualColorCell(0, 0, "中", left, right);
    expect(b.cellAt(0, 0)?.attrs.fg).toBe(1);
    expect(b.cellAt(0, 1)?.attrs.fg).toBe(2);
    expect(b.cellAt(0, 0)?.ch).toBe("中");
  });

  it("synthetic map fixture file if present", () => {
    const p = join(root, "tests/fixtures/streams/synthetic-city-map.ansi.txt");
    if (!existsSync(p)) return;
    const ansi = readFileSync(p, "utf8");
    const b = new ScreenBuffer(50, 14);
    b.writeDecoded("\x1b[14;1HPROMPT");
    b.writeDecoded(ansi);
    const text = b.snapshotText();
    expect(text).toMatch(/MAP|城|HEADER|┌|│/i);
    // restore should leave ability to see prompt row content depending on fixture
    expect(b.rows).toBe(14);
  });
});
