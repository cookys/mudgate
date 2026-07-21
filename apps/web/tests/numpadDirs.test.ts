import { describe, it, expect } from "vitest";
import { numpadDirection, NUMPAD_CODE_DIR } from "../src/lib/numpadDirs";

describe("numpadDirection (zMUD keypad)", () => {
  it("maps Numpad8/2/4/6 to n/s/w/e", () => {
    expect(numpadDirection({ code: "Numpad8", key: "8", location: 3 })).toBe(
      "n",
    );
    expect(numpadDirection({ code: "Numpad2", key: "2", location: 3 })).toBe(
      "s",
    );
    expect(numpadDirection({ code: "Numpad4", key: "4", location: 3 })).toBe(
      "w",
    );
    expect(numpadDirection({ code: "Numpad6", key: "6", location: 3 })).toBe(
      "e",
    );
  });

  it("maps diagonals and 5=look", () => {
    expect(numpadDirection({ code: "Numpad7", key: "7", location: 3 })).toBe(
      "nw",
    );
    expect(numpadDirection({ code: "Numpad9", key: "9", location: 3 })).toBe(
      "ne",
    );
    expect(numpadDirection({ code: "Numpad1", key: "1", location: 3 })).toBe(
      "sw",
    );
    expect(numpadDirection({ code: "Numpad3", key: "3", location: 3 })).toBe(
      "se",
    );
    expect(numpadDirection({ code: "Numpad5", key: "5", location: 3 })).toBe(
      "look",
    );
  });

  it("maps NumLock-off arrows on numpad location", () => {
    expect(
      numpadDirection({ code: "ArrowUp", key: "ArrowUp", location: 3 }),
    ).toBe("n");
    expect(
      numpadDirection({ code: "ArrowDown", key: "ArrowDown", location: 3 }),
    ).toBe("s");
    expect(
      numpadDirection({ code: "Home", key: "Home", location: 3 }),
    ).toBe("nw");
  });

  it("ignores main keyboard arrows (location 0)", () => {
    expect(
      numpadDirection({ code: "ArrowUp", key: "ArrowUp", location: 0 }),
    ).toBeNull();
    expect(numpadDirection({ code: "KeyW", key: "w", location: 0 })).toBeNull();
  });

  it("covers full zMUD pad codes", () => {
    expect(Object.keys(NUMPAD_CODE_DIR).sort()).toEqual(
      [
        "Numpad1",
        "Numpad2",
        "Numpad3",
        "Numpad4",
        "Numpad5",
        "Numpad6",
        "Numpad7",
        "Numpad8",
        "Numpad9",
      ].sort(),
    );
  });
});
