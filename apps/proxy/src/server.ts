import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  ProxyConfig,
  checkAuth,
  checkOrigin,
  assertDestinationAllowed,
  safeEqual,
} from "./policy.js";
import { AbuseLimiter, defaultLimits, normalizeIp } from "./limits.js";
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
  const limits = new AbuseLimiter(defaultLimits(cfg.mode));
  let connSeq = 0;

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

      const ip = normalizeIp(req.socket.remoteAddress);
      if (!limits.tryUpgrade(ip)) {
        socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
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
        const connId = `${ip}:${++connSeq}`;
        const timer = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1008, "hello timeout");
          }
        }, limits.helloTimeoutMs);

        let release: (() => void) | null = null;
        ws.on("close", () => {
          release?.();
          release = null;
        });

        ws.once("message", async (data) => {
          clearTimeout(timer);
          try {
            if (!limits.tryHello(connId)) {
              ws.close(1008, "hello rate");
              return;
            }
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

            const tokenKey =
              cfg.authToken && msg.token && safeEqual(msg.token, cfg.authToken)
                ? "tok"
                : preAuth
                  ? "pre"
                  : "anon";
            release = limits.tryAcquire(ip, tokenKey);
            if (!release) {
              ws.close(1008, "concurrency limit");
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
