# Project — W05 ECHO password mask

> **Plan**: [`docs/plans/2026-07-21-echo-password-mask.md`](../../plans/2026-07-21-echo-password-mask.md)  
> **Branch**: `feat/echo-password-mask` → `develop`  
> **Status**: **SHIP** 2026-07-21  


## Scope

Transient Telnet ECHO → web command-line `type=password` only while server claims ECHO.

## Files

- `packages/protocol/src/telnet.ts` — ECHO negotiation replies  
- `apps/proxy/src/bridge.ts` — mask state + JSON control  
- `apps/web/src/lib/mudSocket.ts` — `onEchoMask`  
- `apps/web/src/TerminalHost.tsx` / `App.tsx` — input type toggle  
- tests: protocol ECHO + bridge WILL/WONT/DO  

## Residual

- Live RW login capture  
- Sticky-mask escape UI  
