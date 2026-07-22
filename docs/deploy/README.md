# Deploy (Phase 4)

## Modes

| Mode | Env | Notes |
|------|-----|--------|
| 玩家本機 / LAN (T0) | `MUDGATE_PROXY_MODE=localhost-dev` | bind 127.0.0.1:7788; Origin loose for local Vite |
| 玩家 VPS 自架 (T1a) | `MUDGATE_PROXY_MODE=remote-prod` | require token + origin；allowlist 自訂 |
| **站方 site mode (T1-site)** | `remote-prod` + **`MUDGATE_SITE_MODE=1`** | **必須**非空 `MUDGATE_ALLOWLIST`；見 [SITE-OPERATOR.md](./SITE-OPERATOR.md) |
| 官方 (T2) | 營運配置 | 多開仍痛；站方模式是替代敘事 |
| Prod 通用 | `MUDGATE_PROXY_MODE=remote-prod` | require `MUDGATE_AUTH_TOKEN`, `MUDGATE_ORIGIN_ALLOWLIST` |

## Example (Caddy + Node proxy)

```bash
export MUDGATE_PROXY_MODE=remote-prod
export MUDGATE_AUTH_TOKEN="$(openssl rand -hex 16)"
export MUDGATE_ORIGIN_ALLOWLIST=https://mud.example.com
export PORT=7788
node apps/proxy/dist/cli.js   # or npm run dev -w @mudgate/proxy via tsx
```

Caddy sketch:

```
mud.example.com {
  reverse_proxy /ws* localhost:7788
  root * /var/www/mudgate-web
  file_server
}
```

Serve `apps/web` build with `VITE_PROXY_WS=wss://mud.example.com/ws`.

## Ops

- Ban: rotate `MUDGATE_AUTH_TOKEN` / revoke sessions
- Quotas: reverse-proxy rate limit recommended
- Logs: metadata only; do not log hello token bodies
- Allowlist: edit proxy config / env for new MUDs

## Mobile checklist

- [ ] HTTPS + WSS only
- [ ] Touch send works
- [ ] Viewport meta present
- [ ] No on-device proxy required
