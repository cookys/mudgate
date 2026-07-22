# UI Spec — mudgate ink terminal

> Frozen from Board answers 2026-07-21 + plan `docs/plans/2026-07-21-ui-redesign.md`

## Brand

| Item | Value |
|------|--------|
| Product | **mudgate** |
| Tagline (connect gate) | Rotating Ass-themed prank lines (`pickTagline()`) |
| Primary line | **Ass-embly required. Mud optional. Regret included.** |
| Alt lines | Half Ass half MUD · If this crashes the Ass is yours · No WASM TCP just Ass WSS… |

## Accent (user-selectable)

| Theme id | Accent | Glow |
|----------|--------|------|
| `mint` (default) | `#3dffa8` | `rgba(61,255,168,.25)` |
| `blue` | `#5b9dff` | `rgba(91,157,255,.25)` |

Persisted: `localStorage.mudgate.accent`

## Surfaces

- Desktop map panel: **default open**
- Mobile map panel: **default closed**
- Fonts: Google Fonts CDN + `preconnect` + `display=swap` (browser HTTP cache)

## Layout rules

- Connected: terminal ≥ 60% viewport height
- Settings/token/profiles: drawer only
- Command bar sticky; mobile thumb pad + `safe-area-inset-bottom`

## Locale (UI i18n) — Board frozen 2026-07-21

> Plan: `docs/plans/2026-07-21-i18n-locale.md` · hetero: `docs/reviews/2026-07-21-i18n-hetero.md`  
> Fonts: `docs/design/terminal-fonts.md`

| Item | Value |
|------|--------|
| Locales v1 | **`zh-TW`**, **`zh-CN`**, **`en`** (allowlist；**不**把簡體併入正體) |
| Storage | `localStorage.mudgate.locale` (try/catch) |
| Default | **站台設定** → 瀏覽器偵測 → `zh-TW`；使用者選過則 storage 優先 |
| Site default | `VITE_DEFAULT_LOCALE` 或 `window.__MUDGATE_SITE__.defaultLocale` |
| Scope | **Shell only** — never MUD stream / scripts |
| Status | `StatusEvent` codes → `t()`；tone from code only |
| Switcher | ConnectGate + drawer + **desktop topbar** |
| Taglines | EN Ass 包 + **中文玩笑包**（zh-TW / zh-CN） |
| `<html lang>` | UI locale |
| Terminal wrapper | `lang="und"` |
| Library | Mini `t()` + TS dicts — **no i18next** |
| Terminal type | **可切換 dual-width mono** + 字級/字寬/行高（見 terminal-fonts.md） |
