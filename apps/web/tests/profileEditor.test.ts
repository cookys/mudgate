/**
 * Structural + API path test: ProfileEditor uses validateProfile + secrets store.
 * (Component DOM covered via exports used by ConnectGate.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateProfile,
  setProfilePassword,
  getProfilePassword,
  clearProfileSecret,
  exportProfilesJson,
} from "@assmud/profiles";

describe("profile CRUD API path (P2 secrets)", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("create-like validate + secret store round-trip", () => {
    const p = validateProfile({
      id: "crud-1",
      name: "CRUD",
      host: "mud.example",
      port: 4000,
      charset: "big5hkscs",
    });
    setProfilePassword(p.id, "s3cret");
    expect(getProfilePassword(p.id)).toBe("s3cret");
    // export never includes password
    expect(exportProfilesJson([p])).not.toContain("s3cret");
    clearProfileSecret(p.id);
    expect(getProfilePassword(p.id)).toBeUndefined();
  });
});
