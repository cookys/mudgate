# Hetero architecture review: mudgate mobile terminal layout (stop whack-a-mole)

You are designing a **coherent architecture** for a browser MUD terminal on mobile. The team has been patching symptoms; propose a **single system** that prevents the class of bugs.

## Product
- **mudgate**: React SPA + Canvas2D dual-width (CJK) VT buffer + NAWS to mud.
- Live site: phone Safari/Chrome, portrait + landscape.
- Product policy: **NAWS cols = 80** (map_d / banners). Rows = what height allows.
- Vertical scrollback rail on the right (~18px). Soft keyboard opens/closes.

## Bug class history (do not repeat these mistakes)
1. **cellW forced to floor(W/80)** while font stayed large → **glyph overlap**
2. **Hardcoded 52×22 phone targets** → user rejected
3. **Keyboard close** changes --app-vh but terminal **did not refit/redraw**
4. **Vertical scrollbar** as writingMode range → **looked dead**, didn't drag on mobile
5. **80×cellW wider than stage** → page **horizontally overflowed** ("穿出去") because flex min-width:auto expanded to canvas
6. Fit used width **without reliably excluding** scrollbar gutter
7. VisualViewport: iOS URL bar ≠ keyboard; false kb-open hid UI

## Current code shape (simplified)
- Shell height: CSS `var(--app-vh)` from visualViewport
- TerminalHost: flex row [ stage | scroll rail 18px ]
- applyFit: hostW - 18 → fitTypographyToStage(W,H) → lock cols=80, shrink font only until measure(S).cellW*80 <= W; else needsHScroll
- Canvas draw: exact cols×cellW CSS size; never CSS-scale if possible
- ResizeObserver + orientation + custom `mudgate:viewport` event for keyboard

## User still sees
- Portrait: still overflow left/right with **80×20**
- After keyboard dismisses: **no redraw** (partially patched)
- Scrollbar unusable (partially patched with drag rail)

## Required answer: ONE architecture, not a list of micro-patches

### A. Layout model
How should DOM hierarchy + CSS flex/grid work so:
- Soft keyboard open/close always yields correct stage W×H
- V-scrollbar never steals unaccounted width
- Canvas never expands the document (no body horizontal scroll)
- Optional h-scroll for 80-col only *inside* stage if needed

Name patterns: `100dvh` vs visualViewport, `flex:1 1 0%`, `overflow:hidden` containment, `position:fixed` shell, etc.

### B. Sizing model (pure functions)
Inputs: stageCssW, stageCssH, userFontPref, measure(S)→{cellW,cellH}
Outputs: fontPx, cellW, cellH, cols, rows, naws
Invariants:
- cellW >= measure(S).advance (no overlap)
- cols == 80 (product) OR justify dropping lock
- cols*cellW <= stageW OR explicit contained h-scroll
- rows*cellH <= stageH
When is h-scroll acceptable vs force smaller font vs drop 80?

### C. Lifecycle / single source of truth
Who owns fit? When is fit called? How to debounce?
Events: RO, visualViewport, orientation, fonts.ready, keyboard focus
How to guarantee keyboard-close always refits (one mechanism, not three competing)?

### D. Scrollback UX
Visible vertical control that works on touch; relation to stage width reservation

### E. Minimal file plan for mudgate
Which files to rewrite vs keep; what to **delete** (competing paths)

### F. Anti-whack-a-mole rules
5 rules the implementer must not violate

Output format:
```
LAYOUT: ...
SIZING: ...
LIFECYCLE: ...
SCROLL: ...
FILES: ...
DELETE: ...
RULES:
1. ...
ALGO: <pseudocode 15-30 lines>
ONE_LINE: ...
CONFIDENCE: high|med|low
```
