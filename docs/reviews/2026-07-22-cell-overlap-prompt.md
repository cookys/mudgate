# Terminal cell overlap: shrink font vs shrink cell pitch

mudgate locks NAWS cols=80 for MUD map_d. On phone (~360px wide), code did:

```
if measured.cellW * 80 > stageW:
  cellW = floor(stageW / 80)  // FORCE pitch smaller than measureText('M')
  // still draw with fontSizePx (not re-measured to that pitch)
```

User reports **overlapping glyphs**. Suspect: cell pitch forced down without shrinking font.

## Questions
1. Is forcing cellW < measured advance the correct cause of overlap?
2. Correct policy for fixed 80 cols on narrow stage?
   A) Only shrink fontSize until measure(S).cellW * 80 <= W (never cellW < measure)
   B) Shrink letter-spacing / cellWidthScale only
   C) Allow horizontal scroll with full measured cells at user font, cols still 80
   D) Drop lock 80 when impossible at min readable font
3. Pseudocode pure function: fit(W,H,userFont,measure) → {S, cellW, cellH, cols=80, rows}
4. Should cellH also only come from metrics at S (not independent squeeze)?

```
CAUSE: ...
POLICY: A|B|C|D or mix
ALGO: ...
ONE_LINE: ...
CONFIDENCE: high|med|low
```
