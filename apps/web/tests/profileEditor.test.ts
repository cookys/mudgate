/**
 * Secrets path: vault unlock required for setProfileSecretEntry.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

import {
  validateProfile,
  setProfileSecretEntry,
  getProfilePassword,
  getProfileAccount,
  getProfileAutoLogin,
  clearProfileSecret,
  exportProfilesJson,
  createVault,
  unlockVault,
  lockVault,
  vaultTestResetStorage,
  isVaultUnlocked,
} from "@assmud/profiles";

describe("profile secrets via vault", () => {
  beforeEach(async () => {
    vaultTestResetStorage();
    await createVault("test-master-key");
  });

  it("stores secrets only while vault unlocked; export clean", async () => {
    const p = validateProfile({
      id: "crud-1",
      name: "CRUD",
      host: "mud.example",
      port: 4000,
      charset: "big5hkscs",
    });
    await setProfileSecretEntry(p.id, {
      account: "hero",
      password: "s3cret",
      autoLogin: true,
    });
    expect(getProfileAccount(p.id)).toBe("hero");
    expect(getProfilePassword(p.id)).toBe("s3cret");
    expect(getProfileAutoLogin(p.id)).toBe(true);
    const exp = exportProfilesJson([p]);
    expect(exp).not.toContain("s3cret");
    expect(exp).not.toContain("hero");

    lockVault();
    expect(isVaultUnlocked()).toBe(false);
    expect(getProfilePassword(p.id)).toBeUndefined();

    await unlockVault("test-master-key");
    expect(getProfilePassword(p.id)).toBe("s3cret");
    await clearProfileSecret(p.id);
    expect(getProfilePassword(p.id)).toBeUndefined();
  });
});
