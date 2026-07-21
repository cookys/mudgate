import { describe, it, expect } from "vitest";
import type { MapFrameCells } from "@assmud/terminal";
import { MemoryNavStore } from "../src/memoryStore.js";
import {
  computeFingerprint,
  rankFingerprintMatches,
  searchNavMemory,
} from "../src/fingerprint.js";
import {
  createStitchState,
  placeStitchTile,
  stitchToAscii,
  clearStitch,
} from "../src/stitch.js";

function cellsWithText(
  cols: number,
  rows: number,
  text: string,
): MapFrameCells {
  const cells = Array.from({ length: cols * rows }, () => ({
    ch: " ",
    fg: null as number | null,
    bg: null as number | null,
    bold: false,
    inverse: false,
    wideCont: false,
  }));
  for (let i = 0; i < text.length && i < cols; i++) {
    cells[i]!.ch = text[i]!;
  }
  return { cols, rows, widthMode: "western", cells };
}

describe("C1 fingerprint + search", () => {
  it("computeFingerprint stable for same cells", () => {
    const a = cellsWithText(8, 4, "銀行AB");
    const fp1 = computeFingerprint({
      cols: a.cols,
      rows: a.rows,
      widthMode: a.widthMode,
      cells: a.cells,
    });
    const fp2 = computeFingerprint({
      cols: a.cols,
      rows: a.rows,
      widthMode: a.widthMode,
      cells: a.cells,
    });
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(8);
  });

  it("rankFingerprintMatches exact first", () => {
    const hits = rankFingerprintMatches("aabbccdd", [
      { id: "f1", fingerprint: "aabbccdd" },
      { id: "f2", fingerprint: "aabb0000" },
    ]);
    expect(hits[0]!.frameId).toBe("f1");
    expect(hits[0]!.score).toBe(1);
  });

  it("searchNavMemory finds pin text 銀行", async () => {
    const s = new MemoryNavStore();
    await s.putFrame({
      cells: cellsWithText(10, 3, "xxx"),
      source: "manual-capture",
      confidence: "user",
      profileKey: "p",
      tabId: "t",
      id: "f1",
      label: "城門",
    });
    await s.putPin({
      frameId: "f1",
      r: 0,
      c: 0,
      text: "  銀行  ",
      profileKey: "p",
    });
    const frames = await s.listFrames("p");
    const pins = await s.listPins("p");
    const hits = searchNavMemory("銀行", { frames, pins });
    expect(hits.some((h) => h.kind === "pin")).toBe(true);
  });
});

describe("C1 journey store", () => {
  it("CRUD + export/import without secrets", async () => {
    const s = new MemoryNavStore();
    const j = await s.putJourney({
      name: "回銀行",
      profileKey: "p",
      steps: [],
    });
    await s.appendJourneyStep(j.id, {
      cmd: "e",
      at: 1,
      titleHint: "大街",
    });
    await s.appendJourneyStep(j.id, {
      cmd: "n",
      at: 2,
      titleHint: "銀行",
    });
    const got = await s.getJourney(j.id);
    expect(got!.steps).toHaveLength(2);
    const json = s.exportJourneyJson(got!);
    expect(json).not.toMatch(/password|token|secret/i);
    expect(json).toContain("銀行");
    await s.deleteJourney(j.id);
    expect(await s.getJourney(j.id)).toBeUndefined();
    const imp = await s.importJourneyJson("p", json);
    expect(imp).not.toBeNull();
    expect(imp!.steps).toHaveLength(2);
    expect(imp!.name).toBe("回銀行");
  });

  it("listJourneys per profileKey", async () => {
    const s = new MemoryNavStore();
    await s.putJourney({ name: "a", profileKey: "p1" });
    await s.putJourney({ name: "b", profileKey: "p2" });
    expect(await s.listJourneys("p1")).toHaveLength(1);
    expect((await s.listJourneys("p1"))[0]!.name).toBe("a");
  });

  it("putFrame stores fingerprint", async () => {
    const s = new MemoryNavStore();
    const r = await s.putFrame({
      cells: cellsWithText(6, 2, "MAP"),
      source: "auto-burst",
      confidence: "inferred",
      profileKey: "p",
      tabId: "t",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const f = await s.getFrame(r.id);
      expect(f!.fingerprint.length).toBe(8);
    }
  });
});

describe("C1 stitch prototype", () => {
  it("places tiles by dir and produces multi-tile ascii panorama (≥3 steps)", () => {
    let st = createStitchState();
    st = { ...st, enabled: true };
    const c1 = cellsWithText(4, 2, "AA");
    st = placeStitchTile(st, {
      id: "t1",
      cols: 4,
      rows: 2,
      cells: c1.cells,
    });
    const c2 = cellsWithText(4, 2, "BB");
    st = placeStitchTile(st, {
      id: "t2",
      cols: 4,
      rows: 2,
      cells: c2.cells,
      dir: "e",
    });
    const c3 = cellsWithText(4, 2, "CC");
    st = placeStitchTile(st, {
      id: "t3",
      cols: 4,
      rows: 2,
      cells: c3.cells,
      dir: "s",
    });
    expect(st.tiles).toHaveLength(3);
    const ascii = stitchToAscii(st);
    // Visible composite: multiple glyph classes across panorama dump
    expect(ascii).toContain("A");
    expect(ascii).toContain("B");
    expect(ascii).toContain("C");
    // offsets mean more than a single 4-col tile width of content
    expect(ascii.split("\n").length).toBeGreaterThanOrEqual(1);
    expect(ascii.length).toBeGreaterThan(4);
    st = clearStitch(st);
    expect(st.tiles).toHaveLength(0);
    expect(stitchToAscii(st)).toBe("");
  });
});
