# Phase 1a — implementer notes (grok-4.5 medium)

**Branch**: `feat/phase-1a-connect`  
**Implementer**: grok-4.5 (medium scope)  
**Date**: 2026-07-21

## Delivered

| Item | Status |
|------|--------|
| npm workspaces monorepo | yes |
| `@mudgate/protocol` Telnet + DONT MCCP2 | yes + tests |
| `@mudgate/codec-big5` Big5-HKSCS stream + banner golden | yes |
| `@mudgate/vt` SGR + HTML sanitize/XSS tests | yes |
| `@mudgate/terminal` ScreenBuffer + Canvas2D API | yes |
| `@mudgate/proxy` auth/Origin/allowlist/SSRF policy + WS bridge | yes + tests |
| `@mudgate/web` React+Vite+Tailwind TerminalHost | yes |
| `npm test` 15 green | yes |

## Deferred / partial (medium cut)

- Full reconnect auto-retry UI (WS lifecycle teardown only; policy allows re-connect)
- remote-prod deploy compose
- Typecheck project references build (`tsc -b`) optional — vitest uses source exports
- Live e2e Playwright against mock mud

## Review

Multi-family review after commit (MiniMax-M3 / GLM-5.2 / Qwen3.8-Max-Preview).
