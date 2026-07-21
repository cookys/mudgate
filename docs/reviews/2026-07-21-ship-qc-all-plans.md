# /ship QC — all plans (2026-07-21)

**Branch**: `develop` @ `3e771dd`  
**Mode**: CEO · hetero · qc-gate  
**Verdict**: **GO_WITH_NITS**

## Servers

| Service | URL |
|---------|-----|
| Web LAN | http://192.168.101.20:5173/ |
| Web local | http://127.0.0.1:5173/ |
| Proxy | `ws://0.0.0.0:7788/ws` · health `{"ok":true,"mode":"localhost-dev"}` |

## Plan matrix

| Plan | Claimed | Hetero | Next |
|------|---------|--------|------|
| web-zmud-rw | done/SHIP (README) | APPROVE_WITH_NITS | align header → done |
| ui-shell-ship | SHIP | **APPROVE** | — |
| ui-redesign | SHIP shell core | APPROVE_WITH_NITS | U2+ deferred |
| i18n-locale | approved next | **APPROVE** (plan only) | implement I1–I3 |
| terminal-fonts | approved next | **APPROVE** (spec only) | implement F1–F3 |

## QC-gate (orchestrator)

| Check | Result |
|-------|--------|
| `npm test` | **30** passed |
| proxy /health | ok |
| web LAN HTTP | 200 |
| SHIP claims vs code | ConnectGate / MudSocket / copy / snapshotAnsi **present** |
| False ship (i18n/fonts) | **none** — correctly next |

## Must not call shipped

- i18n without StatusEvent + three dicts + switchers  
- fonts without setTypography + measure 1:2 + storage UI  

## /ship skill

- User: `~/.grok/skills/ship/SKILL.md`  
- Project: `assmud/.grok/skills/ship/SKILL.md`  
