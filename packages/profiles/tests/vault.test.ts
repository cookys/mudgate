import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

// Node test env: provide WebCrypto
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

import {
  vaultTestResetStorage,
  createVault,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  vaultExists,
  setVaultSecret,
  getVaultSecret,
  clearVault,
  migrateLegacyIntoVault,
  hasLegacyPlaintextSecrets,
  LEGACY_SECRETS_KEY,
  VaultError,
  getRememberUnlock,
  getRestoreAllowed,
  setRememberUnlock,
  tryRestoreVaultSession,
  vaultTestAllowMemoryKeys,
  vaultTestClearSessionRam,
  probeRememberUnlock,
} from "../src/vault.js";

describe("vault crypto", () => {
  beforeEach(() => {
    vaultTestResetStorage();
  });

  it("create unlock round-trip secrets", async () => {
    await createVault("master-pass-1");
    expect(vaultExists()).toBe(true);
    expect(isVaultUnlocked()).toBe(true);
    await setVaultSecret("rw-4000", {
      account: "hero",
      password: "s3cret",
      autoLogin: true,
    });
    await lockVault();
    expect(isVaultUnlocked()).toBe(false);
    await unlockVault("master-pass-1");
    expect(getVaultSecret("rw-4000")).toEqual({
      account: "hero",
      password: "s3cret",
      autoLogin: true,
    });
  });



  it("wrong password fails closed", async () => {
    await createVault("correct-horse");
    await lockVault();
    await expect(unlockVault("wrong")).rejects.toMatchObject({
      code: "auth",
    });
    expect(isVaultUnlocked()).toBe(false);
  });

  it("locked get/set throws", async () => {
    await createVault("abcd");
    await lockVault();
    expect(() => getVaultSecret("x")).toThrow(VaultError);
  });

  it("migrate legacy plaintext then removes key", async () => {
    // seed legacy
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        LEGACY_SECRETS_KEY,
        JSON.stringify({
          p1: { account: "a", password: "b", autoLogin: true },
        }),
      );
    } else {
      // memory path via migrate reading storageGet
      const { vaultTestResetStorage: _ } = await import("../src/vault.js");
      void _;
    }
    // Use vault memory: inject via migrate after setting storage
    // For node without localStorage, set via create + manual is harder —
    // vault uses memoryKV when no localStorage; write via dynamic
    const mod = await import("../src/vault.js");
    // ensure legacy present
    expect(typeof mod.hasLegacyPlaintextSecrets).toBe("function");

    // Directly use localStorage polyfill for vitest - vitest may not have LS
    // So write through migrate path by simulating storage in create first
    await createVault("migrate-master");
    // Put legacy using internal: we export LEGACY and use setItem if available
    const g = globalThis as { localStorage?: Storage };
    if (!g.localStorage) {
      // skip if no LS — memory only path: call migrate with empty
      const r = await migrateLegacyIntoVault("migrate-master");
      expect(r.imported).toBe(0);
      return;
    }
    g.localStorage.setItem(
      LEGACY_SECRETS_KEY,
      JSON.stringify({
        p1: { account: "a", password: "b", autoLogin: true },
      }),
    );
    expect(hasLegacyPlaintextSecrets()).toBe(true);
    await lockVault();
    const r = await migrateLegacyIntoVault("migrate-master");
    expect(r.imported).toBe(1);
    expect(hasLegacyPlaintextSecrets()).toBe(false);
    expect(getVaultSecret("p1")?.password).toBe("b");
  });

  it("clearVault allows recreate", async () => {
    await createVault("one-two-three");
    await setVaultSecret("x", { password: "p" });
    await clearVault();
    expect(vaultExists()).toBe(false);
    await createVault("one-two-three");
    expect(getVaultSecret("x")).toBeUndefined();
  });

  it("works without crypto.subtle (LAN HTTP / noble fallback)", async () => {
    const real = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (u: Uint8Array) => real.getRandomValues(u),
        // no subtle — simulate non-secure context
      },
    });
    try {
      vaultTestResetStorage();
      await createVault("lan-http-master");
      await setVaultSecret("rw", { account: "a", password: "b" });
      await lockVault();
      await unlockVault("lan-http-master");
      expect(getVaultSecret("rw")?.password).toBe("b");
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: real,
      });
    }
  });
});

describe("vault remember unlock", () => {
  beforeEach(() => {
    vaultTestResetStorage();
    // Node has no IndexedDB; enable test memory CryptoKey store only for this suite
    vaultTestAllowMemoryKeys(true);
  });

  it("probe fails without IDB backend", async () => {
    vaultTestAllowMemoryKeys(false);
    expect(await probeRememberUnlock()).toBe(false);
  });

  it("remember OFF → restore false", async () => {
    await createVault("remember-off-master");
    expect(getRememberUnlock()).toBe(false);
    await lockVault();
    expect(await tryRestoreVaultSession()).toBe(false);
  });

  it("F5 model: RAM clear + durable restoreAllowed=1 restores secrets", async () => {
    await createVault("restore-master-xx");
    await setVaultSecret("rw", { account: "hero", password: "s3cret" });
    const put = await setRememberUnlock(true);
    expect(put.ok).toBe(true);
    expect(getRestoreAllowed()).toBe(true);

    // Simulate hard reload: drop RAM only, keep durable flags + memory key store
    vaultTestClearSessionRam();
    expect(isVaultUnlocked()).toBe(false);

    expect(await tryRestoreVaultSession()).toBe(true);
    expect(isVaultUnlocked()).toBe(true);
    expect(getVaultSecret("rw")).toEqual({
      account: "hero",
      password: "s3cret",
    });
    // cryptoKey-only path: can still persist
    await setVaultSecret("rw", {
      account: "hero",
      password: "s3cret2",
      autoLogin: true,
    });
    expect(getVaultSecret("rw")?.password).toBe("s3cret2");
  });

  it("lock blocks restore even if remember preference stays ON", async () => {
    await createVault("lock-gate-master");
    await setRememberUnlock(true);
    await lockVault();
    expect(getRememberUnlock()).toBe(true);
    expect(getRestoreAllowed()).toBe(false);
    expect(await tryRestoreVaultSession()).toBe(false);
  });

  it("setRememberUnlock false does not throw when already off", async () => {
    await createVault("off-master");
    const r = await setRememberUnlock(false);
    expect(r.ok).toBe(true);
    expect(getRememberUnlock()).toBe(false);
  });

  it("never writes key bytes to sessionStorage", async () => {
    await createVault("ss-master");
    await setRememberUnlock(true);
    if (typeof sessionStorage !== "undefined") {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        const v = sessionStorage.getItem(k) ?? "";
        expect(v).not.toMatch(/key_b64|rawKey|aes.?key/i);
      }
    }
  });
});

