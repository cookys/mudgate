---
name: ship
description: >
  assmud /ship — CEO ship: hetero-review + qc-gate all docs/plans, merge to
  develop, keep LAN proxy/web up. Use for /ship, "ship", "qc all plans".
---

# /ship (assmud project overlay)

Follow the user-global skill `ship` (`~/.grok/skills/ship/SKILL.md`) with these **project pins**:

## Plans inventory

| Plan | Expected ship stance |
|------|----------------------|
| `docs/plans/2026-07-21-web-zmud-rw.md` | already SHIP — smoke only |
| `docs/plans/2026-07-21-ui-shell-ship.md` | SHIP package for shell |
| `docs/plans/2026-07-21-ui-redesign.md` | shell SHIP; i18n/fonts deferred |
| `docs/plans/2026-07-21-i18n-locale.md` | **approved next** — not shippable until I1–I3 code |
| `docs/design/terminal-fonts.md` | **approved next** — not shippable until F1–F3 |

## LAN servers (required after ship)

```bash
# Proxy
ASSMUD_PROXY_MODE=localhost-dev \
ASSMUD_BIND_HOST=0.0.0.0 \
ASSMUD_ORIGIN_ALLOWLIST="http://127.0.0.1:5173,http://localhost:5173,http://192.168.101.20:5173" \
npm run dev:proxy

# Web
VITE_HOST=0.0.0.0 \
VITE_PROXY_WS="ws://192.168.101.20:7788/ws" \
npm run dev:web
```

- Web: http://192.168.101.20:5173/  
- WS: `ws://192.168.101.20:7788/ws`  

Never leave web on `127.0.0.1` only after `/ship` unless user is local-only.

## QC commands

```bash
npm test
npm run build -w @assmud/web
```

## Default branch

Merge feature work into **`develop`**.  
