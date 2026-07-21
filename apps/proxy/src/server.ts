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
import { resolveEffectiveClientAddr } from "./clientAddr.js";
import { bridgeWsToMud } from "./bridge.js";
import { nowIso, tokenHmac, writeAudit } from "./audit.js";
import { envProxyProtocolEnabled } from "./proxyProtocol.js";

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
      res.end(
        JSON.stringify({
          ok: true,
          mode: cfg.mode,
          siteMode: cfg.siteMode,
        }),
      );
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

      const transportPeer = normalizeIp(req.socket.remoteAddress);
      // Coarse upgrade limit by transport peer (before header trust)
      if (!limits.tryUpgrade(transportPeer)) {
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

      const addr = resolveEffectiveClientAddr(req, cfg);
      if (!addr.ok) {
        // Trusted hop configured but client IP header missing/invalid → fail-closed
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      if (addr.headerMismatchWarn) {
        writeAudit({
          event: "warn",
          time: nowIso(),
          message: "cf_and_x_real_ip_mismatch",
          transportPeer: addr.transportPeer,
          effectiveClientAddr: addr.effectiveClientAddr,
        });
      }

      const effectiveIp = addr.effectiveClientAddr;

      // Optional pre-auth via Bearer / cookie / (dev-only) query — still re-checked on hello
      const preAuth = checkAuth(
        url,
        cfg,
        req.headers.cookie,
        req.headers.authorization,
      );

      wss.handleUpgrade(req, socket, head, (ws) => {
        const connId = `${effectiveIp}:${++connSeq}`;
        const timer = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1008, "hello timeout");
          }
        }, limits.helloTimeoutMs);

        let release: (() => void) | null = null;
        let bridged = false;
        const inBudget = limits.inboundBudget(cfg.mode);
        const outBudget = limits.outboundBudget(cfg.mode);
        const checkIn = (n: number) =>
          limits.tryInboundBytes(connId, n, inBudget);
        const checkOut = (n: number) =>
          limits.tryOutboundBytes(connId, n, outBudget);

        writeAudit({
          event: "ws_open",
          time: nowIso(),
          transportPeer: addr.transportPeer,
          effectiveClientAddr: effectiveIp,
          tokenHmac: tokenHmac(
            preAuth && cfg.authToken ? cfg.authToken : null,
            cfg.authToken,
          ),
          siteMode: cfg.siteMode,
          headerSource: addr.headerSource,
        });

        ws.on("close", (code, reasonBuf) => {
          release?.();
          release = null;
          limits.releaseConnBytes(connId);
          writeAudit({
            event: "close",
            time: nowIso(),
            transportPeer: addr.transportPeer,
            effectiveClientAddr: effectiveIp,
            code,
            reason: reasonBuf?.toString("utf8")?.slice(0, 64) || undefined,
            siteMode: cfg.siteMode,
          });
        });

        const onClientMessage = async (data: WebSocket.RawData) => {
          try {
            const nbytes =
              typeof data === "string"
                ? Buffer.byteLength(data)
                : Buffer.isBuffer(data)
                  ? data.length
                  : (data as ArrayBuffer).byteLength;
            if (!checkIn(nbytes)) {
              ws.close(1008, "inbound byte limit");
              return;
            }
            if (bridged) return;

            if (!limits.tryHello(connId)) {
              ws.close(1008, "hello rate");
              return;
            }
            clearTimeout(timer);
            const text = typeof data === "string" ? data : data.toString("utf8");
            const msg = JSON.parse(text) as HelloMsg;
            if (msg.type !== "hello") {
              ws.close(1008, "expected hello");
              return;
            }

            let authed = preAuth;
            if (!authed && msg.token && cfg.authToken) {
              authed = safeEqual(msg.token, cfg.authToken);
            }
            if (cfg.mode === "localhost-dev" && !cfg.authToken) {
              authed = true;
            }
            if (!authed) {
              writeAudit({
                event: "hello",
                time: nowIso(),
                transportPeer: addr.transportPeer,
                effectiveClientAddr: effectiveIp,
                host: String(msg.host ?? ""),
                port: Number(msg.port ?? 0),
                ok: false,
                reason: "unauthorized",
                siteMode: cfg.siteMode,
              });
              ws.close(1008, "unauthorized");
              return;
            }

            // Auth done: concurrency keyed by effectiveClientAddr (not fake per-player)
            const tokenKey =
              cfg.authToken && msg.token && safeEqual(msg.token, cfg.authToken)
                ? "tok"
                : preAuth
                  ? "pre"
                  : "anon";
            release = limits.tryAcquire(effectiveIp, tokenKey);
            if (!release) {
              ws.close(1008, "concurrency limit");
              return;
            }

            const mudHost = msg.host ?? "mud.revivalworld.org";
            const mudPort = clamp(Number(msg.port ?? 4000), 1, 65535, 4000);
            const dest = await assertDestinationAllowed(mudHost, mudPort, cfg);
            if (!dest.ok) {
              writeAudit({
                event: "hello",
                time: nowIso(),
                transportPeer: addr.transportPeer,
                effectiveClientAddr: effectiveIp,
                host: mudHost,
                port: mudPort,
                ok: false,
                reason: dest.reason,
                siteMode: cfg.siteMode,
              });
              ws.send(JSON.stringify({ type: "error", message: dest.reason }));
              ws.close(1008, "destination denied");
              return;
            }

            writeAudit({
              event: "hello",
              time: nowIso(),
              transportPeer: addr.transportPeer,
              effectiveClientAddr: effectiveIp,
              host: mudHost,
              port: mudPort,
              ok: true,
              siteMode: cfg.siteMode,
            });

            const cols = clamp(Number(msg.cols ?? 80), 1, 511, 80);
            const rows = clamp(Number(msg.rows ?? 24), 1, 511, 24);

            bridged = true;
            ws.off("message", onClientMessage);
            const ready = JSON.stringify({
              type: "ready",
              host: mudHost,
              port: mudPort,
            });
            if (!checkOut(Buffer.byteLength(ready))) {
              ws.close(1008, "outbound byte limit");
              return;
            }
            ws.send(ready);
            bridgeWsToMud(ws, {
              host: dest.address,
              port: mudPort,
              cols,
              rows,
              checkInboundBytes: checkIn,
              checkOutboundBytes: checkOut,
              proxyProtocol: envProxyProtocolEnabled(),
              proxySrcIp: effectiveIp,
            });
          } catch {
            ws.close(1008, "bad hello");
          }
        };
        ws.on("message", onClientMessage);
      });
    } catch {
      socket.destroy();
    }
  });

  return server;
}
