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
