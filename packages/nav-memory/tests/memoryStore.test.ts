import { describe, it, expect } from "vitest";
import type { MapFrameCells } from "@assmud/terminal";
import {
  MAX_FRAMES_PER_PROFILE,
  MemoryNavStore,
} from "../src/index.js";

function blankCells(cols = 4, rows = 2): MapFrameCells {
  const cells = Array.from({ length: cols * rows }, () => ({
    ch: " ",
    fg: null as number | null,
    bg: null as number | null,
    bold: false,
    inverse: false,
    wideCont: false,
  }));
  return { cols, rows, widthMode: "western", cells };
}

describe("MemoryNavStore", () => {
  it("LRU evicts oldest unprotected; protected immune; cascade pins", async () => {
    const s = new MemoryNavStore();
    const pk = "prof-a";

    // fill to MAX-1 unprotected + 1 protected
    for (let i = 0; i < MAX_FRAMES_PER_PROFILE - 1; i++) {
      const r = await s.putFrame({
        cells: blankCells(),
        source: "manual-capture",
        confidence: "user",
        profileKey: pk,
        tabId: "t",
        id: `u-${i}`,
        capturedAt: 1000 + i,
      });
      expect(r.ok).toBe(true);
    }
    const prot = await s.putFrame({
      cells: blankCells(),
      source: "manual-capture",
      confidence: "user",
      profileKey: pk,
      tabId: "t",
      id: "prot",
      protected: true,
      capturedAt: 2000,
    });
    expect(prot.ok).toBe(true);

    await s.putPin({
      frameId: "u-0",
      r: 0,
      c: 0,
      text: "gone",
      profileKey: pk,
      id: "pin-old",
    });

    // next put should evict u-0
    const next = await s.putFrame({
      cells: blankCells(),
      source: "auto-burst",
      confidence: "inferred",
      profileKey: pk,
      tabId: "t",
      id: "new",
      capturedAt: 3000,
    });
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.evicted).toBe(true);
    expect(await s.getFrame("u-0")).toBeUndefined();
    expect(await s.getFrame("prot")).toBeDefined();
    expect(await s.listPinsForFrame("u-0")).toHaveLength(0);
  });

  it("all protected and full → storageFull", async () => {
    const s = new MemoryNavStore();
    const pk = "full";
    for (let i = 0; i < MAX_FRAMES_PER_PROFILE; i++) {
      await s.putFrame({
        cells: blankCells(),
        source: "manual-capture",
        confidence: "user",
        profileKey: pk,
        tabId: "t",
        id: `p-${i}`,
        protected: true,
        capturedAt: i,
      });
    }
    const r = await s.putFrame({
      cells: blankCells(),
      source: "auto-burst",
      confidence: "inferred",
      profileKey: pk,
      tabId: "t",
    });
    expect(r).toEqual({ ok: false, reason: "storageFull" });
  });

  it("pin bounds + text trim 1–200", async () => {
    const s = new MemoryNavStore();
    await s.putFrame({
      cells: blankCells(4, 2),
      source: "manual-capture",
      confidence: "user",
      profileKey: "p",
      tabId: "t",
      id: "f1",
    });
    expect(
      await s.putPin({ frameId: "f1", r: 0, c: 0, text: "  ok  ", profileKey: "p" }),
    ).toMatchObject({ text: "ok" });
    expect(
      await s.putPin({ frameId: "f1", r: 0, c: 0, text: "   ", profileKey: "p" }),
    ).toBeNull();
    expect(
      await s.putPin({ frameId: "f1", r: 99, c: 0, text: "x", profileKey: "p" }),
    ).toBeNull();
    expect(
      await s.putPin({
        frameId: "f1",
        r: 0,
        c: 0,
        text: "x".repeat(201),
        profileKey: "p",
      }),
    ).toBeNull();
  });

  it("clearProfile removes frames and pins", async () => {
    const s = new MemoryNavStore();
    await s.putFrame({
      cells: blankCells(),
      source: "manual-capture",
      confidence: "user",
      profileKey: "a",
      tabId: "t",
      id: "fa",
    });
    await s.putFrame({
      cells: blankCells(),
      source: "manual-capture",
      confidence: "user",
      profileKey: "b",
      tabId: "t",
      id: "fb",
    });
    await s.putPin({
      frameId: "fa",
      r: 0,
      c: 0,
      text: "x",
      profileKey: "a",
    });
    await s.clearProfile("a");
    expect(await s.getFrame("fa")).toBeUndefined();
    expect(await s.getFrame("fb")).toBeDefined();
    expect(await s.listPins("a")).toHaveLength(0);
  });
});
