import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROFILES,
  importProfilesJson,
  validateProfile,
} from "../src/index.js";

describe("validateProfile / import", () => {
  it("accepts DEFAULT_PROFILES seeds including RW wiz 4001 and 6000", () => {
    expect(DEFAULT_PROFILES.some((p) => p.port === 4001)).toBe(true);
    expect(DEFAULT_PROFILES.some((p) => p.port === 6000)).toBe(true);
    for (const p of DEFAULT_PROFILES) {
      expect(validateProfile(p).id).toBe(p.id);
    }
  });

  it("rejects bad JSON and bad fields", () => {
    expect(() => importProfilesJson("not-json")).toThrow(/JSON/);
    expect(() => importProfilesJson("{}")).toThrow(/invalid profiles/);
    expect(() => importProfilesJson("[]")).toThrow(/empty/);
    expect(() =>
      importProfilesJson(
        JSON.stringify([{ id: "a", name: "n", host: "h", port: 0 }]),
      ),
    ).toThrow(/port/);
    expect(() =>
      importProfilesJson(
        JSON.stringify([
          { id: "a", name: "n", host: "h", port: 4000, charset: "latin1" },
        ]),
      ),
    ).toThrow(/charset/);
  });

  it("import strips secrets", () => {
    const list = importProfilesJson(
      JSON.stringify([
        {
          id: "z",
          name: "Z",
          host: "mud.example",
          port: 4000,
          charset: "utf8",
          password: "nope",
          proxyToken: "x",
        },
      ]),
    );
    expect(JSON.stringify(list)).not.toContain("nope");
  });
});
