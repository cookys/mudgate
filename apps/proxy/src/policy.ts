import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type ProxyConfig = {
  mode: "remote-prod" | "localhost-dev";
  bindHost: string;
  bindPort: number;
  /** Required in remote-prod */
  authToken: string | null;
  allowlist: Array<{ host: string; ports: number[] }>;
  /** If true (dev), allow any non-private host:port when not on allowlist */
  relaxAllowlist: boolean;
  originAllowlist: string[];
};

export function defaultConfig(mode: "remote-prod" | "localhost-dev"): ProxyConfig {
  if (mode === "localhost-dev") {
    return {
      mode,
      bindHost: "127.0.0.1",
      bindPort: 7788,
      authToken: process.env.ASSMUD_AUTH_TOKEN ?? null,
      allowlist: [
        { host: "mud.revivalworld.org", ports: [4000, 5000, 6000] },
        { host: "127.0.0.1", ports: [4000, 2323] }, // local mock mud in tests only — still validated
      ],
      relaxAllowlist: true,
      originAllowlist: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };
  }
  return {
    mode,
    bindHost: "0.0.0.0",
    bindPort: Number(process.env.PORT ?? 7788),
    authToken: process.env.ASSMUD_AUTH_TOKEN ?? null,
    allowlist: [{ host: "mud.revivalworld.org", ports: [4000, 5000, 6000] }],
    relaxAllowlist: false,
    originAllowlist: (process.env.ASSMUD_ORIGIN_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function isPrivateOrBlockedIp(ip: string): boolean {
  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    return isPrivateOrBlockedIp(ip.slice(7));
  }
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
    return true;
  }
  // IPv6 ULA / link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
    return true;
  }
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  // CGNAT 100.64.0.0/10
  const cgn = /^100\.(\d+)\./.exec(ip);
  if (cgn) {
    const n = Number(cgn[1]);
    if (n >= 64 && n <= 127) return true;
  }
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  } catch {
    return false;
  }
}

export function checkOrigin(origin: string | undefined, cfg: ProxyConfig): boolean {
  if (!origin) {
    return cfg.mode === "localhost-dev";
  }
  if (cfg.mode === "localhost-dev") {
    return cfg.originAllowlist.includes(origin) || isLocalDevOrigin(origin);
  }
  if (!cfg.originAllowlist.length) return false;
  return cfg.originAllowlist.includes(origin);
}

/** Constant-time string compare for tokens (equal length after pad). */
export function safeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function checkAuth(
  url: URL,
  cfg: ProxyConfig,
  cookieHeader?: string,
  authorization?: string,
): boolean {
  if (cfg.mode === "localhost-dev" && !cfg.authToken) return true;
  const token = cfg.authToken;
  if (!token) return false;

  // Prefer Authorization: Bearer (not logged in query string)
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const t = authorization.slice(7).trim();
    if (safeEqual(t, token)) return true;
  }

  if (cookieHeader) {
    const m = /(?:^|;\s*)assmud_session=([^;]+)/.exec(cookieHeader);
    if (m) {
      try {
        if (safeEqual(decodeURIComponent(m[1]!), token)) return true;
      } catch {
        /* ignore */
      }
    }
  }

  // Query token still accepted for local smoke; prefer header/cookie in prod
  const q = url.searchParams.get("token") ?? url.searchParams.get("auth");
  if (q && safeEqual(q, token)) return true;
  return false;
}

export async function assertDestinationAllowed(
  host: string,
  port: number,
  cfg: ProxyConfig,
): Promise<{ ok: true; address: string } | { ok: false; reason: string }> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: "invalid port" };
  }

  const onList = cfg.allowlist.some(
    (e) => e.host.toLowerCase() === host.toLowerCase() && e.ports.includes(port),
  );

  if (!onList && !cfg.relaxAllowlist) {
    return { ok: false, reason: "host not on allowlist" };
  }

  let address: string;
  if (isIP(host)) {
    address = host;
  } else {
    try {
      const r = await lookup(host, { family: 4 });
      address = r.address;
    } catch {
      return { ok: false, reason: "dns failed" };
    }
  }

  // Always block cloud metadata
  if (address === "169.254.169.254") {
    return { ok: false, reason: "blocked metadata ip" };
  }

  const loopbackAllow =
    onList && (host === "127.0.0.1" || host === "localhost") && cfg.mode === "localhost-dev";

  if (isPrivateOrBlockedIp(address) && !loopbackAllow) {
    return { ok: false, reason: "private or blocked ip" };
  }

  // re-check allowlist for non-relaxed
  if (!onList && cfg.relaxAllowlist) {
    // public hosts OK in dev relax mode
    if (isPrivateOrBlockedIp(address)) {
      return { ok: false, reason: "private or blocked ip" };
    }
  }

  return { ok: true, address };
}
