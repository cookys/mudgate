# Deploy

## Modes

| Mode | Env | Notes |
|------|-----|--------|
| 玩家本機 / LAN (T0) | `MUDGATE_PROXY_MODE=localhost-dev` | bind 127.0.0.1:7788; Origin loose for local Vite |
| 玩家 VPS 自架 (T1) | `MUDGATE_PROXY_MODE=remote-prod` | token + origin；allowlist 自訂；玩家 SPA 選 T1 |
| **站方 site mode** | `remote-prod` + **`MUDGATE_SITE_MODE=1`** | **必須**非空 `MUDGATE_ALLOWLIST`；SPA 用 site shell — 見 [SITE-OPERATOR.md](./SITE-OPERATOR.md) |
| Prod 通用 | `MUDGATE_PROXY_MODE=remote-prod` | require `MUDGATE_AUTH_TOKEN`, `MUDGATE_ORIGIN_ALLOWLIST` |

Live reference: **https://mud.revivalworld.org/**  
One-shot SPA push: **`../../deploy/site-deploy.sh`**.

## Example (Caddy + Node proxy)

```bash
export MUDGATE_PROXY_MODE=remote-prod
export MUDGATE_AUTH_TOKEN="$(openssl rand -hex 24)"
export MUDGATE_ORIGIN_ALLOWLIST=https://mud.example.com
export PORT=7788
node apps/proxy/dist/cli.js
```

Caddy sketch:

```
mud.example.com {
  reverse_proxy /ws* localhost:7788
  root * /var/www/mudgate
  file_server
}
```

Site SPA build:

```bash
VITE_SITE_MODE=1 VITE_PROXY_WS=wss://mud.example.com/ws npm run build -w @mudgate/web
```

For co-located site, prefer **HttpOnly cookie** auth (not asking players to paste the token) — details in [SITE-OPERATOR.md](./SITE-OPERATOR.md).

## Ops

- Ban / abuse: rotate `MUDGATE_AUTH_TOKEN` + session cookie include; lower limits
- Quotas: reverse-proxy rate limit recommended
- Logs: metadata only; do not log hello token bodies
- Allowlist: only muds this gateway may dial (site mode = this station’s ports)

## Mobile checklist

- [ ] HTTPS + WSS only
- [ ] Touch send works
- [ ] Viewport meta present
- [ ] No on-device proxy required
