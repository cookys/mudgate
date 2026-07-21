---
name: ship
description: >
  assmud /ship overlay — after hetero, expand ready plans, implement with
  grok-4.5 medium (overridable), loop review to green, then depth-0 qc-gate
  + develop merge + LAN servers.
---

# /ship (assmud project overlay)

Follow **user-global** `~/.grok/skills/ship/SKILL.md` with these pins.

## Implementer default

| Key | Value |
|-----|--------|
| Model | **`grok-4.5`** |
| Tier | **medium** (override: `/ship model=…` or `/ship tier=high`) |
| Branch target | **`develop`** |

## Plans inventory (expand policy)

| Plan | Ship stance |
|------|-------------|
| `docs/plans/2026-07-21-web-zmud-rw.md` | done/SHIP — smoke only |
| `docs/plans/2026-07-21-ui-shell-ship.md` | SHIP — smoke only |
| `docs/plans/2026-07-21-ui-redesign.md` | shell SHIP; residual U2+ optional |
| `docs/plans/2026-07-21-i18n-locale.md` | **expand when /ship** if Board frozen (is) → I1–I3 |
| `docs/design/terminal-fonts.md` | **expand when /ship** after or with i18n → F1–F3 |

On full `/ship` (no `only-qc` / `no-expand`):

1. Hetero open plans (i18n + fonts + any draft).  
2. **Expand** i18n (and fonts if capacity) into `implementing` + feature branch.  
3. Impl **grok-4.5 medium** (or session model if dispatch cannot set).  
4. Loop review until StatusEvent + locales / font acceptance green.  
5. **depth-0** `npm test` + `npm run build -w @assmud/web`.  
6. Merge develop + LAN servers.

Do **not** depth-0-qc-only and call i18n/fonts shipped.

## QC (depth-0 only, post-loop)

```bash
npm test
npm run build -w @assmud/web
```

## LAN servers (after land)

```bash
ASSMUD_PROXY_MODE=localhost-dev \
ASSMUD_BIND_HOST=0.0.0.0 \
ASSMUD_ORIGIN_ALLOWLIST="http://127.0.0.1:5173,http://localhost:5173,http://192.168.101.20:5173" \
npm run dev:proxy

VITE_HOST=0.0.0.0 \
VITE_PROXY_WS="ws://192.168.101.20:7788/ws" \
npm run dev:web
```

- http://192.168.101.20:5173/  
- `ws://192.168.101.20:7788/ws`  

## False-ship guards (Skeptic)

- No `i18n/` + StatusEvent → cannot SHIP i18n plan.  
- No `setTypography` / termFont storage → cannot SHIP fonts.  
