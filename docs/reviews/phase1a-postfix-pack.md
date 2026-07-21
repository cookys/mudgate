# Phase 1a POST-FIX sources for multi-family SHIP gate

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

===== FILE: apps/proxy/src/server.ts =====

import http from "node:http";
import { WebSocketServer } from "ws";
import {
  ProxyConfig,
  checkAuth,
  checkOrigin,
  assertDestinationAllowed,
} from "./policy.js";
import { bridgeWsToMud } from "./bridge.js";

export function createProxyServer(cfg: ProxyConfig): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, mode: cfg.mode }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
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

      if (!checkAuth(url, cfg, req.headers.cookie, req.headers.authorization)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const mudHost = url.searchParams.get("host") ?? "mud.revivalworld.org";
      const mudPort = Number(url.searchParams.get("port") ?? "4000");
      const dest = await assertDestinationAllowed(mudHost, mudPort, cfg);
      if (!dest.ok) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        // Pin TCP to the IP validated by policy (prevents DNS rebinding TOCTOU).
        bridgeWsToMud(ws, {
          host: dest.address,
          port: mudPort,
          cols: Number(url.searchParams.get("cols") ?? 80),
          rows: Number(url.searchParams.get("rows") ?? 24),
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

  it("denies unauth in prod", () => {
    const url = new URL("http://x/ws?host=mud.revivalworld.org&port=4000");
    expect(checkAuth(url, prod)).toBe(false);
    const ok = new URL("http://x/ws?token=secret");
    expect(checkAuth(ok, prod)).toBe(true);
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
export class TelnetParser {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): TelnetEvent[] {
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
        }
        if (j + 1 >= this.buf.length) break;
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

===== FILE: packages/codec-big5/src/index.ts =====

import * as iconv from "iconv-lite";
import { Buffer } from "buffer";

/**
 * Streaming Big5-family decoder (HKSCS-capable via iconv-lite 'big5hkscs').
 * Holds a pending lead byte across chunks.
 */
export class Big5StreamDecoder {
  private pending: number | null = null;
  private readonly encoding: string;

  constructor(encoding: "big5hkscs" | "big5" = "big5hkscs") {
    this.encoding = encoding;
  }

  push(bytes: Uint8Array): string {
    const parts: number[] = [];
    let i = 0;
    if (this.pending !== null) {
      if (bytes.length === 0) return "";
      parts.push(this.pending, bytes[0]!);
      this.pending = null;
      i = 1;
    }
    while (i < bytes.length) {
      const b = bytes[i]!;
      if (b < 0x80) {
        parts.push(b);
        i += 1;
      } else if (i + 1 < bytes.length) {
        parts.push(b, bytes[i + 1]!);
        i += 2;
      } else {
        this.pending = b;
        break;
      }
    }
    if (!parts.length) return "";
    return iconv.decode(Buffer.from(parts), this.encoding);
  }

  reset(): void {
    this.pending = null;
  }
}

export function decodeBig5(
  bytes: Uint8Array,
  encoding: "big5hkscs" | "big5" = "big5hkscs",
): string {
  return iconv.decode(Buffer.from(bytes), encoding);
}

===== FILE: packages/vt/src/sanitize.ts =====

/**
 * HTML-escape untrusted MUD text if ever injected into DOM.
 * Canvas path still uses this for any HTML fallback chrome.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reject/neutralize attempts to break out of text context when building HTML spans.
 * SGR is already parsed separately — this is for raw string insertion safety.
 */
export function sanitizeMudTextForHtml(text: string): string {
  // Strip NULs and other C0 except tab/lf/cr
  const cleaned = [...text]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 0) return "";
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) return "";
      return ch;
    })
    .join("");
  return escapeHtml(cleaned);
}

===== FILE: packages/vt/src/sgr.ts =====

export type Attrs = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  reverse: boolean;
  fg: number | null; // 0-7 or 8-15 if bold
  bg: number | null;
};

export const defaultAttrs = (): Attrs => ({
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  blink: false,
  reverse: false,
  fg: null,
  bg: null,
});

export function applySgr(attrs: Attrs, params: number[]): Attrs {
  const next = { ...attrs };
  if (params.length === 0) params = [0];
  for (const p of params) {
    if (p === 0) Object.assign(next, defaultAttrs());
    else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 5 || p === 6) next.blink = true;
    else if (p === 7) next.reverse = true;
    else if (p === 22) {
      next.bold = false;
      next.dim = false;
    } else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p === 25) next.blink = false;
    else if (p === 27) next.reverse = false;
    else if (p >= 30 && p <= 37) next.fg = p - 30;
    else if (p === 39) next.fg = null;
    else if (p >= 40 && p <= 47) next.bg = p - 40;
    else if (p === 49) next.bg = null;
    else if (p >= 90 && p <= 97) next.fg = p - 90 + 8;
    else if (p >= 100 && p <= 107) next.bg = p - 100 + 8;
  }
  return next;
}

export type Token =
  | { kind: "text"; text: string; attrs: Attrs }
  | { kind: "csi"; raw: string; params: number[]; final: string }
  | { kind: "control"; code: number };

/**
 * Phase 1a VT tokenizer: full SGR handling; other CSI recorded as tokens.
 * Input is Unicode string (already decoded from Big5).
 */
export function tokenizeAnsi(input: string, startAttrs: Attrs = defaultAttrs()): {
  tokens: Token[];
  attrs: Attrs;
} {
  const tokens: Token[] = [];
  let attrs = { ...startAttrs };
  let i = 0;
  let textBuf = "";

  const flush = () => {
    if (textBuf) {
      tokens.push({ kind: "text", text: textBuf, attrs: { ...attrs } });
      textBuf = "";
    }
  };

  while (i < input.length) {
    const ch = input[i]!;
    const code = ch.charCodeAt(0);
    if (code === 0x1b && input[i + 1] === "[") {
      flush();
      let j = i + 2;
      while (j < input.length) {
        const c = input[j]!;
        if ((c >= "0" && c <= "9") || c === ";" || c === "?" || c === ":" || c === " ") {
          j += 1;
          continue;
        }
        break;
      }
      if (j >= input.length) {
        // incomplete — keep as text
        textBuf += input.slice(i);
        break;
      }
      const final = input[j]!;
      const body = input.slice(i + 2, j);
      const params = body
        .split(";")
        .filter((x) => x.length && !x.startsWith("?"))
        .map((x) => parseInt(x, 10) || 0);
      const raw = input.slice(i, j + 1);
      if (final === "m") {
        attrs = applySgr(attrs, params.length ? params : [0]);
        tokens.push({ kind: "csi", raw, params, final });
      } else {
        tokens.push({ kind: "csi", raw, params, final });
      }
      i = j + 1;
      continue;
    }
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      flush();
      tokens.push({ kind: "control", code });
      i += 1;
      continue;
    }
    textBuf += ch;
    i += 1;
  }
  flush();
  return { tokens, attrs };
}

/** Strip SGR for length/compare; leave other CSI as empty for visible text. */
export function visibleText(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

===== FILE: packages/terminal/src/buffer.ts =====

import { Attrs, defaultAttrs, tokenizeAnsi } from "@assmud/vt";

export type Cell = { ch: string; attrs: Attrs };

export class ScreenBuffer {
  cols: number;
  rows: number;
  cells: Cell[][];
  cursor = { r: 0, c: 0 };
  attrs: Attrs = defaultAttrs();
  /** scrollback lines as plain strings for Phase 1a */
  scrollback: string[] = [];
  maxScrollback = 2000;

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.cells = this.blank();
  }

  private blank(): Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ ch: " ", attrs: defaultAttrs() })),
    );
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.cells = this.blank();
    this.cursor = { r: 0, c: 0 };
  }

  writeDecoded(text: string): void {
    const { tokens, attrs } = tokenizeAnsi(text, this.attrs);
    this.attrs = attrs;
    for (const t of tokens) {
      if (t.kind === "text") this.writePlain(t.text, t.attrs);
      else if (t.kind === "control" && t.code === 10) this.lineFeed();
      else if (t.kind === "control" && t.code === 13) this.cursor.c = 0;
      // other CSI (CUP etc.) ignored in Phase 1a partial terminal — Phase 1b
    }
  }

  private writePlain(text: string, attrs: Attrs): void {
    for (const ch of text) {
      if (ch === "\n") {
        this.lineFeed();
        continue;
      }
      if (ch === "\r") {
        this.cursor.c = 0;
        continue;
      }
      if (this.cursor.c >= this.cols) {
        this.lineFeed();
      }
      this.cells[this.cursor.r]![this.cursor.c] = { ch, attrs: { ...attrs } };
      this.cursor.c += 1;
    }
  }

  private lineFeed(): void {
    // push current line to scrollback
    const line = this.cells[this.cursor.r]!.map((c) => c.ch).join("").replace(/\s+$/, "");
    this.scrollback.push(line);
    if (this.scrollback.length > this.maxScrollback) this.scrollback.shift();

    if (this.cursor.r < this.rows - 1) {
      this.cursor.r += 1;
    } else {
      // scroll up
      this.cells.shift();
      this.cells.push(
        Array.from({ length: this.cols }, () => ({ ch: " ", attrs: defaultAttrs() })),
      );
    }
    this.cursor.c = 0;
  }

  snapshotText(): string {
    return this.cells.map((row) => row.map((c) => c.ch).join("").replace(/\s+$/, "")).join("\n");
  }
}

===== FILE: apps/web/src/TerminalHost.tsx =====

import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";

type Props = {
  wsUrl: string | null;
  onStatus?: (s: string) => void;
};

/**
 * Thin React host: owns canvas + WS lifecycle; paint loop outside React state.
 */
export function TerminalHost({ wsUrl, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);

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

    ws.onopen = () => onStatus?.("connected");
    ws.onclose = () => onStatus?.("disconnected");
    ws.onerror = () => onStatus?.("error");
    ws.onmessage = (ev) => {
      // Proxy sends mud as binary; JSON control only as text starting with '{'
      if (typeof ev.data === "string") {
        const s = ev.data;
        if (s.startsWith("{")) {
          try {
            const j = JSON.parse(s) as { type?: string; message?: string };
            if (j.type === "error") {
              const msg = (j.message ?? "error").replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "").slice(0, 200);
              onStatus?.(msg || "error");
            }
          } catch {
            onStatus?.("bad control frame");
          }
        }
        // ignore non-JSON text from proxy (mud must be binary)
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
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(line);
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
    const u = new URL(DEFAULT_WS);
    u.searchParams.set("host", host);
    u.searchParams.set("port", port);
    if (token) u.searchParams.set("token", token);
    return u.toString();
  }, [connected, host, port, token]);

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
          Auth token（prod 需要）
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
        <TerminalHost wsUrl={wsUrl} onStatus={setStatus} />
      </div>
    </div>
  );
}
