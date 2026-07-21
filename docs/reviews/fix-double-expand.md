Fix verification: double expand fixed. Reply VERDICT only.
===== TerminalHost =====
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
  injectCommand?: string;
  onInjectConsumed?: () => void;
  expandInput?: (line: string) => string[];
  onServerLine?: (line: string) => void;
};

export function TerminalHost({
  wsUrl,
  hello,
  onStatus,
  injectCommand,
  onInjectConsumed,
  expandInput,
  onServerLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  helloRef.current = hello;
  const lineAcc = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!injectCommand) return;
    // expand once here; sendLine must not re-expand injected pieces
    const lines = expandInput ? expandInput(injectCommand) : [injectCommand];
    for (const line of lines) sendRaw(line);
    onInjectConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectCommand]);

  useEffect(() => {
    if (!wsUrl) return;
    onStatus?.("connecting…");
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket;

    const connect = () => {
      if (closed) return;
      onStatus?.(attempt ? `reconnecting… (${attempt})` : "connecting…");
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const paint = () => rendererRef.current.draw(bufRef.current);

      ws.onopen = () => {
        attempt = 0;
        onStatus?.("handshaking…");
        ws.send(JSON.stringify(helloRef.current));
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (closed) {
          onStatus?.("disconnected");
          return;
        }
        attempt += 1;
        if (attempt > 5) {
          onStatus?.("disconnected");
          return;
        }
        onStatus?.(`reconnect in ${attempt}s`);
        timer = setTimeout(connect, attempt * 1000);
      };
      ws.onerror = () => onStatus?.("error");
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          const s = ev.data;
          if (s.startsWith("{")) {
            try {
              const j = JSON.parse(s) as { type?: string; message?: string };
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
          // line split for script engine
          lineAcc.current += text;
          const parts = lineAcc.current.split(/\r?\n/);
          lineAcc.current = parts.pop() ?? "";
          for (const ln of parts) {
            if (ln) onServerLine?.(ln);
          }
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
      decoderRef.current.reset();
    };
  }, [wsUrl, onStatus, onServerLine]);

  const sendRaw = (line: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (line.length > 4096) return;
      ws.send(line);
    }
  };

  /** User input: expand aliases once, then send. */
  const sendLine = (line: string) => {
    const lines = expandInput ? expandInput(line) : [line];
    for (const l of lines) sendRaw(l);
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="overflow-auto touch-pan-y">
        <canvas
          ref={canvasRef}
          className="rounded border border-zinc-700 bg-black max-w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <form
        className="flex gap-2 sticky bottom-0 bg-zinc-950/90 py-1"
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
          enterKeyHint="send"
          className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="指令 / alias…"
        />
        <button
          type="submit"
          className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm min-w-[4rem]"
        >
          送出
        </button>
      </form>
    </div>
  );
}
===== server =====
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

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

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
