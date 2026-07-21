# UI Spec — assmud ink terminal

> Frozen from Board answers 2026-07-21 + plan `docs/plans/2026-07-21-ui-redesign.md`

## Brand

| Item | Value |
|------|--------|
| Product | **assmud** |
| Tagline (connect gate) | Rotating Ass-themed prank lines (`pickTagline()`) |
| Primary line | **Ass-embly required. Mud optional. Regret included.** |
| Alt lines | Half Ass half MUD · If this crashes the Ass is yours · No WASM TCP just Ass WSS… |

## Accent (user-selectable)

| Theme id | Accent | Glow |
|----------|--------|------|
| `mint` (default) | `#3dffa8` | `rgba(61,255,168,.25)` |
| `blue` | `#5b9dff` | `rgba(91,157,255,.25)` |

Persisted: `localStorage.assmud.accent`

## Surfaces

- Desktop map panel: **default open**
- Mobile map panel: **default closed**
- Fonts: Google Fonts CDN + `preconnect` + `display=swap` (browser HTTP cache)

## Layout rules

- Connected: terminal ≥ 60% viewport height
- Settings/token/profiles: drawer only
- Command bar sticky; mobile thumb pad + `safe-area-inset-bottom`
