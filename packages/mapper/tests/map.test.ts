import { describe, it, expect } from "vitest";
import {
  RoomTracker,
  parseExitsLine,
  parseMoveCommand,
  commandForDir,
  stripAnsi,
  fingerprint,
} from "../src/index.js";

describe("parseExitsLine", () => {
  it("parses Chinese exit lines", () => {
    const p = parseExitsLine("出口：東、西、南、北");
    expect(p?.dirs.sort()).toEqual(["e", "n", "s", "w"].sort());
  });

  it("parses English exits", () => {
    const p = parseExitsLine("Exits: north, east.");
    expect(p?.dirs).toContain("n");
    expect(p?.dirs).toContain("e");
  });

  it("strips ANSI before parse", () => {
    const p = parseExitsLine("\u001b[1;36m出口：\u001b[0m北 南");
    expect(p?.dirs.sort()).toEqual(["n", "s"].sort());
  });
});

describe("dirs", () => {
  it("dual lexicon move commands", () => {
    expect(parseMoveCommand("東")).toBe("e");
    expect(parseMoveCommand("e")).toBe("e");
    expect(parseMoveCommand("northeast")).toBe("ne");
    expect(commandForDir("e", "en")).toBe("e");
    expect(commandForDir("e", "zh")).toBe("東");
  });
});

describe("RoomTracker trail (dead-reckon)", () => {
  it("builds footprint on move alone — no exits needed", () => {
    const t = new RoomTracker();
    t.noteOutbound("e", "e");
    t.noteOutbound("e", "e");
    t.noteOutbound("n", "n");
    expect(t.rooms.size).toBe(4); // start + 3 steps
    expect(t.layoutNodes().length).toBe(4);
    expect(t.layoutEdges().length).toBeGreaterThanOrEqual(3);
    const n = t.nearby();
    expect(n.roomCount).toBe(4);
    expect(n.title).toBe("?");
  });

  it("upgrades title and exits when triggers fire", () => {
    const t = new RoomTracker();
    t.noteOutbound("n", "n");
    t.onServerLine("中央廣場");
    t.onServerLine("出口：北、東、西");
    const n = t.nearby();
    expect(n.title).toBe("中央廣場");
    expect(n.confidence).toBe("known");
    expect(n.exits.map((e) => e.dir).sort()).toEqual(
      expect.arrayContaining(["e", "n", "w"]),
    );
  });

  it("move fail undoes last dig", () => {
    const t = new RoomTracker();
    t.noteOutbound("n", "n");
    expect(t.rooms.size).toBe(2);
    t.onServerLine("你不能往那邊走。");
    expect(t.lastEvent).toBe("move_fail");
    expect(t.rooms.size).toBe(1);
    expect(t.nearby().title).toBe("起點");
  });

  it("follow existing edge revisits room", () => {
    const t = new RoomTracker();
    t.noteOutbound("e", "e");
    const mid = t.currentId!;
    t.noteOutbound("w", "w"); // new room west of start? actually from mid go w
    // from room after e, go w should return toward start if reverse stub only —
    // without reverse link, creates new. Step e then e back via same edge:
    t.reset();
    t.noteOutbound("e", "e");
    const a = t.currentId!;
    // force reverse link like observed
    const start = [...t.rooms.values()].find((r) => r.title === "起點")!;
    const east = t.rooms.get(a)!;
    east.exits.w = start.id;
    start.exits.e = east.id;
    t.currentId = east.id;
    t.noteOutbound("w", "w");
    expect(t.currentId).toBe(start.id);
    expect(t.rooms.size).toBe(2);
  });

  it("fingerprint distinguishes same title different exits", () => {
    expect(fingerprint("大街", ["n", "s"])).not.toBe(
      fingerprint("大街", ["e", "w"]),
    );
  });

  it("stripAnsi removes SGR", () => {
    expect(stripAnsi("\u001b[32mhi\u001b[0m")).toBe("hi");
  });
});
