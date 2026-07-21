import net from "node:net";
import zlib from "node:zlib";
import type WebSocket from "ws";
import {
  TelnetParser,
  replyToNegotiation,
  ttypeIs,
  naws,
  OPT,
  type TelnetEvent,
} from "@assmud/protocol";

export type BridgeOptions = {
  host: string;
  port: number;
  cols?: number;
  rows?: number;
  /** DO MCCP2 when server WILL (default true) */
  mccp?: boolean;
  maxInflatedPerWindow?: number;
  maxInflatedSession?: number;
  maxCompressedWireSession?: number;
  windowMs?: number;
  /**
   * Abuse budgets for the full session (not just hello).
   * Return false to tear down the bridge.
   */
  checkInboundBytes?: (n: number) => boolean;
  checkOutboundBytes?: (n: number) => boolean;
};

const MAX_PARSER_FEED = 60_000;

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

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

function addCap(current: number, incoming: number, cap: number): number | null {
  if (incoming > cap - current) return null;
  return current + incoming;
}

/**
 * Bridge one WebSocket client to one TCP MUD connection.
 * Optional MCCP2: after IAC SB MCCP2 IAC SE, zlib-inflate wire then telnet-parse.
 */
function clampTerm(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export function bridgeWsToMud(ws: WebSocket, opts: BridgeOptions): void {
  const parser = new TelnetParser();
  /** Mutable — client may send mid-session resize / NAWS updates. */
  let cols = clampTerm(opts.cols ?? 80, 20, 511, 80);
  let rows = clampTerm(opts.rows ?? 24, 8, 200, 24);
  const mccpEnabled =
    opts.mccp ??
    (() => {
      const v = (process.env.ASSMUD_MCCP ?? "1").toLowerCase();
      return !["0", "false", "off", "no"].includes(v);
    })();

  const WINDOW_MS = opts.windowMs ?? envInt("ASSMUD_MCCP_WINDOW_MS", 60_000);
  const MAX_INFLATED_PER_WINDOW =
    opts.maxInflatedPerWindow ??
    envInt("ASSMUD_MCCP_MAX_WINDOW_BYTES", 16 * 1024 * 1024);
  const MAX_INFLATED_SESSION =
    opts.maxInflatedSession ??
    envInt("ASSMUD_MCCP_MAX_SESSION_BYTES", 256 * 1024 * 1024);
  const MAX_WIRE_SESSION =
    opts.maxCompressedWireSession ??
    envInt("ASSMUD_MCCP_MAX_WIRE_BYTES", 128 * 1024 * 1024);

  let compressedMode = false;
  let inflate: zlib.Inflate | null = null;
  let inflatedSession = 0;
  let inflatedWindow = 0;
  let windowStart = Date.now();
  let wireSession = 0;
  let closed = false;
  let finishing = false;
  let errorSent = false;
  /** Server ECHO option active → client should mask local input (password). */
  let echoMask = false;

  const sock = net.connect({ host: opts.host, port: opts.port });

  const sendJson = (obj: Record<string, unknown>) => {
    if (closed || ws.readyState !== ws.OPEN) return;
    const payload = JSON.stringify(obj);
    if (
      opts.checkOutboundBytes &&
      !opts.checkOutboundBytes(Buffer.byteLength(payload))
    ) {
      destroy("outbound byte limit");
      return;
    }
    try {
      ws.send(payload);
    } catch {
      /* ignore */
    }
  };

  const setEchoMask = (mask: boolean) => {
    if (echoMask === mask) return;
    echoMask = mask;
    sendJson({ type: "echo", mask });
  };

  const destroy = (reason: string) => {
    if (closed) return;
    closed = true;
    try {
      inflate?.destroy();
    } catch {
      /* ignore */
    }
    inflate = null;
    if (ws.readyState === ws.OPEN) {
      if (!errorSent) {
        errorSent = true;
        const msg = reason
          .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
          .slice(0, 200);
        try {
          ws.send(JSON.stringify({ type: "error", message: msg || "mccp" }));
        } catch {
          /* ignore */
        }
      }
      try {
        ws.close(1011, "bridge destroy");
      } catch {
        /* ignore */
      }
    }
    try {
      sock.destroy();
    } catch {
      /* ignore */
    }
  };

  const sendTcp = (buf: Uint8Array) => {
    if (!sock.destroyed) sock.write(Buffer.from(buf));
  };

  const forwardData = (bytes: Uint8Array) => {
    if (closed || ws.readyState !== ws.OPEN || bytes.length === 0) return;
    if (opts.checkOutboundBytes && !opts.checkOutboundBytes(bytes.length)) {
      destroy("outbound byte limit");
      return;
    }
    ws.send(bytes);
  };

  const handleEvents = (events: TelnetEvent[]) => {
    for (const ev of events) {
      if (ev.type === "data") {
        forwardData(ev.bytes);
      } else if (ev.type === "will") {
        const reply = replyToNegotiation("will", ev.option, {
          mccp: mccpEnabled,
        });
        if (reply) sendTcp(reply);
        if (ev.option === OPT.ECHO) setEchoMask(true);
      } else if (ev.type === "wont") {
        const reply = replyToNegotiation("wont", ev.option, {
          mccp: mccpEnabled,
        });
        if (reply) sendTcp(reply);
        if (ev.option === OPT.ECHO) setEchoMask(false);
      } else if (ev.type === "do") {
        const reply = replyToNegotiation("do", ev.option, {
          mccp: mccpEnabled,
        });
        if (reply) sendTcp(reply);
        if (ev.option === OPT.NAWS) sendTcp(naws(cols, rows));
        if (ev.option === OPT.ECHO) setEchoMask(true);
      } else if (ev.type === "dont") {
        const reply = replyToNegotiation("dont", ev.option, {
          mccp: mccpEnabled,
        });
        if (reply) sendTcp(reply);
        if (ev.option === OPT.ECHO) setEchoMask(false);
      } else if (ev.type === "sb" && ev.option === OPT.TTYPE) {
        if (ev.payload.length > 0 && ev.payload[0] === 1) {
          sendTcp(ttypeIs("ANSI"));
        }
      }
      // MCCP2 sb start is handled by pushUntilMccpStart boundary, not here
    }
  };

  const feedDecompressed = (buf: Buffer) => {
    if (closed) return;
    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      inflatedWindow = 0;
    }
    let offset = 0;
    while (offset < buf.length) {
      const slice = buf.subarray(
        offset,
        Math.min(offset + MAX_PARSER_FEED, buf.length),
      );
      offset += slice.length;

      const nextSess = addCap(inflatedSession, slice.length, MAX_INFLATED_SESSION);
      const nextWin = addCap(inflatedWindow, slice.length, MAX_INFLATED_PER_WINDOW);
      if (nextSess == null || nextWin == null) {
        destroy("mccp inflate cap exceeded");
        return;
      }
      inflatedSession = nextSess;
      inflatedWindow = nextWin;

      const events = parser.push(new Uint8Array(slice));
      handleEvents(events);
    }
  };

  const startInflate = (residual: Uint8Array) => {
    inflate = zlib.createInflate();
    inflate.on("data", (d: Buffer) => feedDecompressed(d));
    inflate.on("error", () => destroy("mccp inflate error"));
    // residual is compressed wire
    if (residual.length) {
      const nextWire = addCap(wireSession, residual.length, MAX_WIRE_SESSION);
      if (nextWire == null) {
        destroy("mccp wire cap exceeded");
        return;
      }
      wireSession = nextWire;
      try {
        inflate.write(Buffer.from(residual));
      } catch {
        destroy("mccp inflate write");
      }
    }
  };

  sock.on("data", (chunk: Buffer) => {
    if (closed) return;
    const u8 = new Uint8Array(chunk);

    if (!compressedMode) {
      const { events, mccpStarted, residual } = parser.pushUntilMccpStart(u8);
      handleEvents(events);
      if (mccpStarted) {
        if (!mccpEnabled) {
          destroy("mccp se while disabled");
          return;
        }
        compressedMode = true;
        startInflate(residual);
      }
      return;
    }

    // compressed mode — never TelnetParser on wire
    const nextWire = addCap(wireSession, u8.length, MAX_WIRE_SESSION);
    if (nextWire == null) {
      destroy("mccp wire cap exceeded");
      return;
    }
    wireSession = nextWire;
    try {
      inflate?.write(Buffer.from(u8));
    } catch {
      destroy("mccp inflate write");
    }
  });

  sock.on("error", (err) => {
    destroy(String(err.message) || "tcp error");
  });

  const finishInflateThenClose = () => {
    if (closed || finishing) return;
    finishing = true;
    if (inflate && !inflate.destroyed) {
      const z = inflate;
      try {
        z.end();
      } catch {
        destroy("mccp truncated");
        return;
      }
      const okClose = () => {
        if (closed) return;
        closed = true;
        if (ws.readyState === ws.OPEN) ws.close(1000, "mud closed");
      };
      z.once("end", okClose);
      z.once("error", () => destroy("mccp truncated"));
      // hung inflate ≠ success
      setTimeout(() => {
        if (!closed) destroy("mccp truncated");
      }, 2000);
      return;
    }
    closed = true;
    if (ws.readyState === ws.OPEN) ws.close(1000, "mud closed");
  };

  sock.on("end", finishInflateThenClose);
  sock.on("close", () => {
    if (!closed && !finishing) finishInflateThenClose();
  });

  ws.on("message", (data, isBinary) => {
    if (closed) return;
    const nbytes =
      typeof data === "string"
        ? Buffer.byteLength(data)
        : Buffer.isBuffer(data)
          ? data.length
          : (data as ArrayBuffer).byteLength;
    if (opts.checkInboundBytes && !opts.checkInboundBytes(nbytes)) {
      destroy("inbound byte limit");
      return;
    }
    if (!isBinary) {
      const s = String(data);
      if (s.length > 16_384) return;
      // Control JSON (not a MUD line): {"type":"naws"|"resize","cols":N,"rows":N}
      if (s.startsWith("{")) {
        try {
          const j = JSON.parse(s) as {
            type?: string;
            cols?: number;
            rows?: number;
          };
          if (j.type === "naws" || j.type === "resize") {
            cols = clampTerm(Number(j.cols ?? cols), 20, 511, cols);
            rows = clampTerm(Number(j.rows ?? rows), 8, 200, rows);
            sendTcp(naws(cols, rows));
            return;
          }
        } catch {
          /* fall through as mud line */
        }
      }
      const cleaned = s.replace(/\xff/g, "");
      const line =
        cleaned.endsWith("\n") || cleaned.endsWith("\r")
          ? cleaned
          : cleaned + "\r\n";
      sendTcp(new TextEncoder().encode(line));
      return;
    }
    const buf = new Uint8Array(data as Buffer);
    if (buf.length > 16_384) return;
    sendTcp(escapeIac(buf));
  });

  ws.on("close", () => {
    closed = true;
    try {
      inflate?.destroy();
    } catch {
      /* ignore */
    }
    sock.destroy();
  });
}
