# Phase 1a POST-FIX pack R4

===== FILE: apps/proxy/src/policy.ts =====

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

===== FILE: apps/proxy/src/server.ts =====

import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  ProxyConfig,
  checkAuth,
  checkOrigin,
  assertDestinationAllowed,
  safeEqual,
} from "./policy.js";
import { bridgeWsToMud } from "./bridge.js";

type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

function clamp(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export function createProxyServer(cfg: ProxyConfig): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, {
        "content-type": "application/json",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify({ ok: true, mode: cfg.mode }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    try {
      const hostHdr = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? "/", `http://${hostHdr}`);
      if (url.pathname !== "/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const origin = req.headers.origin;
      if (!checkOrigin(origin, cfg)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // Optional pre-auth via Bearer / cookie / (dev-only) query — still re-checked on hello
      const preAuth = checkAuth(url, cfg, req.headers.cookie, req.headers.authorization);

      wss.handleUpgrade(req, socket, head, (ws) => {
        const timer = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1008, "hello timeout");
          }
        }, 5_000);

        ws.once("message", async (data) => {
          clearTimeout(timer);
          try {
            const text = typeof data === "string" ? data : data.toString("utf8");
            const msg = JSON.parse(text) as HelloMsg;
            if (msg.type !== "hello") {
              ws.close(1008, "expected hello");
              return;
            }

            // Auth: Bearer/cookie pre-auth OR hello.token (never rely on query in remote-prod)
            let authed = preAuth;
            if (!authed && msg.token && cfg.authToken) {
              authed = safeEqual(msg.token, cfg.authToken);
            }
            if (cfg.mode === "localhost-dev" && !cfg.authToken) {
              authed = true;
            }
            if (!authed) {
              ws.close(1008, "unauthorized");
              return;
            }

            const mudHost = msg.host ?? "mud.revivalworld.org";
            const mudPort = clamp(Number(msg.port ?? 4000), 1, 65535, 4000);
            const dest = await assertDestinationAllowed(mudHost, mudPort, cfg);
            if (!dest.ok) {
              ws.send(JSON.stringify({ type: "error", message: dest.reason }));
              ws.close(1008, "destination denied");
              return;
            }

            const cols = clamp(Number(msg.cols ?? 80), 1, 511, 80);
            const rows = clamp(Number(msg.rows ?? 24), 1, 511, 24);

            ws.send(JSON.stringify({ type: "ready", host: mudHost, port: mudPort }));
            bridgeWsToMud(ws, {
              host: dest.address,
              port: mudPort,
              cols,
              rows,
            });
          } catch {
            ws.close(1008, "bad hello");
          }
        });
      });
    } catch {
      socket.destroy();
    }
  });

  return server;
}

===== FILE: apps/proxy/src/bridge.ts =====

import net from "node:net";
import type WebSocket from "ws";
import {
  TelnetParser,
  replyToNegotiation,
  ttypeIs,
  naws,
  OPT,
} from "@assmud/protocol";

export type BridgeOptions = {
  host: string;
  port: number;
  cols?: number;
  rows?: number;
};

function escapeIac(buf: Uint8Array): Uint8Array {
  let extra = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0xff) extra += 1;
  if (!extra) return buf;
  const out = new Uint8Array(buf.length + extra);
  let j = 0;
  for (let i = 0; i < buf.length; i++) {
    out[j++] = buf[i]!;
    if (buf[i] === 0xff) out[j++] = 0xff;
  }
  return out;
}

/**
 * Bridge one WebSocket client to one TCP MUD connection.
 * Phase 1a: handle IAC in proxy; forward application data as binary to browser.
 */
export function bridgeWsToMud(ws: WebSocket, opts: BridgeOptions): void {
  const parser = new TelnetParser();
  const cols = opts.cols ?? 80;
  const rows = opts.rows ?? 24;
  const sock = net.connect({ host: opts.host, port: opts.port });

  const sendTcp = (buf: Uint8Array) => {
    if (!sock.destroyed) sock.write(Buffer.from(buf));
  };

  sock.on("data", (chunk: Buffer) => {
    const events = parser.push(new Uint8Array(chunk));
    for (const ev of events) {
      if (ev.type === "data") {
        if (ws.readyState === ws.OPEN) ws.send(ev.bytes);
      } else if (ev.type === "will" || ev.type === "do") {
        const reply = replyToNegotiation(ev.type, ev.option);
        if (reply) sendTcp(reply);
      } else if (ev.type === "sb" && ev.option === OPT.TTYPE) {
        if (ev.payload.length > 0 && ev.payload[0] === 1) {
          sendTcp(ttypeIs("ANSI"));
        }
      } else if (ev.type === "do" && ev.option === OPT.NAWS) {
        sendTcp(naws(cols, rows));
      }
    }
  });

  sock.on("error", (err) => {
    if (ws.readyState === ws.OPEN) {
      const msg = String(err.message)
        .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
        .slice(0, 200);
      ws.send(JSON.stringify({ type: "error", message: msg || "tcp error" }));
      ws.close(1011, "tcp error");
    }
  });

  sock.on("close", () => {
    if (ws.readyState === ws.OPEN) ws.close(1000, "mud closed");
  });

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const s = String(data);
      if (s.length > 16_384) return;
      const cleaned = s.replace(/\xff/g, "");
      const line =
        cleaned.endsWith("\n") || cleaned.endsWith("\r") ? cleaned : cleaned + "\r\n";
      sendTcp(new TextEncoder().encode(line));
      return;
    }
    const buf = new Uint8Array(data as Buffer);
    if (buf.length > 16_384) return;
    sendTcp(escapeIac(buf));
  });

  ws.on("close", () => {
    sock.destroy();
  });
}

===== FILE: apps/proxy/tests/policy.test.ts =====

import { describe, it, expect } from "vitest";
import {
  assertDestinationAllowed,
  checkAuth,
  checkOrigin,
  defaultConfig,
  isPrivateOrBlockedIp,
} from "../src/policy.js";

describe("policy", () => {
  const dev = defaultConfig("localhost-dev");
  const prod = {
    ...defaultConfig("remote-prod"),
    authToken: "secret",
    originAllowlist: ["https://mud.example.com"],
  };

  it("blocks private IPs", () => {
    expect(isPrivateOrBlockedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrBlockedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrBlockedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrBlockedIp("8.8.8.8")).toBe(false);
  });

  it("denies unauth in prod; query token not accepted in remote-prod", () => {
    const url = new URL("http://x/ws?host=mud.revivalworld.org&port=4000");
    expect(checkAuth(url, prod)).toBe(false);
    const q = new URL("http://x/ws?token=secret");
    expect(checkAuth(q, prod)).toBe(false);
    expect(checkAuth(url, prod, undefined, "Bearer secret")).toBe(true);
    expect(checkAuth(url, prod, undefined, "Bearer wrong")).toBe(false);
  });

  it("requires Origin in prod", () => {
    expect(checkOrigin(undefined, prod)).toBe(false);
    expect(checkOrigin("https://evil.com", prod)).toBe(false);
    expect(checkOrigin("https://mud.example.com", prod)).toBe(true);
  });

  it("does not accept origin prefix tricks in dev", () => {
    expect(checkOrigin("http://127.0.0.1.evil.com", dev)).toBe(false);
    expect(checkOrigin("http://localhost.evil.com", dev)).toBe(false);
    expect(checkOrigin("http://127.0.0.1:5173", dev)).toBe(true);
  });

  it("denies non-allowlisted host in prod", async () => {
    const r = await assertDestinationAllowed("example.com", 22, prod);
    expect(r.ok).toBe(false);
  });

  it("allows RW on allowlist", async () => {
    const r = await assertDestinationAllowed("mud.revivalworld.org", 4000, prod);
    expect(r.ok).toBe(true);
    if (r.ok) expect(isPrivateOrBlockedIp(r.address)).toBe(false);
  });

  it("dev still blocks random private IPs even with relax", async () => {
    const r = await assertDestinationAllowed("10.1.2.3", 4000, dev);
    expect(r.ok).toBe(false);
  });
});

===== FILE: packages/protocol/src/telnet.ts =====

/** Telnet IAC constants and stream filter for Phase 1a. */

export const IAC = 255;
export const WILL = 251;
export const WONT = 252;
export const DO = 253;
export const DONT = 254;
export const SB = 250;
export const SE = 240;

export const OPT = {
  ECHO: 1,
  SGA: 3,
  TTYPE: 24,
  NAWS: 31,
  MSSP: 70,
  MCCP2: 86,
  MXP: 91,
} as const;

export type TelnetEvent =
  | { type: "data"; bytes: Uint8Array }
  | { type: "will"; option: number }
  | { type: "wont"; option: number }
  | { type: "do"; option: number }
  | { type: "dont"; option: number }
  | { type: "sb"; option: number; payload: Uint8Array };

/**
 * Incremental Telnet parser. Emits application data and negotiation events.
 */
const MAX_BUF = 65_536;
const MAX_SB = 4_096;

export class TelnetParser {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): TelnetEvent[] {
    if (this.buf.length + chunk.length > MAX_BUF) {
      // reset on abuse / runaway SB
      this.buf = new Uint8Array(0);
      return [];
    }
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const events: TelnetEvent[] = [];
    const data: number[] = [];
    let i = 0;

    while (i < this.buf.length) {
      if (this.buf[i] !== IAC) {
        data.push(this.buf[i]!);
        i += 1;
        continue;
      }
      if (i + 1 >= this.buf.length) break;
      const cmd = this.buf[i + 1]!;
      if (cmd === IAC) {
        data.push(IAC);
        i += 2;
        continue;
      }
      if (cmd === WILL || cmd === WONT || cmd === DO || cmd === DONT) {
        if (i + 2 >= this.buf.length) break;
        if (data.length) {
          events.push({ type: "data", bytes: Uint8Array.from(data) });
          data.length = 0;
        }
        const option = this.buf[i + 2]!;
        const type =
          cmd === WILL ? "will" : cmd === WONT ? "wont" : cmd === DO ? "do" : "dont";
        events.push({ type, option });
        i += 3;
        continue;
      }
      if (cmd === SB) {
        let j = i + 2;
        while (j + 1 < this.buf.length && !(this.buf[j] === IAC && this.buf[j + 1] === SE)) {
          j += 1;
          if (j - i > MAX_SB) {
            // drop runaway subnegotiation
            this.buf = this.buf.slice(j);
            i = 0;
            data.length = 0;
            break;
          }
        }
        if (j + 1 >= this.buf.length) break;
        if (!(this.buf[j] === IAC && this.buf[j + 1] === SE)) continue;
        if (data.length) {
          events.push({ type: "data", bytes: Uint8Array.from(data) });
          data.length = 0;
        }
        const option = this.buf[i + 2]!;
        const payload = this.buf.slice(i + 3, j);
        events.push({ type: "sb", option, payload });
        i = j + 2;
        continue;
      }
      // other IAC cmds — skip one
      i += 2;
    }

    if (data.length) {
      events.push({ type: "data", bytes: Uint8Array.from(data) });
    }
    this.buf = this.buf.slice(i);
    return events;
  }
}

export function cmd(cmdByte: number, option: number): Uint8Array {
  return Uint8Array.of(IAC, cmdByte, option);
}

/** Phase 1a negotiation replies per plan: refuse MCCP2/MXP, accept TTYPE/NAWS. */
export function replyToNegotiation(
  kind: "will" | "do",
  option: number,
): Uint8Array | null {
  if (kind === "will") {
    if (option === OPT.MCCP2) return cmd(DONT, OPT.MCCP2);
    if (option === OPT.MSSP) return cmd(DONT, OPT.MSSP);
    return cmd(DONT, option);
  }
  // DO
  if (option === OPT.TTYPE) return cmd(WILL, OPT.TTYPE);
  if (option === OPT.NAWS) return cmd(WILL, OPT.NAWS);
  if (option === OPT.MXP) return cmd(WONT, OPT.MXP);
  return cmd(WONT, option);
}

/** IAC SB TTYPE IS "ANSI" IAC SE */
export function ttypeIs(name = "ANSI"): Uint8Array {
  const enc = new TextEncoder().encode(name);
  const out = new Uint8Array(5 + enc.length + 2);
  out[0] = IAC;
  out[1] = SB;
  out[2] = OPT.TTYPE;
  out[3] = 0; // IS
  out.set(enc, 4);
  out[4 + enc.length] = IAC;
  out[5 + enc.length] = SE;
  return out;
}

/** IAC SB NAWS width height IAC SE (16-bit big-endian each) */
export function naws(cols: number, rows: number): Uint8Array {
  return Uint8Array.of(
    IAC,
    SB,
    OPT.NAWS,
    (cols >> 8) & 0xff,
    cols & 0xff,
    (rows >> 8) & 0xff,
    rows & 0xff,
    IAC,
    SE,
  );
}

===== FILE: apps/web/src/App.tsx =====

import { useMemo, useState } from "react";
import { TerminalHost } from "./TerminalHost";

const DEFAULT_WS =
  import.meta.env.VITE_PROXY_WS ?? "ws://127.0.0.1:7788/ws";

export function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("assmud_token") ?? "",
  );
  const [host, setHost] = useState("mud.revivalworld.org");
  const [port, setPort] = useState("4000");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("idle");

  const wsUrl = useMemo(() => {
    if (!connected) return null;
    // No secrets in query string — auth goes in first WS hello frame
    return DEFAULT_WS;
  }, [connected]);

  const hello = useMemo(
    () => ({
      type: "hello" as const,
      token: token || undefined,
      host,
      port: Number(port) || 4000,
      cols: 80,
      rows: 28,
    }),
    [token, host, port],
  );

  return (
    <div className="mx-auto max-w-5xl p-4 h-full flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">assmud</h1>
          <p className="text-sm text-zinc-400">
            Web MUD client · Phase 1a · status: {status}
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
        <label className="text-xs flex flex-col gap-1">
          MUD host
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={connected}
          />
        </label>
        <label className="text-xs flex flex-col gap-1">
          Port
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            disabled={connected}
          />
        </label>
        <label className="text-xs flex flex-col gap-1">
          Auth token（remote-prod 需要；hello 傳送）
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem("assmud_token", e.target.value);
            }}
            disabled={connected}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded bg-sky-700 hover:bg-sky-600 px-4 py-2 text-sm disabled:opacity-40"
            disabled={connected}
            onClick={() => setConnected(true)}
          >
            連線
          </button>
          <button
            type="button"
            className="rounded bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm"
            onClick={() => {
              setConnected(false);
              setStatus("idle");
            }}
          >
            斷線
          </button>
        </div>
      </section>

      <div className="flex-1 min-h-[320px]">
        <TerminalHost wsUrl={wsUrl} hello={hello} onStatus={setStatus} />
      </div>
    </div>
  );
}

===== FILE: apps/web/src/TerminalHost.tsx =====

import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";

export type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

type Props = {
  wsUrl: string | null;
  hello: HelloMsg;
  onStatus?: (s: string) => void;
};

/**
 * Thin React host: owns canvas + WS lifecycle; paint loop outside React state.
 * Auth/destination via first-frame hello (no secrets in URL).
 */
export function TerminalHost({ wsUrl, hello, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  helloRef.current = hello;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    onStatus?.("connecting…");
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const paint = () => rendererRef.current.draw(bufRef.current);

    ws.onopen = () => {
      onStatus?.("handshaking…");
      ws.send(JSON.stringify(helloRef.current));
    };
    ws.onclose = () => onStatus?.("disconnected");
    ws.onerror = () => onStatus?.("error");
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        const s = ev.data;
        if (s.startsWith("{")) {
          try {
            const j = JSON.parse(s) as {
              type?: string;
              message?: string;
            };
            if (j.type === "error") {
              const msg = (j.message ?? "error")
                .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
                .slice(0, 200);
              onStatus?.(msg || "error");
            } else if (j.type === "ready") {
              onStatus?.("connected");
            }
          } catch {
            onStatus?.("bad control frame");
          }
        }
        return;
      }
      const bytes = new Uint8Array(ev.data as ArrayBuffer);
      const text = decoderRef.current.push(bytes);
      if (text) {
        bufRef.current.writeDecoded(text);
        paint();
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      decoderRef.current.reset();
    };
  }, [wsUrl, onStatus]);

  const sendLine = (line: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (line.length > 4096) return;
      ws.send(line);
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <canvas
        ref={canvasRef}
        className="rounded border border-zinc-700 bg-black max-w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const line = String(fd.get("line") ?? "");
          sendLine(line);
          e.currentTarget.reset();
        }}
      >
        <input
          name="line"
          autoComplete="off"
          className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="輸入指令…"
        />
        <button
          type="submit"
          className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm"
        >
          送出
        </button>
      </form>
    </div>
  );
}
