import { describe, it, expect } from "vitest";
import { ClientMap } from "../src/index.js";

describe("ClientMap", () => {
  it("tracks moves and ascii", () => {
    const m = new ClientMap();
    m.move("n", "North");
    m.move("e", "East");
    expect(m.rooms.size).toBeGreaterThanOrEqual(2);
    const a = m.ascii(2);
    expect(a).toContain("@");
    expect(a).toContain("o");
  });
});
