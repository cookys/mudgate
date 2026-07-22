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

  it("snapshotCells deep-clones; later writes do not mutate snapshot", () => {
    const b = new ScreenBuffer(10, 3, "cjk");
    b.writeDecoded("\x1b[1;31m中\x1b[7mA\x1b[0m");
    const snap = b.snapshotCells();
    expect(snap.cols).toBe(10);
    expect(snap.rows).toBe(3);
    expect(snap.widthMode).toBe("cjk");
    expect(snap.cells.length).toBe(30);
    // lead + wideCont trail for 中
    expect(snap.cells[0]!.ch).toBe("中");
    expect(snap.cells[0]!.bold).toBe(true);
    expect(snap.cells[0]!.fg).toBe(1);
    expect(snap.cells[0]!.wideCont).toBe(false);
    expect(snap.cells[1]!.ch).toBe("");
    expect(snap.cells[1]!.wideCont).toBe(true);
    // inverse (SGR 7)
    expect(snap.cells[2]!.ch).toBe("A");
    expect(snap.cells[2]!.inverse).toBe(true);

    b.writeDecoded("\x1b[H\x1b[2JXXXX");
    expect(snap.cells[0]!.ch).toBe("中");
    expect(snap.cells[2]!.inverse).toBe(true);
    // live buffer changed
    expect(b.cells[0]![0]!.ch).not.toBe("中");
  });

  it("snapshotCells after resize uses new dimensions; old snap keeps old size", () => {
    const b = new ScreenBuffer(8, 2);
    b.writeDecoded("Hi");
    const old = b.snapshotCells();
    b.resize(4, 4);
    const neu = b.snapshotCells();
    expect(old.cols).toBe(8);
    expect(old.rows).toBe(2);
    expect(neu.cols).toBe(4);
    expect(neu.rows).toBe(4);
    expect(neu.cells.length).toBe(16);
  });

  it("emits cup-abs on absolute CUP; buf-mut only when armed", () => {
    const events: { type: string; row?: number }[] = [];
    const b = new ScreenBuffer(20, 10);
    let t = 1000;
    b.setNowFn(() => t);
    b.setCaptureSink((e) => {
      events.push(
        e.type === "cup-abs"
          ? { type: e.type, row: e.row }
          : { type: e.type },
      );
    });
    b.writeDecoded("\x1b[3;1H");
    expect(events).toEqual([{ type: "cup-abs", row: 2 }]);
    b.writeDecoded("x");
    expect(events).toHaveLength(1); // not armed → no buf-mut
    b.setMapCaptureArmed(true);
    b.writeDecoded("y");
    expect(events.at(-1)).toEqual({ type: "buf-mut" });
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

  it("does not paint split SGR as literal [1;34m", () => {
    const b = new ScreenBuffer(40, 3, "western");
    // CSI split across writes (common with MCCP/WS chunks)
    b.writeDecoded("who(\x1b[1;34");
    b.writeDecoded("mYe\x1b[0;30mli\x1b[0m)");
    const plain = b.snapshotText();
    expect(plain).toContain("who(Yeli)");
    expect(plain).not.toContain("[1;34");
    expect(plain).not.toContain("[0;30");
    // first latin of name should be bold blue cell
    const cells = b.cells[0]!;
    const y = cells.find((c) => c.ch === "Y");
    expect(y?.attrs.bold).toBe(true);
    expect(y?.attrs.fg).toBe(4);
  });

  it("pushes scrolled-off top lines into scrollback", () => {
    const b = new ScreenBuffer(20, 3, "western");
    b.writeDecoded("line0\r\nline1\r\nline2\r\nline3\r\n");
    // rows=3: after filling 0,1,2 then LF on bottom scrolls off line0
    expect(b.scrollbackDepth()).toBeGreaterThan(0);
    expect(b.scrollback.some((l) => l.includes("line0"))).toBe(true);
    // live top should no longer be line0
    expect(b.snapshotText()).not.toMatch(/^line0/);
  });

  it("scrollbackViewLine maps history then live", () => {
    const b = new ScreenBuffer(20, 4, "western");
    for (let i = 0; i < 8; i++) b.writeDecoded(`L${i}\r\n`);
    const off = b.scrollbackDepth();
    expect(off).toBeGreaterThan(0);
    // top of fully-scrolled view is oldest scrollback still retained
    const top = b.scrollbackViewLine(off, 0);
    expect(typeof top).toBe("string");
    // at offset 0 everything is live cells
    expect(b.scrollbackViewLine(0, 0)).toBeNull();
  });

  it("exportAbsSelectionPlain reads history + live by document row", () => {
    const b = new ScreenBuffer(20, 3, "western");
    b.writeDecoded("histA\r\nhistB\r\nlive0\r\nlive1\r\n");
    // After scroll, hist has early lines; abs 0 should be oldest retained
    const sb = b.scrollbackDepth();
    expect(sb).toBeGreaterThan(0);
    // Select first history line fully
    const plain = b.exportAbsSelectionPlain(0, 0, 0, 19);
    expect(plain).toMatch(/hist/);
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
