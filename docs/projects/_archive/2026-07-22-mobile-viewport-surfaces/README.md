# Mobile viewport surfaces — SHIP

## Project Goal

> **Final goal**: Phone portrait controls are compact, and every full-screen entry/modal surface remains usable when its content exceeds the visual viewport.
> **Success criteria**: All four user requirements below map to implemented phases; `shellControls.test.ts`, the full test suite, typecheck, and web production build return zero failures; LAN HTTP/WebSocket smoke passes and the 320–767px portrait interaction is ready for user verification.
> **Scope boundary**: React web shell, ConnectGate, fixed dialogs, shared viewport layout primitive, and tests. Terminal rendering and in-panel map popups are excluded.

## User-stated requirements ledger

| Requirement | Phase |
|---|---|
| “直式的時候，語系選擇可以變成 button -> modal” | P0 |
| “以連線可以變成 indicator” | P0 |
| “session tab 可以往下變成內容的 tab” | P0 |
| “mobile 基礎的定位要處理，外面正常要一個 container 裝著內容物超出就要有 scroll bar…不然你『接入線路』modal 超出螢幕就按不到” | P1 |

## Scope completeness audit

| Dimension | Coverage |
|---|---|
| Source + tests | `apps/web` shell/components/styles plus component contract tests |
| User-facing docs | This plan/project record; behavior is self-explanatory UI |
| Public API/data/config | None |
| Migration/version/CHANGELOG | Not applicable; no persisted format or released API changes |
| External consumers/security | None; no credential or network-flow changes |
| Dogfood | LAN Vite shell is the test target |

## Phases

| Phase | Work | Status |
|---|---|---|
| P0 | Portrait locale modal, status indicator, content session tabs | Complete |
| P1 | Shared visual-viewport container and scroll-bounded fixed dialogs | Complete |
| P2 | Full quality gate, independent review, merge, LAN smoke | Complete |

## Final results

- Portrait locale selection is a button-backed, viewport-bounded modal; connection state is a compact accessible indicator; session navigation moves below the header as content tabs.
- ConnectGate owns vertical scrolling inside the visual viewport, and every full-screen dialog panel is height-bounded with its own vertical overflow.
- Regression checks passed: 4 focused shell contracts, 33 test files / 240 tests, TypeScript project check, and production build.
- Independent review returned PASS; merged to `develop` as `efefeee`.
- LAN smoke passed on `0.0.0.0:5173` with HTTP 200 and the proxy WebSocket reachable; real-browser short-height interaction remains a manual test, with future automation tracked in `docs/BACKLOG.md`.

## Skill routing

- React shell / TerminalHost route: `autopilot:debug` — trace layout/state ownership before edits.
- Vitest route: `autopilot:test-strategy` — component contract tests plus full regression baseline.
- Pre-commit route: `autopilot:quality-pipeline` — scan, completeness, and independent review.
