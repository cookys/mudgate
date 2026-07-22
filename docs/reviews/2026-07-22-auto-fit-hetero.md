# Hetero — automatic term font/grid fit (no magic phone targets)

**Date**: 2026-07-22  
**Seats**: codex gpt-5.6-sol · Kimi-K2.7-Code (K3 N/A) · agy gemini-3.6-flash-high  

## Consensus

| Topic | Agreement |
|-------|-----------|
| **Default industry** | xterm.js FitAddon / VS Code / Termux: **keep user font**, `cols=floor(W/cellW)`, `rows=floor(H/cellH)` |
| **No device if(phone)** | Do not hardcode 52×22 or breakpoints |
| **Optional shrink** | Only as **VT classic 80-col policy** (MUD/map_d semantics), binary-search largest readable font |
| **Readable floor** | Relative to user pref or accessibility setting — not a random phone constant |
| **Never** | CSS-scale canvas; report NAWS larger than physical grid |

## Divergence

| | Codex | Kimi / Agy |
|--|-------|------------|
| Auto-shrink default | **Off** unless explicit classic mode | On, target 80 cols |
| 80 | Named compatibility profile | Built-in when narrow |

**Orchestrator fold**: pure `fitTypographyToStage(W,H,userPref,measure)` — preserve user font when cols≥80; else binary-search toward **VT_CLASSIC_COLS=80** with minFont = f(userPref). No 52/22.

## Folded

- `termFit.ts`: `fitTypographyToStage`, removed mobileTarget*
- `canvas2d`: store `fontSizePx`, measure at exact size (not cellH-4)
- `TerminalHost.applyFit`: call pure fit only
