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

describe("RoomTracker", () => {
  it("builds rooms from title + exits after move", () => {
    const t = new RoomTracker();
    t.noteOutbound("n", "n");
    t.onServerLine("中央廣場");
    t.onServerLine("出口：北、東、西");
    const n = t.nearby();
    expect(n.title).toBe("中央廣場");
    expect(n.confidence).toBe("known");
    expect(n.exits.map((e) => e.dir).sort()).toEqual(["e", "n", "w"].sort());

    t.noteOutbound("e", "e");
    t.onServerLine("東大街");
    t.onServerLine("出口：西、東");
    expect(t.rooms.size).toBe(2);
    expect(t.nearby().title).toBe("東大街");
    // reverse observed only if listed
    const east = [...t.rooms.values()].find((r) => r.title === "東大街")!;
    expect(east.exits.w).toBeTruthy();
  });

  it("move fail clears pending dig", () => {
    const t = new RoomTracker();
    t.noteOutbound("n", "n");
    t.onServerLine("你不能往那邊走。");
    expect(t.lastMoveDir).toBeNull();
    expect(t.lastEvent).toBe("move_fail");
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
