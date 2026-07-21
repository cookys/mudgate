import { describe, it, expect } from "vitest";
import {
  assertDestinationAllowed,
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

  it("denies unauth in prod", () => {
    const url = new URL("http://x/ws?host=mud.revivalworld.org&port=4000");
    expect(checkAuth(url, prod)).toBe(false);
    const ok = new URL("http://x/ws?token=secret");
    expect(checkAuth(ok, prod)).toBe(true);
  });

  it("requires Origin in prod", () => {
    expect(checkOrigin(undefined, prod)).toBe(false);
    expect(checkOrigin("https://evil.com", prod)).toBe(false);
    expect(checkOrigin("https://mud.example.com", prod)).toBe(true);
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
});
