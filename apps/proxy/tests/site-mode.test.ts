import { describe, it, expect, afterEach } from "vitest";
import {
  assertDestinationAllowed,
  assertProdConfig,
  defaultConfig,
  envTruthy,
  parseAllowlistEnv,
  type ProxyConfig,
} from "../src/policy.js";
import {
  isTrustedPeer,
  resolveEffectiveClientAddr,
} from "../src/clientAddr.js";
import { tokenHmac, writeAudit, type AuditEvent } from "../src/audit.js";

const envKeys = [
  "ASSMUD_SITE_MODE",
  "ASSMUD_ALLOWLIST",
  "ASSMUD_AUTH_TOKEN",
  "ASSMUD_ORIGIN_ALLOWLIST",
  "ASSMUD_TRUSTED_HOP",
  "ASSMUD_CLIENT_IP_HEADER",
  "ASSMUD_PROXY_MODE",
] as const;

const saved: Record<string, string | undefined> = {};

function stashEnv() {
  for (const k of envKeys) saved[k] = process.env[k];
}
function restoreEnv() {
  for (const k of envKeys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

afterEach(() => {
  restoreEnv();
});

function baseSiteCfg(over: Partial<ProxyConfig> = {}): ProxyConfig {
  return {
    mode: "remote-prod",
    siteMode: true,
    bindHost: "127.0.0.1",
    bindPort: 7788,
    authToken: "site-secret",
    allowlist: [{ host: "127.0.0.1", ports: [4000] }],
    relaxAllowlist: false,
    originAllowlist: ["https://mud.example.com"],
    trustedHops: [],
    clientIpHeader: null,
    ...over,
  };
}

describe("site mode config", () => {
  it("envTruthy parses ASSMUD_SITE_MODE", () => {
    expect(envTruthy("1")).toBe(true);
    expect(envTruthy("true")).toBe(true);
    expect(envTruthy("0")).toBe(false);
    expect(envTruthy(undefined)).toBe(false);
  });

  it("SITE_MODE=1 + localhost-dev fails assertProdConfig", () => {
    stashEnv();
    process.env.ASSMUD_SITE_MODE = "1";
    process.env.ASSMUD_ALLOWLIST = "127.0.0.1:4000";
    const cfg = defaultConfig("localhost-dev");
    expect(cfg.siteMode).toBe(true);
    expect(assertProdConfig(cfg)).toMatch(/remote-prod/);
  });

  it("SITE_MODE=1 + empty allowlist fails startup gate", () => {
    stashEnv();
    process.env.ASSMUD_SITE_MODE = "1";
    delete process.env.ASSMUD_ALLOWLIST;
    process.env.ASSMUD_AUTH_TOKEN = "secret";
    process.env.ASSMUD_ORIGIN_ALLOWLIST = "https://mud.example.com";
    const cfg = defaultConfig("remote-prod");
    expect(cfg.siteMode).toBe(true);
    expect(cfg.allowlist).toEqual([]);
    expect(assertProdConfig(cfg)).toMatch(/ASSMUD_ALLOWLIST/);
  });

  it("SITE_MODE=1 + allowlist + remote-prod passes gate", () => {
    stashEnv();
    process.env.ASSMUD_SITE_MODE = "1";
    process.env.ASSMUD_ALLOWLIST = "127.0.0.1:4000";
    process.env.ASSMUD_AUTH_TOKEN = "secret";
    process.env.ASSMUD_ORIGIN_ALLOWLIST = "https://mud.example.com";
    const cfg = defaultConfig("remote-prod");
    expect(cfg.siteMode).toBe(true);
    expect(cfg.allowlist).toEqual([{ host: "127.0.0.1", ports: [4000] }]);
    expect(assertProdConfig(cfg)).toBeNull();
  });

  it("site mode denies non-allowlisted hello dest", async () => {
    const cfg = baseSiteCfg();
    const denied = await assertDestinationAllowed("evil.example", 23, cfg);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toMatch(/allowlist/);
  });

  it("site mode allows allowlisted loopback mud", async () => {
    const cfg = baseSiteCfg();
    const ok = await assertDestinationAllowed("127.0.0.1", 4000, cfg);
    expect(ok.ok).toBe(true);
  });

  it("parseAllowlistEnv still works", () => {
    expect(parseAllowlistEnv("mud.local:4000")).toEqual([
      { host: "mud.local", ports: [4000] },
    ]);
  });
});

describe("effectiveClientAddr", () => {
  it("defaults to transport peer", () => {
    const r = resolveEffectiveClientAddr(
      {
        socket: { remoteAddress: "9.9.9.9" },
        headers: { "x-real-ip": "1.2.3.4" },
      },
      { trustedHops: [], clientIpHeader: null },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.effectiveClientAddr).toBe("9.9.9.9");
      expect(r.headerSource).toBe("peer");
    }
  });

  it("ignores forged X-Real-IP from non-trusted peer", () => {
    const r = resolveEffectiveClientAddr(
      {
        socket: { remoteAddress: "8.8.8.8" },
        headers: { "x-real-ip": "1.2.3.4" },
      },
      { trustedHops: ["127.0.0.1/32"], clientIpHeader: null },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.effectiveClientAddr).toBe("8.8.8.8");
  });

  it("trusted hop + missing header fails closed", () => {
    const r = resolveEffectiveClientAddr(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {},
      },
      { trustedHops: ["127.0.0.1/32"], clientIpHeader: null },
    );
    expect(r.ok).toBe(false);
  });

  it("trusted hop uses CF-Connecting-IP over X-Real-IP", () => {
    const r = resolveEffectiveClientAddr(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          "cf-connecting-ip": "203.0.113.9",
          "x-real-ip": "198.51.100.1",
        },
      },
      { trustedHops: ["127.0.0.1/32"], clientIpHeader: null },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.effectiveClientAddr).toBe("203.0.113.9");
      expect(r.headerMismatchWarn).toBe(true);
    }
  });

  it("does not parse X-Forwarded-For", () => {
    const r = resolveEffectiveClientAddr(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
      },
      { trustedHops: ["127.0.0.1/32"], clientIpHeader: null },
    );
    // XFF alone is not enough — fail closed
    expect(r.ok).toBe(false);
  });

  it("isTrustedPeer matches CIDR", () => {
    expect(isTrustedPeer("10.1.2.3", ["10.0.0.0/8"])).toBe(true);
    expect(isTrustedPeer("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
  });
});

describe("audit", () => {
  it("tokenHmac is stable truncated hmac not raw token", () => {
    const h = tokenHmac("super-secret-token", "server-key");
    expect(h).toHaveLength(16);
    expect(h).not.toContain("super");
    expect(tokenHmac("super-secret-token", "server-key")).toBe(h);
  });

  it("writeAudit emits JSON without password/payload/token fields", () => {
    const lines: string[] = [];
    const evt: AuditEvent = {
      event: "hello",
      time: "2026-07-22T00:00:00.000Z",
      transportPeer: "127.0.0.1",
      effectiveClientAddr: "203.0.113.1",
      host: "127.0.0.1",
      port: 4000,
      ok: true,
      siteMode: true,
    };
    writeAudit(evt, (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    const obj = JSON.parse(lines[0]!);
    expect(obj.event).toBe("hello");
    expect(obj.password).toBeUndefined();
    expect(obj.payload).toBeUndefined();
    expect(obj.token).toBeUndefined();
    expect(JSON.stringify(obj)).not.toMatch(/password/i);
  });
});
