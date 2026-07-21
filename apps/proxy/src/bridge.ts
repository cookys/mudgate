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

/**
 * Bridge one WebSocket client to one TCP MUD connection.
 * WS messages: binary or text frames are raw client→mud bytes (usually UTF-8 typed commands as latin1/utf8).
 * Server→client: binary frames of mud bytes (after IAC handling still includes app data only? 
 * We forward negotiated stream: strip IAC for client display path — actually client may want raw.
 * Phase 1a: forward application data only to browser; handle IAC in proxy.
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
        if (ev.type === "do" && ev.option === OPT.TTYPE) {
          // wait for SB SEND typically; some servers just DO
        }
      } else if (ev.type === "sb" && ev.option === OPT.TTYPE) {
        // SEND = 1
        if (ev.payload[0] === 1) sendTcp(ttypeIs("ANSI"));
      } else if (ev.type === "do" && ev.option === OPT.NAWS) {
        sendTcp(naws(cols, rows));
      }
    }
  });

  sock.on("error", (err) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "error", message: String(err.message) }));
      ws.close(1011, "tcp error");
    }
  });

  sock.on("close", () => {
    if (ws.readyState === ws.OPEN) ws.close(1000, "mud closed");
  });

  ws.on("message", (data, isBinary) => {
    const buf = isBinary
      ? new Uint8Array(data as Buffer)
      : new TextEncoder().encode(String(data));
    // client text is command line — append CR LF if missing for classic telnet muds
    if (!isBinary) {
      const s = String(data);
      const line = s.endsWith("\n") || s.endsWith("\r") ? s : s + "\r\n";
      sendTcp(new TextEncoder().encode(line));
    } else {
      sendTcp(buf);
    }
  });

  ws.on("close", () => {
    sock.destroy();
  });
}
