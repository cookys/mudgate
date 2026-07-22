# Hetero — mobile portrait / landscape MUD UX

**Date**: 2026-07-22  
**Seats**:
| Seat | Model | Status |
|------|-------|--------|
| Codex | gpt-5.6-sol | OK |
| Kimi | **K3 not in harness** → **Kimi-K2.7-Code** (documented; not silent K3 claim) | OK |
| Gemini | agy gemini-3.6-flash-high | OK |

Raw: `2026-07-22-mobile-ux-{codex,kimi,agy}.out`

## Consensus (ALL three)

1. **Shell height = `visualViewport`**, CSS var (`--app-vh` / `--vvh`), fallback `100dvh` — never bare `100vh` / `height:100%` alone for keyboard.
2. **`interactive-widget=resizes-content`** on viewport meta (Android progressive; iOS still needs VV).
3. **Hide thumb pad (+ terminal chrome) while keyboard / cmd focused** — reclaim vertical budget.
4. **Landscape**: explicit button → try `orientation.lock` + fullscreen; **CSS `@media (orientation: landscape)` always authoritative** if lock denied.
5. **Do not CSS-scale canvas** — refit cell grid + NAWS; measured cols/rows must not exceed stage (no minRows inflate).
6. Single-line cmd input; 16px font on iOS; compact Send.

## Divergence

| Topic | Codex | Kimi | Agy |
|-------|-------|------|-----|
| Portrait cols | ~40–48 OK | ≥40 soft | Prefer keep 80 (over-strict for phone) |
| Landscape chrome | Compact header + side movement | Hide header/thumb; thin cmd | 80/20 terminal / D-pad rail |
| History gesture | Swipe on input only | Horizontal swipe on bar | ▲▼ or swipe |

**Orchestrator pick**: Codex portrait budget (readable 40–48 cols) + Kimi/Agy hide-thumb + landscape lock with toast fallback. Agy “never below 80 cols in portrait” rejected for phone width.

## Folded into code (this PR)

- `useVisualViewport` → `--app-vh`, `.kb-open`
- `index.html` interactive-widget
- `termFit`: no forced minCols/minRows above physical fit
- App footer: hide thumb when kb/focus; landscape button; 16px input
- TerminalHost: compact mobile toolbar; VV resize listener

## Deferred

- Full landscape side D-pad rail
- Input history swipe gestures
- Permanent landscape lock preference
