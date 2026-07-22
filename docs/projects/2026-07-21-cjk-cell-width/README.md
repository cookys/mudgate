# Project — CJK cell width + IP docs

> **Plan**: [`docs/plans/2026-07-21-cjk-cell-width-taiwanmud.md`](../../plans/2026-07-21-cjk-cell-width-taiwanmud.md)  
> **Branch**: `feat/cjk-cell-width` → `develop`  
> **Status**: **SHIP** 2026-07-21  

## Scope (W1–W4 + I1)

- `resolveWidthMode` / charset aliases (`@mudgate/profiles`)  
- `isWide(ch, cjk|western)` + ScreenBuffer widthMode  
- Web: profile → TerminalHost  
- RW MOTD golden test  
- `docs/deploy/SELF-HOSTED-PROXY.md`  

## Not in this ship

- Full taiwanmudlist probe (T1)  
- Profile seeds for 23 sites (T2)  
