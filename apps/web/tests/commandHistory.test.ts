import { describe, it, expect } from "vitest";
import { CommandHistory } from "../src/lib/commandHistory";

describe("CommandHistory", () => {
  it("up/down walks history and restores draft", () => {
    const h = new CommandHistory();
    h.push("n");
    h.push("look");
    h.push("s");
    expect(h.up("partial")).toBe("s");
    expect(h.up("partial")).toBe("look");
    expect(h.up("partial")).toBe("n");
    expect(h.up("partial")).toBe("n"); // stay at oldest
    expect(h.down()).toBe("look");
    expect(h.down()).toBe("s");
    expect(h.down()).toBe("partial"); // draft
    expect(h.down()).toBeNull();
  });

  it("does not duplicate consecutive identical lines", () => {
    const h = new CommandHistory();
    h.push("n");
    h.push("n");
    expect(h.snapshot().items).toEqual(["n"]);
  });

  it("ignores empty push", () => {
    const h = new CommandHistory();
    h.push("  ");
    expect(h.snapshot().items).toEqual([]);
    expect(h.up("")).toBeNull();
  });
});
