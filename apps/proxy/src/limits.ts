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
      concurrentWsPerIp: envInt("ASSMUD_LIMIT_WS_IP", 64),
      concurrentWsPerToken: envInt("ASSMUD_LIMIT_WS_TOKEN", 32),
      upgradesPerIpPerMin: envInt("ASSMUD_LIMIT_UPGRADE_IP", 120),
      hellosPerConnPerMin: envInt("ASSMUD_LIMIT_HELLO", 60),
      helloTimeoutMs: envInt("ASSMUD_HELLO_TIMEOUT_MS", 30_000),
    };
  }
  return {
    concurrentWsPerIp: envInt("ASSMUD_LIMIT_WS_IP", 8),
    concurrentWsPerToken: envInt("ASSMUD_LIMIT_WS_TOKEN", 4),
    upgradesPerIpPerMin: envInt("ASSMUD_LIMIT_UPGRADE_IP", 30),
    hellosPerConnPerMin: envInt("ASSMUD_LIMIT_HELLO", 20),
    helloTimeoutMs: envInt("ASSMUD_HELLO_TIMEOUT_MS", 10_000),
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
