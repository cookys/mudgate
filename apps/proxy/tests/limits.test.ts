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

  it("enforces inbound and outbound byte budgets per conn", () => {
    const lim = new AbuseLimiter(defaultLimits("remote-prod"));
    const inMax = lim.inboundBudget("remote-prod");
    const outMax = lim.outboundBudget("remote-prod");
    expect(inMax).toBe(2 * 1024 * 1024);
    expect(outMax).toBe(16 * 1024 * 1024);
    expect(lim.inboundBudget("localhost-dev")).toBe(16 * 1024 * 1024);
    expect(lim.outboundBudget("localhost-dev")).toBe(64 * 1024 * 1024);

    expect(lim.tryInboundBytes("c1", inMax, inMax)).toBe(true);
    expect(lim.tryInboundBytes("c1", 1, inMax)).toBe(false);

    expect(lim.tryOutboundBytes("c1", outMax, outMax)).toBe(true);
    expect(lim.tryOutboundBytes("c1", 1, outMax)).toBe(false);

    lim.releaseConnBytes("c1");
    expect(lim.tryInboundBytes("c1", 1, inMax)).toBe(true);
    expect(lim.tryOutboundBytes("c1", 1, outMax)).toBe(true);
  });
});
