import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type ProxyConfig = {
  mode: "remote-prod" | "localhost-dev";
  /**
   * T1-site overlay (ASSMUD_SITE_MODE=1). Only legal with remote-prod.
   * Forces hello dest ∈ allowlist; empty allowlist fails startup.
   */
  siteMode: boolean;
  bindHost: string;
  bindPort: number;
  /** Required in remote-prod */
  authToken: string | null;
  allowlist: Array<{ host: string; ports: number[] }>;
  /** If true (dev), allow any non-private host:port when not on allowlist */
  relaxAllowlist: boolean;
  originAllowlist: string[];
  /**
   * Trusted reverse-proxy hops (CIDR or exact IP). Peer must match to honor
   * CF-Connecting-IP / X-Real-IP. Empty = never trust headers (default).
   * "unix" is reserved for future UDS peers.
   */
  trustedHops: string[];
  /** Optional lock to a single client-IP header name (lowercase). */
  clientIpHeader: string | null;
};

/** Parse ASSMUD_SITE_MODE=1|true|yes */
export function envTruthy(raw: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((raw ?? "").trim().toLowerCase());
}

/** Parse ASSMUD_TRUSTED_HOP=127.0.0.1/32,10.0.0.0/8 or unix */
export function parseTrustedHops(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Default RW host ports (player + wiz). Extra destinations: ASSMUD_ALLOWLIST. */
export const RW_DEFAULT_PORTS = [4000, 4001, 5000, 6000] as const;

/**
 * Parse ASSMUD_ALLOWLIST=host:port,host:port2
 * Multiple ports for same host are merged.
 */
export function parseAllowlistEnv(
  raw: string | undefined,
): Array<{ host: string; ports: number[] }> {
  if (!raw?.trim()) return [];
  const map = new Map<string, Set<number>>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    const idx = s.lastIndexOf(":");
    if (idx <= 0) continue;
    const host = s.slice(0, idx).trim().toLowerCase();
    const port = Number(s.slice(idx + 1));
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) continue;
    let set = map.get(host);
    if (!set) {
      set = new Set();
      map.set(host, set);
    }
    set.add(port);
  }
  return [...map.entries()].map(([host, ports]) => ({
    host,
    ports: [...ports].sort((a, b) => a - b),
  }));
}

function mergeAllowlist(
  base: Array<{ host: string; ports: number[] }>,
  extra: Array<{ host: string; ports: number[] }>,
): Array<{ host: string; ports: number[] }> {
  const map = new Map<string, Set<number>>();
  for (const e of [...base, ...extra]) {
    const h = e.host.toLowerCase();
    let set = map.get(h);
    if (!set) {
      set = new Set();
      map.set(h, set);
    }
    for (const p of e.ports) set.add(p);
  }
  return [...map.entries()].map(([host, ports]) => ({
    host,
    ports: [...ports].sort((a, b) => a - b),
  }));
}

export function defaultConfig(mode: "remote-prod" | "localhost-dev"): ProxyConfig {
  const siteMode = envTruthy(process.env.ASSMUD_SITE_MODE);
  const envExtra = parseAllowlistEnv(process.env.ASSMUD_ALLOWLIST);
  const rwBase = [
    {
      host: "mud.revivalworld.org",
      ports: [...RW_DEFAULT_PORTS],
    },
  ];
  const trustedHops = parseTrustedHops(process.env.ASSMUD_TRUSTED_HOP);
  const clientIpHeader = process.env.ASSMUD_CLIENT_IP_HEADER?.trim().toLowerCase() || null;

  if (mode === "localhost-dev") {
    return {
      mode,
      siteMode,
      bindHost: "127.0.0.1",
      bindPort: 7788,
      authToken: process.env.ASSMUD_AUTH_TOKEN ?? null,
      allowlist: mergeAllowlist(
        [
          ...rwBase,
          { host: "127.0.0.1", ports: [4000, 2323] }, // local mock mud in tests
        ],
        envExtra,
      ),
      // Dev: any public host:port still ok when not listed (custom MUD probe)
      relaxAllowlist: true,
      originAllowlist: ["http://127.0.0.1:5173", "http://localhost:5173"],
      trustedHops,
      clientIpHeader,
    };
  }

  // Site mode: allowlist is ONLY ASSMUD_ALLOWLIST (本站 mud), no RW defaults.
  const allowlist = siteMode ? envExtra : mergeAllowlist(rwBase, envExtra);

  return {
    mode,
    siteMode,
    // Self-host / prod: loopback only; TLS terminator or tunnel fronts public traffic.
    bindHost: process.env.ASSMUD_BIND_HOST ?? "127.0.0.1",
    bindPort: Number(process.env.PORT ?? 7788),
    authToken: process.env.ASSMUD_AUTH_TOKEN ?? null,
    allowlist,
    relaxAllowlist: false,
    originAllowlist: (process.env.ASSMUD_ORIGIN_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    trustedHops,
    clientIpHeader,
  };
}

/**
 * Fail-closed gates before listen.
 * - remote-prod: token + origin
 * - site mode: only with remote-prod; non-empty allowlist
 */
export function assertProdConfig(cfg: ProxyConfig): string | null {
  if (cfg.siteMode) {
    if (cfg.mode !== "remote-prod") {
      return "ASSMUD_SITE_MODE=1 requires ASSMUD_PROXY_MODE=remote-prod (got " +
        cfg.mode +
        ")";
    }
    if (!cfg.allowlist.length) {
      return "ASSMUD_SITE_MODE=1 requires non-empty ASSMUD_ALLOWLIST (host:port,...)";
    }
  }
  if (cfg.mode !== "remote-prod") return null;
  if (!cfg.authToken) return "ASSMUD_AUTH_TOKEN required for remote-prod";
  if (!cfg.originAllowlist.length)
    return "ASSMUD_ORIGIN_ALLOWLIST required for remote-prod (empty fail-closed)";
  return null;
}

export function isPrivateOrBlockedIp(ip: string): boolean {
  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    return isPrivateOrBlockedIp(ip.slice(7));
  }
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "0.0.0.0" ||
    ip === "::" ||
    ip === "::0" ||
    ip === "0:0:0:0:0:0:0:0"
  ) {
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

  // Query token: localhost-dev only (avoids access-log leakage in prod)
  if (cfg.mode === "localhost-dev") {
    const q = url.searchParams.get("token") ?? url.searchParams.get("auth");
    if (q && safeEqual(q, token)) return true;
  }
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

  // Site / local: allowlisted loopback mud is intentional (gateway co-located).
  const loopbackHost =
    host === "127.0.0.1" || host === "localhost" || host === "::1";
  const loopbackAllow =
    onList &&
    loopbackHost &&
    (cfg.mode === "localhost-dev" || cfg.siteMode);

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
