# Hetero design: automatic terminal font/grid sizing (no magic constants)

Product: **mudgate** — browser MUD client, Canvas2D dual-width (CJK) VT grid + NAWS.
Benchmark MUD: 重生的世界 (Big5 map_d, expects classic ~80-col layout when space allows).

## Current (bad) approach
We hardcode mobile targets like `targetCols=52`, `targetRows=22`, `minFontPx=11`, then loop shrink font until targets met. User rejected hardcoding.

Phone measured **38×14** at desktop 15px before shrink; after hardcode shrink toward 52×22.

## Constraints
- Grid is integer cols×rows; each half-width cell has measured CSS px size (cellW/cellH from real font metrics).
- Canvas must NOT CSS-scale glyphs (blurs CJK).
- NAWS must report the real on-screen grid.
- Portrait phones ~360–430 CSS px wide; landscape ~700–900 wide, short height.
- Desktop wide: keep user-chosen font size (settings), do not force 52 cols.

## Ask — answer all sections

**A. Industry / prior art**: How do xterm.js, Blink shell, JuiceSSH, Termux, VS Code terminal, iOS a-Shell, or web SSH clients auto-size font vs cols? Name algorithms (e.g. binary search font to maximize cols under min-readable-px; fixed char density; CSS `ch` units; container query).

**B. What to optimize**: Maximize cols? Maximize area cols*rows? Prefer readable min font then fill? Preserve aspect of classic 80×24 / 80×N?

**C. Algorithm (pseudocode)** given stageCssW, stageCssH, userFontPref, measured mono advance at size S. Must work for portrait AND landscape without `if (phone) target=52`.

**D. Inputs only from geometry + metrics** — list pure functions of (W,H,metrics,userPref). No magic 52/22.

**E. Guardrails**: min readable px for CJK MUD? max cols? when to stop shrinking?

**F. mudgate-specific MUST_FIX** for next PR (file-level if possible: termFit.ts, canvas2d recomputeCellWidth, TerminalHost applyFit).

Output strict:
```
PRIOR_ART: ...
OPTIMIZE: ...
ALGO: ...
INPUTS: ...
GUARDS: ...
MUST_FIX:
1. ...
ONE_LINE: ...
CONFIDENCE: high|med|low
```
