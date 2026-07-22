# Hetero design: mudgate mobile portrait / landscape UX

You are a senior mobile UX + terminal product designer reviewing **mudgate**, a browser MUD client (Canvas2D VT terminal + WSS proxy). Depth benchmark: Chinese MUD 重生的世界 (Big5, map_d, ~80-col teletype feel).

## Product constraints
- Same SPA for desktop + phone (no separate native app).
- Terminal is a **fixed cell grid** (cols×rows via NAWS). Canvas must not CSS-stretch and freckle glyphs.
- Footer always has: command `<input>` + Send + thumb chips (n/s/e/w/look/score) + map toggle on sm.
- Header: brand, tabs, status, settings gear.
- Soft keyboard on iOS/Android can cover 40–50% of the viewport; `100vh` / `height:100%` often wrong when keyboard open.
- User screenshot (portrait): soft **numeric** keyboard open; command bar and terminal stage feel crushed/overflowing; little live MUD text visible.

## Observed bugs / smells
1. Portrait + keyboard: terminal stage does not reliably shrink; content/chrome may overflow the visual viewport.
2. No first-class **landscape** mode or "rotate / landscape play" control.
3. Thumb pad + keyboard + cmd bar stack eats vertical space.
4. Terminal toolbar (copy buttons) competes for space on small screens.

## Questions — answer ALL, be concrete (layout regions, px budgets, CSS APIs)

**A. Portrait default layout** — wireframe regions top→bottom with approximate % of *visual* viewport (not layout viewport). What collapses when keyboard opens?

**B. Keyboard strategy** — `visualViewport` resize? `dvh`? hide thumb pad while focused? scroll-into-view on input focus? `interactive-widget=resizes-content`?

**C. Landscape / "rotate" button** — when to show; use Screen Orientation API lock vs CSS-only dual layout; fallback if lock denied; should landscape hide header/thumb and maximize terminal cols?

**D. Command UX on phone** — keep single-line input vs expand-on-focus; send button size; history swipe?

**E. Movement** — keep n/s/e/w chips vs 3×3 D-pad vs swipe on canvas; portrait vs landscape difference.

**F. Must-fix top 5** for mudgate next PR (file-level if you know: App.tsx footer, tokens.css, index.html viewport, TerminalHost fit).

**G. Anti-patterns** to avoid for MUD specifically (e.g. scaling canvas with CSS, shrinking below readable cols, fighting system keyboard).

Output format (strict):
```
PORTRAIT_LAYOUT: ...
KEYBOARD: ...
LANDSCAPE: ...
CMD_BAR: ...
MOVEMENT: ...
MUST_FIX:
1. ...
2. ...
...
ANTI:
- ...
ONE_LINE: ...
CONFIDENCE: high|med|low
```
