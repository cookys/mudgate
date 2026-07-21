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
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
    // loopback blocked in remote-prod; allowed only when explicitly in allowlist as host 127.0.0.1 for tests
    return true;
  }
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (ip === "169.254.169.254") return true;
  return false;
}

export function checkOrigin(origin: string | undefined, cfg: ProxyConfig): boolean {
  if (cfg.mode === "localhost-dev") {
    if (!origin) return true;
    return cfg.originAllowlist.includes(origin) || origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost");
  }
  if (!origin) return false;
  if (!cfg.originAllowlist.length) return false;
  return cfg.originAllowlist.includes(origin);
}

export function checkAuth(url: URL, cfg: ProxyConfig, cookieHeader?: string): boolean {
  if (cfg.mode === "localhost-dev" && !cfg.authToken) return true;
  const token = cfg.authToken;
  if (!token) return false;
  const q = url.searchParams.get("token");
  if (q && q === token) return true;
  if (cookieHeader) {
    const m = /(?:^|;\s*)assmud_session=([^;]+)/.exec(cookieHeader);
    if (m && decodeURIComponent(m[1]!) === token) return true;
  }
  const auth = url.searchParams.get("auth");
  if (auth && auth === token) return true;
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
