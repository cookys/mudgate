import { describe, it, expect } from "vitest";
import { AbuseLimiter, defaultLimits, normalizeIp } from "../src/limits.js";

describe("AbuseLimiter", () => {
  it("normalizes IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });

  it("enforces concurrent WS per IP", () => {
    const lim = new AbuseLimiter({
      ...defaultLimits("remote-prod"),
      concurrentWsPerIp: 2,
      concurrentWsPerToken: 10,
    });
    const a = lim.tryAcquire("1.1.1.1", "t");
    const b = lim.tryAcquire("1.1.1.1", "t2");
    const c = lim.tryAcquire("1.1.1.1", "t3");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).toBeNull();
    a!();
    const d = lim.tryAcquire("1.1.1.1", "t3");
    expect(d).not.toBeNull();
    d!();
    b!();
  });

  it("enforces concurrent WS per token", () => {
    const lim = new AbuseLimiter({
      ...defaultLimits("remote-prod"),
      concurrentWsPerIp: 100,
      concurrentWsPerToken: 1,
    });
    const a = lim.tryAcquire("1.1.1.1", "tok");
    const b = lim.tryAcquire("2.2.2.2", "tok");
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    a!();
  });

  it("rate-limits upgrades per IP per minute", () => {
    const lim = new AbuseLimiter({
      ...defaultLimits("remote-prod"),
      upgradesPerIpPerMin: 3,
    });
    expect(lim.tryUpgrade("9.9.9.9")).toBe(true);
    expect(lim.tryUpgrade("9.9.9.9")).toBe(true);
    expect(lim.tryUpgrade("9.9.9.9")).toBe(true);
    expect(lim.tryUpgrade("9.9.9.9")).toBe(false);
  });

  it("hosted defaults tighter than dev", () => {
    expect(defaultLimits("remote-prod").concurrentWsPerIp).toBeLessThan(
      defaultLimits("localhost-dev").concurrentWsPerIp,
    );
  });
});
