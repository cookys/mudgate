# Proxy release checklist

- [ ] `digest pin verified` — image tag is `@sha256:…` (not `:latest`)
- [ ] Installer script SHA-256 published next to release notes
- [ ] `docker compose -f deploy/docker-compose.proxy.yml config` succeeds with sample env
- [ ] remote-prod refuses start without token + Origin
- [ ] Default bind remains `127.0.0.1` (not `0.0.0.0`)

# Site deploy (mud.revivalworld.org → mudgate)

- [ ] `./deploy/site-deploy.sh` (builds SPA with `VITE_PROXY_WS=wss://mud.revivalworld.org/ws`)
- [ ] nginx includes `mudgate.conf`, root `/usr/local/www/mudgate`, `/ws` → `127.0.0.1:7788`
- [ ] TLS: acme.sh ECC → `/usr/local/etc/ssl/mudgate/{fullchain,privkey}.pem` + reloadcmd
- [ ] cron: `acme.sh --cron` + `@reboot mudgate-proxy-start.sh`
- [ ] Manual renew: `~/bin/renew-mud-cert.sh` (standalone :80, 443-only nginx ok)
- [ ] Smoke: `https://mud.revivalworld.org/` 200, asset 200, `wss://…/ws` 101, proxy `/health` siteMode