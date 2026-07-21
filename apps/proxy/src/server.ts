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
