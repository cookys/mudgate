# mudgate

Browser MUD client (desktop + mobile) with a **fail-closed WSS → TCP proxy**.

Open a web page over **HTTPS**, connect via **WSS**, play classic MUDs (Big5 / VT / map_d).  
Depth benchmark: **[重生的世界 / Revival World](https://www.revivalworld.org)**.

| | |
|--|--|
| Live (RW site shell) | **https://mud.revivalworld.org/** |
| License | **MIT** — [LICENSE](LICENSE) |
| Stack | TypeScript monorepo · React + Vite + Tailwind · Node proxy |
| Status | Usable client + site gateway on RW host; multi-MUD player mode still evolving |

Browsers cannot open raw TCP to MUDs. The proxy holds the telnet session; the SPA never claims “end-to-end so the operator cannot see passwords.”

---

## Quick start (local)

```bash
npm install
npm test

# terminal 1 — proxy (dev)
MUDGATE_PROXY_MODE=localhost-dev npm run dev:proxy

# terminal 2 — SPA
npm run dev:web
# → http://127.0.0.1:5173
```

Connect to `mud.revivalworld.org:4000` (or another allowlisted host in dev).  
Trust modes **T0–T3** (local / self-host / official / other) appear in the **player** SPA only.

More: [docs/TRY-FEATURES.md](docs/TRY-FEATURES.md).

---

## Site mode (station operator)

**Site shell** = co-located SPA + proxy on the mud host (e.g. Revival World).  
Players use **this site only** — no T1/T3 trust radios, no manual auth-token field.

| Layer | Role |
|-------|------|
| nginx **443** | SPA + `wss://…/ws` → `127.0.0.1:17788` |
| mudgate-proxy | `remote-prod` + `MUDGATE_SITE_MODE=1` + allowlist |
| Auth | Shared site token as **HttpOnly** cookie (`mudgate_session`); Origin allowlist |
| MUD | Telnet to allowlisted ports (RW: 4000 / 4001 / 5000 / 6000 — same driver, verified by banner) |

### Deploy SPA from a laptop

```bash
# builds with VITE_SITE_MODE=1 and VITE_PROXY_WS=wss://mud.revivalworld.org/ws
./deploy/site-deploy.sh
# HOST=cookys@mud.example ./deploy/site-deploy.sh
```

### Ops docs

| Doc | Content |
|-----|---------|
| [docs/deploy/SITE-OPERATOR.md](docs/deploy/SITE-OPERATOR.md) | Env, cookie, allowlist, rotate, verify |
| [docs/deploy/README.md](docs/deploy/README.md) | Mode matrix (T0 / T1 / site / prod) |
| [deploy/nginx-mud.revivalworld.org.conf](deploy/nginx-mud.revivalworld.org.conf) | FreeBSD/nginx vhost sketch |
| [deploy/RELEASE-CHECKLIST.md](deploy/RELEASE-CHECKLIST.md) | Site smoke checklist |
| [docs/security/hosted-proxy-threat-model.md](docs/security/hosted-proxy-threat-model.md) | Threat model |

**Never commit** `.env`, TLS keys, or `mudgate-session.inc` (token cookie). Use [`.env.site.example`](.env.site.example).

---

## Why a proxy?

| Segment | Encryption |
|---------|------------|
| Browser ↔ gateway | **HTTPS + WSS** |
| Proxy ↔ MUD | Usually plain telnet (TLS if the mud offers it) |

See [ADR-002](docs/adr/ADR-002-remote-auth-proxy.md).

---

## Monorepo map

```text
apps/web          SPA
apps/proxy        WSS ↔ TCP gateway
packages/*        protocol, vt, terminal, profiles/vault, mapper, …
deploy/           site nginx + site-deploy.sh
docs/             architecture, deploy, plans, security
```

```bash
npm run build          # protocol … proxy + web (see root package.json)
npm test
npm run secret-scan    # lightweight; gitleaks optional
```

---

## Project docs

| Path | Role |
|------|------|
| [docs/architecture.md](docs/architecture.md) | Architecture |
| [docs/adr/](docs/adr/) | ADRs |
| [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md) | Publish hygiene |
| [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) | Security & contrib |
| [docs/projects/INDEX.md](docs/projects/INDEX.md) | Project index |

---

## License

[MIT](LICENSE) © 2026 mudgate contributors
