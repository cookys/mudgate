import { normalizeIp } from "./limits.js";

/**
 * HAProxy PROXY protocol v1 (text) — experimental (MUDGATE_PROXY_PROTOCOL=1).
 * @see docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md §3.3.2
 *
 * Uses regex (not node:net isIP) so unit tests can mock net.connect without
 * breaking header formatting.
 */

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function envProxyProtocolEnabled(
  raw: string | undefined = process.env.MUDGATE_PROXY_PROTOCOL,
): boolean {
  return ["1", "true", "yes", "on"].includes((raw ?? "0").trim().toLowerCase());
}

function isSafeIpv4(ip: string): boolean {
  const n = normalizeIp(ip);
  return Boolean(n && IPV4_RE.test(n));
}

function isSafePort(p: number): boolean {
  return Number.isInteger(p) && p >= 0 && p <= 65535;
}

/**
 * Build PROXY v1 header written once after TCP connect, before any telnet bytes.
 * Non-IPv4 client → `PROXY UNKNOWN\r\n` (plan C0 choice).
 * Invalid fields never injected as free text.
 */
export function formatProxyV1Header(opts: {
  srcIp: string;
  srcPort?: number;
  dstIp: string;
  dstPort: number;
}): string {
  const src = normalizeIp(opts.srcIp);
  const dst = normalizeIp(opts.dstIp);
  const srcPort = opts.srcPort ?? 0;
  const dstPort = opts.dstPort;

  if (!isSafeIpv4(src) || !isSafeIpv4(dst) || !isSafePort(srcPort) || !isSafePort(dstPort)) {
    return "PROXY UNKNOWN\r\n";
  }

  // PROXY TCP4 <src> <dst> <srcport> <dstport>\r\n
  const line = `PROXY TCP4 ${src} ${dst} ${srcPort} ${dstPort}\r\n`;
  if (line.length > 108) {
    // v1 max ~107 bytes incl CRLF; never write oversized
    return "PROXY UNKNOWN\r\n";
  }
  return line;
}
