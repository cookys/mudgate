# Hetero — cell overlap (shrink font vs pitch)

**Seats**: gpt-5.6-sol, Qwen3.8-Max-Preview — both CONFIDENCE high

## Verdict
- **CAUSE**: `cellW = floor(W/80)` while still drawing at larger `fontSize` → glyph advance > pitch → overlap
- **POLICY**: **A** — only shrink **font size**; `cellW` always `= measure(S)` (never smaller)
- **cellH**: only from metrics at same S
- If 80 still impossible at min font: keep measured pitch + h-scroll (not squeeze)

## Folded
termFit no force-pitch; TerminalHost h-scroll when needsHScroll
