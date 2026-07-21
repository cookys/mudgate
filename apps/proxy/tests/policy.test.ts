import { describe, it, expect } from "vitest";
import {
  assertDestinationAllowed,
  assertProdConfig,
  checkAuth,
  checkOrigin,
  defaultConfig,
  isPrivateOrBlockedIp,
} from "../src/policy.js";

describe("policy", () => {
  const dev = defaultConfig("localhost-dev");
  const prod = {
    ...defaultConfig("remote-prod"),
    authToken: "secret",
    originAllowlist: ["https://mud.example.com"],
  };

  it("blocks private IPs", () => {
    expect(isPrivateOrBlockedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrBlockedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrBlockedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrBlockedIp("8.8.8.8")).toBe(false);
  });

  it("denies unauth in prod; query token not accepted in remote-prod", () => {
    const url = new URL("http://x/ws?host=mud.revivalworld.org&port=4000");
    expect(checkAuth(url, prod)).toBe(false);
    const q = new URL("http://x/ws?token=secret");
    expect(checkAuth(q, prod)).toBe(false);
    expect(checkAuth(url, prod, undefined, "Bearer secret")).toBe(true);
    expect(checkAuth(url, prod, undefined, "Bearer wrong")).toBe(false);
  });

  it("requires Origin in prod", () => {
    expect(checkOrigin(undefined, prod)).toBe(false);
    expect(checkOrigin("https://evil.com", prod)).toBe(false);
    expect(checkOrigin("https://mud.example.com", prod)).toBe(true);
  });

  it("does not accept origin prefix tricks in dev", () => {
    expect(checkOrigin("http://127.0.0.1.evil.com", dev)).toBe(false);
    expect(checkOrigin("http://localhost.evil.com", dev)).toBe(false);
    expect(checkOrigin("http://127.0.0.1:5173", dev)).toBe(true);
  });

  it("denies non-allowlisted host in prod", async () => {
    const r = await assertDestinationAllowed("example.com", 22, prod);
    expect(r.ok).toBe(false);
  });

  it("allows RW on allowlist", async () => {
    const r = await assertDestinationAllowed("mud.revivalworld.org", 4000, prod);
    expect(r.ok).toBe(true);
    if (r.ok) expect(isPrivateOrBlockedIp(r.address)).toBe(false);
  });

  it("dev still blocks random private IPs even with relax", async () => {
    const r = await assertDestinationAllowed("10.1.2.3", 4000, dev);
    expect(r.ok).toBe(false);
  });

  it("remote-prod defaults to loopback bind", () => {
    const p = defaultConfig("remote-prod");
    expect(p.bindHost).toBe("127.0.0.1");
  });

  it("assertProdConfig fails closed without token or origin", () => {
    expect(
      assertProdConfig({
        ...defaultConfig("remote-prod"),
        authToken: null,
        originAllowlist: ["https://x.example"],
      }),
    ).toMatch(/TOKEN/);
    expect(
      assertProdConfig({
        ...defaultConfig("remote-prod"),
        authToken: "x",
        originAllowlist: [],
      }),
    ).toMatch(/ORIGIN/);
    expect(
      assertProdConfig({
        ...defaultConfig("remote-prod"),
        authToken: "x",
        originAllowlist: ["https://mud.example.com"],
      }),
    ).toBeNull();
  });
});
