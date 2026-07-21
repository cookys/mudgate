/**
 * Structural + API path test: ProfileEditor uses validateProfile + secrets store.
 * (Component DOM covered via exports used by ConnectGate.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateProfile,
  setProfileSecretEntry,
  getProfilePassword,
  getProfileAccount,
  getProfileAutoLogin,
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
    setProfileSecretEntry(p.id, {
      account: "hero",
      password: "s3cret",
      autoLogin: true,
    });
    expect(getProfileAccount(p.id)).toBe("hero");
    expect(getProfilePassword(p.id)).toBe("s3cret");
    expect(getProfileAutoLogin(p.id)).toBe(true);
    // export never includes password/account secrets
    const exp = exportProfilesJson([p]);
    expect(exp).not.toContain("s3cret");
    expect(exp).not.toContain("hero");
    clearProfileSecret(p.id);
    expect(getProfilePassword(p.id)).toBeUndefined();
    expect(getProfileAutoLogin(p.id)).toBe(false);
  });
});
