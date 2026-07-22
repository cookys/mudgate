/** In-memory abuse limits (hosted-ready). Fail-closed on exceed; no payload logs. */

export type LimitConfig = {
  concurrentWsPerIp: number;
  concurrentWsPerToken: number;
  upgradesPerIpPerMin: number;
  hellosPerConnPerMin: number;
  helloTimeoutMs: number;
};

export function defaultLimits(
  mode: "remote-prod" | "localhost-dev",
): LimitConfig {
  if (mode === "localhost-dev") {
    return {
      concurrentWsPerIp: envInt("MUDGATE_LIMIT_WS_IP", 64),
      concurrentWsPerToken: envInt("MUDGATE_LIMIT_WS_TOKEN", 32),
      upgradesPerIpPerMin: envInt("MUDGATE_LIMIT_UPGRADE_IP", 120),
      hellosPerConnPerMin: envInt("MUDGATE_LIMIT_HELLO", 60),
      helloTimeoutMs: envInt("MUDGATE_HELLO_TIMEOUT_MS", 30_000),
    };
  }
  return {
    concurrentWsPerIp: envInt("MUDGATE_LIMIT_WS_IP", 8),
    concurrentWsPerToken: envInt("MUDGATE_LIMIT_WS_TOKEN", 4),
    upgradesPerIpPerMin: envInt("MUDGATE_LIMIT_UPGRADE_IP", 30),
    hellosPerConnPerMin: envInt("MUDGATE_LIMIT_HELLO", 20),
    helloTimeoutMs: envInt("MUDGATE_HELLO_TIMEOUT_MS", 10_000),
  };
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Normalize remote address for limit keys. */
export function normalizeIp(raw: string | undefined): string {
  if (!raw) return "unknown";
  let ip = raw;
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  // strip port if host:port (rare on socket.remoteAddress)
  if (ip.includes(":") && !ip.includes(".")) {
    // IPv6 leave as-is
    return ip.toLowerCase();
  }
  return ip;
}

/**
 * Transport peer IP for coarse upgrade limits.
 * Header-based client IP uses resolveEffectiveClientAddr (trusted hop only).
 * X-Forwarded-For is intentionally not trusted here (T1-site §3.3.1).
 */
export function clientIpFromRequest(req: {
  socket: { remoteAddress?: string };
  headers: { [k: string]: string | string[] | undefined };
}): string {
  return normalizeIp(req.socket.remoteAddress);
}

type Window = { count: number; resetAt: number };

export class AbuseLimiter {
  private wsByIp = new Map<string, number>();
  private wsByToken = new Map<string, number>();
  private upgrades = new Map<string, Window>();
  private hellos = new Map<string, Window>();

  constructor(private readonly cfg: LimitConfig) {}

  private hitWindow(map: Map<string, Window>, key: string, max: number): boolean {
    const now = Date.now();
    let w = map.get(key);
    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + 60_000 };
      map.set(key, w);
    }
    w.count += 1;
    return w.count <= max;
  }

  /** Call on HTTP upgrade. Returns false if rejected. */
  tryUpgrade(ip: string): boolean {
    return this.hitWindow(this.upgrades, ip, this.cfg.upgradesPerIpPerMin);
  }

  /** Acquire concurrent slot after auth. Returns release fn or null. */
  tryAcquire(ip: string, tokenKey: string): (() => void) | null {
    const nIp = this.wsByIp.get(ip) ?? 0;
    const nTok = this.wsByToken.get(tokenKey) ?? 0;
    if (nIp >= this.cfg.concurrentWsPerIp) return null;
    if (nTok >= this.cfg.concurrentWsPerToken) return null;
    this.wsByIp.set(ip, nIp + 1);
    this.wsByToken.set(tokenKey, nTok + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const a = (this.wsByIp.get(ip) ?? 1) - 1;
      const b = (this.wsByToken.get(tokenKey) ?? 1) - 1;
      if (a <= 0) this.wsByIp.delete(ip);
      else this.wsByIp.set(ip, a);
      if (b <= 0) this.wsByToken.delete(tokenKey);
      else this.wsByToken.set(tokenKey, b);
    };
  }

  tryHello(connId: string): boolean {
    return this.hitWindow(this.hellos, connId, this.cfg.hellosPerConnPerMin);
  }

  private inBytes = new Map<string, { bytes: number; resetAt: number }>();
  private outBytes = new Map<string, { bytes: number; resetAt: number }>();

  private hitBytes(
    map: Map<string, { bytes: number; resetAt: number }>,
    connId: string,
    n: number,
    maxBytes: number,
  ): boolean {
    if (n <= 0) return true;
    const now = Date.now();
    let w = map.get(connId);
    if (!w || now >= w.resetAt) {
      w = { bytes: 0, resetAt: now + 60_000 };
      map.set(connId, w);
    }
    w.bytes += n;
    return w.bytes <= maxBytes;
  }

  /** Per-connection inbound (client→proxy) byte budget, rolling minute. */
  tryInboundBytes(connId: string, n: number, maxBytes: number): boolean {
    return this.hitBytes(this.inBytes, connId, n, maxBytes);
  }

  /** Per-connection outbound (proxy→client) byte budget, rolling minute. */
  tryOutboundBytes(connId: string, n: number, maxBytes: number): boolean {
    return this.hitBytes(this.outBytes, connId, n, maxBytes);
  }

  /** Drop per-conn byte windows when connection ends. */
  releaseConnBytes(connId: string): void {
    this.inBytes.delete(connId);
    this.outBytes.delete(connId);
  }

  inboundBudget(mode: "remote-prod" | "localhost-dev"): number {
    const env = process.env.MUDGATE_LIMIT_IN_BYTES;
    if (env && Number(env) > 0) return Number(env);
    return mode === "remote-prod" ? 2 * 1024 * 1024 : 16 * 1024 * 1024;
  }

  outboundBudget(mode: "remote-prod" | "localhost-dev"): number {
    const env = process.env.MUDGATE_LIMIT_OUT_BYTES;
    if (env && Number(env) > 0) return Number(env);
    return mode === "remote-prod" ? 16 * 1024 * 1024 : 64 * 1024 * 1024;
  }

  get helloTimeoutMs(): number {
    return this.cfg.helloTimeoutMs;
  }

  /** Test helper */
  snapshot() {
    return {
      wsByIp: Object.fromEntries(this.wsByIp),
      wsByToken: Object.fromEntries(this.wsByToken),
    };
  }
}
