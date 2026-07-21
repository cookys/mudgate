# HTTPS + WSS deploy recipe

Aligns with `apps/proxy` `policy.ts` / remote-prod.

## Required env (remote-prod)

| Env | Rule |
|-----|------|
| `ASSMUD_PROXY_MODE=remote-prod` | fail-closed |
| `ASSMUD_AUTH_TOKEN` | required; Bearer/cookie only (no query in prod) |
| `ASSMUD_ORIGIN_ALLOWLIST` | comma HTTPS origins; **empty refuses start** |
| `ASSMUD_BIND_HOST` | default **127.0.0.1** — TLS terminator fronts 443 |
| `ASSMUD_MCCP=1` | optional; inflate caps via `ASSMUD_MCCP_MAX_*` |

## Topology

```
Browser ──WSS──► Caddy/nginx (TLS) ──► 127.0.0.1:7788 proxy ──TCP──► MUD
```

See `deploy/Caddyfile.proxy.example`, `deploy/docker-compose.proxy.yml`.

## MCCP caps (proxy)

| Env | Default role |
|-----|----------------|
| `ASSMUD_MCCP_MAX_WINDOW_BYTES` | per-window inflate |
| `ASSMUD_MCCP_MAX_SESSION_BYTES` | session inflate |
| `ASSMUD_MCCP_MAX_WIRE_BYTES` | compressed wire |

Never log telnet payloads / passwords.
