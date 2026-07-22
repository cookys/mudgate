# Web zMUD — project tracking

> **Status**: Phases 0–5 delivered on `develop` · **Size**: L  
> **Started**: 2026-07-21 · **Plan**: [approved](../../plans/2026-07-21-web-zmud-rw.md)

## Phases

| Phase | Status |
|-------|--------|
| P0 onboard/docs/OSS | ✅ |
| P0' design ADR-001/002 | ✅ |
| P1a auth proxy + Big5 banner | ✅ |
| P1b map_d VT + dual-color golden | ✅ |
| P2 declarative script-engine | ✅ |
| P3 RW starter pack + MCCP util | ✅ |
| P4 profiles + mobile polish + deploy docs | ✅ |
| P5 multi-tab, buttons, log, client mapper | ✅ |

## QC

- `npm test` — unit suite
- Hetero code review after full land — see `docs/reviews/`

## Run

```bash
npm test
MUDGATE_PROXY_MODE=localhost-dev npm run dev:proxy
npm run dev:web
```
