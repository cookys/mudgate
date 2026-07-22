import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";
import type { ProxyConfig } from "./policy.js";
import { normalizeIp } from "./limits.js";

/**
 * Whether transport peer is a trusted reverse-proxy hop (MUDGATE_TRUSTED_HOP).
 * Supports exact IP and simple IPv4 CIDR (/8 /16 /24 /32).
 */
export function isTrustedPeer(peer: string, hops: string[]): boolean {
  const ip = normalizeIp(peer);
  if (!ip || ip === "unknown") return false;
  for (const hop of hops) {
    if (hop === "unix") continue; // UDS not exposed on HTTP socket path yet
    if (hop.includes("/")) {
      if (matchCidr(ip, hop)) return true;
    } else if (normalizeIp(hop) === ip) {
      return true;
    }
  }
  return false;
}

function matchCidr(ip: string, cidr: string): boolean {
  const [net, bitsRaw] = cidr.split("/");
  if (!net || bitsRaw == null) return false;
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (isIP(ip) !== 4 || isIP(net) !== 4) return false;
  const ipN = ipv4ToInt(ip);
  const netN = ipv4ToInt(net);
  if (ipN == null || netN == null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return null;
  return ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0;
}

function headerValue(
  headers: IncomingMessage["headers"],
  name: string,
): string | undefined {
  const v = headers[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

function isValidClientIp(raw: string): boolean {
  const ip = normalizeIp(raw.trim());
  if (!ip || ip === "unknown") return false;
  return isIP(ip) !== 0;
}

export type EffectiveAddrResult =
  | {
      ok: true;
      transportPeer: string;
      effectiveClientAddr: string;
      headerSource: "peer" | "cf-connecting-ip" | "x-real-ip" | "locked-header";
      headerMismatchWarn?: boolean;
    }
  | {
      ok: false;
      transportPeer: string;
      reason: "missing_client_ip_header" | "invalid_client_ip_header";
    };

/**
 * Resolve effective client address per T1-site §3.3.1.
 * - Default: transport peer
 * - Trusted hop: CF-Connecting-IP → X-Real-IP (or locked header); **no XFF**
 * - Trusted hop + missing/invalid header: fail-closed (ok:false)
 */
export function resolveEffectiveClientAddr(
  req: {
    socket: { remoteAddress?: string };
    headers: IncomingMessage["headers"];
  },
  cfg: Pick<ProxyConfig, "trustedHops" | "clientIpHeader">,
): EffectiveAddrResult {
  const transportPeer = normalizeIp(req.socket.remoteAddress);

  if (!cfg.trustedHops.length || !isTrustedPeer(transportPeer, cfg.trustedHops)) {
    return {
      ok: true,
      transportPeer,
      effectiveClientAddr: transportPeer,
      headerSource: "peer",
    };
  }

  // Locked single header
  if (cfg.clientIpHeader) {
    const raw = headerValue(req.headers, cfg.clientIpHeader);
    if (!raw?.trim()) {
      return { ok: false, transportPeer, reason: "missing_client_ip_header" };
    }
    if (!isValidClientIp(raw)) {
      return { ok: false, transportPeer, reason: "invalid_client_ip_header" };
    }
    return {
      ok: true,
      transportPeer,
      effectiveClientAddr: normalizeIp(raw.trim()),
      headerSource: "locked-header",
    };
  }

  const cf = headerValue(req.headers, "cf-connecting-ip");
  const xri = headerValue(req.headers, "x-real-ip");
  const cfOk = cf?.trim() && isValidClientIp(cf);
  const xriOk = xri?.trim() && isValidClientIp(xri);

  if (!cfOk && !xriOk) {
    return { ok: false, transportPeer, reason: "missing_client_ip_header" };
  }

  if (cfOk && xriOk) {
    const a = normalizeIp(cf!.trim());
    const b = normalizeIp(xri!.trim());
    if (a !== b) {
      return {
        ok: true,
        transportPeer,
        effectiveClientAddr: a,
        headerSource: "cf-connecting-ip",
        headerMismatchWarn: true,
      };
    }
    return {
      ok: true,
      transportPeer,
      effectiveClientAddr: a,
      headerSource: "cf-connecting-ip",
    };
  }

  if (cfOk) {
    return {
      ok: true,
      transportPeer,
      effectiveClientAddr: normalizeIp(cf!.trim()),
      headerSource: "cf-connecting-ip",
    };
  }

  return {
    ok: true,
    transportPeer,
    effectiveClientAddr: normalizeIp(xri!.trim()),
    headerSource: "x-real-ip",
  };
}

/**
 * Legacy helper kept for tests that still import clientIpFromRequest.
 * Prefer resolveEffectiveClientAddr with ProxyConfig.
 * MUDGATE_TRUST_PROXY=1 alone no longer trusts XFF (removed per T1 plan).
 */
export function clientIpFromRequest(req: {
  socket: { remoteAddress?: string };
  headers: IncomingMessage["headers"];
}): string {
  return normalizeIp(req.socket.remoteAddress);
}
