import { describe, it, expect } from "vitest";
import { ScriptEngine } from "../src/index.js";

describe("ScriptEngine", () => {
  it("expands aliases and multi-command", () => {
    const e = new ScriptEngine();
    e.importPackage(
      JSON.stringify({
        id: "core",
        name: "core",
        enabled: true,
        aliases: [{ name: "h", expand: "cast heal;$args" }],
        triggers: [],
      }),
    );
    expect(e.expandInput("h me")).toEqual(["cast heal", "me"]);
  });

  it("fires send trigger with capture and cooldown", () => {
    const e = new ScriptEngine();
    e.importPackage(
      JSON.stringify({
        id: "t",
        name: "t",
        enabled: true,
        aliases: [],
        triggers: [
          {
            id: "hp",
            pattern: "HP:(\\d+)",
            action: "send",
            payload: "drink $1",
            cooldownMs: 1000,
          },
        ],
      }),
    );
    const ev = e.onServerLine("HP:30", 1000);
    expect(ev.some((x) => x.type === "send" && x.line === "drink 30")).toBe(true);
    const ev2 = e.onServerLine("HP:20", 1500);
    expect(ev2.some((x) => x.type === "send")).toBe(false);
  });

  it("gag and setvar", () => {
    const e = new ScriptEngine();
    e.importPackage(
      JSON.stringify({
        id: "g",
        name: "g",
        enabled: true,
        aliases: [],
        triggers: [
          { id: "g1", pattern: "spam", action: "gag" },
          { id: "v1", pattern: "name:(\\w+)", action: "setvar", payload: "who=$1" },
        ],
      }),
    );
    expect(e.onServerLine("spam line").some((x) => x.type === "gag")).toBe(true);
    e.onServerLine("name:alice");
    expect(e.variables.who).toBe("alice");
  });

  it("denies cookie/fetch surfaces", () => {
    const e = new ScriptEngine();
    expect(() => e.fetch()).toThrow(/denies/);
    expect(() => e.cookie).toThrow(/denies/);
    expect(() => e.localStorage).toThrow(/denies/);
  });

  it("export/import roundtrip and disable package", () => {
    const e = new ScriptEngine();
    e.importPackage(
      JSON.stringify({
        id: "p",
        name: "p",
        enabled: true,
        aliases: [{ name: "x", expand: "y" }],
        triggers: [],
      }),
    );
    const j = e.exportPackage("p");
    e.setEnabled("p", false);
    expect(e.expandInput("x")).toEqual(["x"]);
    e.importPackage(j);
    e.setEnabled("p", true);
    expect(e.expandInput("x")).toEqual(["y"]);
  });
});
