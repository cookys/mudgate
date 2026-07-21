# Deploy (Phase 4)

## Modes

| Mode | Env | Notes |
|------|-----|--------|
| Dev | `ASSMUD_PROXY_MODE=localhost-dev` | bind 127.0.0.1:7788; Origin loose for local Vite |
| Prod | `ASSMUD_PROXY_MODE=remote-prod` | require `ASSMUD_AUTH_TOKEN`, `ASSMUD_ORIGIN_ALLOWLIST` |

## Example (Caddy + Node proxy)

```bash
export ASSMUD_PROXY_MODE=remote-prod
export ASSMUD_AUTH_TOKEN="$(openssl rand -hex 16)"
export ASSMUD_ORIGIN_ALLOWLIST=https://mud.example.com
export PORT=7788
node apps/proxy/dist/cli.js   # or npm run dev -w @assmud/proxy via tsx
```

Caddy sketch:

```
mud.example.com {
  reverse_proxy /ws* localhost:7788
  root * /var/www/assmud-web
  file_server
}
```

Serve `apps/web` build with `VITE_PROXY_WS=wss://mud.example.com/ws`.

## Ops

- Ban: rotate `ASSMUD_AUTH_TOKEN` / revoke sessions
- Quotas: reverse-proxy rate limit recommended
- Logs: metadata only; do not log hello token bodies
- Allowlist: edit proxy config / env for new MUDs

## Mobile checklist

- [ ] HTTPS + WSS only
- [ ] Touch send works
- [ ] Viewport meta present
- [ ] No on-device proxy required
