import { describe, it, expect } from "vitest";
import {
  verdictOnServerLine,
  verdictOnSettle,
} from "../src/journeyReplay.js";
import { isMoveFail } from "../src/parse.js";

describe("journeyReplay gate (C1.2)", () => {
  it("stops on real isMoveFail server lines", () => {
    const line = "你不能往那邊走。";
    expect(isMoveFail(line)).toBe(true);
    expect(verdictOnServerLine(line)).toEqual({
      kind: "stop",
      reason: "move_fail",
    });
    expect(verdictOnServerLine("You can't go that way.")).toEqual({
      kind: "stop",
      reason: "move_fail",
    });
  });

  it("does not stop on ordinary room chatter", () => {
    expect(verdictOnServerLine("大街")).toBeNull();
    expect(verdictOnServerLine("出口：東、西。")).toBeNull();
  });

  it("settle advances when title changes", () => {
    expect(verdictOnSettle("大街", "銀行")).toEqual({ kind: "advance" });
  });

  it("settle stops when pre-title stuck", () => {
    expect(verdictOnSettle("大街", "大街")).toEqual({
      kind: "stop",
      reason: "title_stuck",
    });
  });

  it("settle advances when no pre-title (unknown room)", () => {
    expect(verdictOnSettle(null, null)).toEqual({ kind: "advance" });
    expect(verdictOnSettle("", "銀行")).toEqual({ kind: "advance" });
  });
});
