# Hetero — mobile terminal architecture (stop whack-a-mole)

**Date**: 2026-07-22  
**Seats**: codex gpt-5.6-sol · Qwen3.8-Max-Preview · agy gemini-3.6-flash-high  
**All CONFIDENCE: high**

## ONE_LINE consensus

Reserve chrome in **CSS Grid/flex** (stage + fixed rail); measure **only the stage box**; derive cells **only from font metrics**; commit **one rAF fit transaction** → buffer resize (preserve) → canvas paint → NAWS if changed.

## Shared architecture

### Layout
```
fixed AppShell (height: --app-vh, overflow:hidden)
  header / main(flex 1 1 0%, min 0) / footer
  TerminalHost: grid | minmax(0,1fr) | 18px rail
    Stage: minmax(0,1fr), overflow-x auto only if needsHScroll, overflow-y hidden
      Canvas: display:block; width=80*cellW; height=rows*cellH  (never flex-grow)
    ScrollRail: fixed 18px, pointer-capture drag
```
- Body/html overflow hidden  
- Canvas **cannot** expand document (`min-width:0` / `width:0` flex / grid `minmax(0,1fr)`)  
- **Do not** `hostW - 18` in JS — stage’s own `clientWidth` after layout is truth  

### Sizing
- cols = **80** always (product)  
- cellW = measure(S) only — **never** W/80  
- binary search largest S with `80 * cellW <= stageW`  
- if floor font still overflows → **contained h-scroll**, keep 80 + honest pitch  
- rows = floor(stageH / cellH)  

### Lifecycle (single owner)
```
visualViewport → only updates --app-vh
         ↓ CSS shell height
stage ResizeObserver → scheduleFit (rAF coalesce only)
         ↓
one transaction: measure stage → fit → setTypography → buffer.resize(preserve)
                 → canvas size → paint → NAWS if grid changed
```
- **Delete** competing: timeout bursts, orientation+VV+window all calling fit separately  
- Keyboard close = shell height change → RO fires → same scheduleFit  
- Transient 0×0: skip, keep last bitmap  

### Scroll
- Always-reserved 18px rail (or proportional)  
- Pointer capture track/thumb (not range+writingMode)  
- Rail only vertical scrollback; stage owns optional h-scroll  

## RULES (implementer must not violate)

1. Geometry from **observed stage** content box — no gutter constants in fit math.  
2. Font measurement owns cell pitch — no squeeze, no CSS scale to force 80.  
3. cols === NAWS.cols === 80; after min font, h-scroll inside stage only.  
4. **One** scheduled atomic fit transaction ending in paint.  
5. No terminal descendant may grow document width (`scrollWidth === clientWidth`).  

## Fold status

| Item | Status |
|------|--------|
| paint pipeline, no dispose on resize | **done** |
| font-only shrink, no pitch squeeze | **done** |
| pointer scroll rail | **done** |
| CSS grid + measure stage only (no host−18) | **done** |
| Single RO owner, rAF + one trailing settle | **done** |
| AppShell fixed + min-w-0 ancestors | **done** |

Implemented: TerminalHost grid `minmax(0,1fr)|18px`, fit = stage.clientWidth/Height only, scheduleFit = rAF+150ms trailing (no VV/orientation burst soup), fixed shell in App play mode.
