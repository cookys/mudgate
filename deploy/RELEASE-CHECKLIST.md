# Proxy release checklist

- [ ] `digest pin verified` — image tag is `@sha256:…` (not `:latest`)
- [ ] Installer script SHA-256 published next to release notes
- [ ] `docker compose -f deploy/docker-compose.proxy.yml config` succeeds with sample env
- [ ] remote-prod refuses start without token + Origin
- [ ] Default bind remains `127.0.0.1` (not `0.0.0.0`)
