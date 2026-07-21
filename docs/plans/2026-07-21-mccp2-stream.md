# Plan — MCCP2 stream inflate (proxy)

> **Status**: **approved** (hetero R1 BLOCK → fold-in 2026-07-21)  
> **Owner**: cookys  
> **Seq**: **1** on roadmap  
> **Branch**: `feat/mccp2-stream`  
> **Project**: `docs/projects/2026-07-21-mccp2-stream/`  
> **Extends**: `2026-07-21-rw-connect-protocols.md`  

## Goal

RW（及 WILL MCCP2 的 MUD）在 flag 開啟時 **IAC DO MCCP2**；proxy **串流 zlib inflate** 後再送 Big5/VT 可用的 binary 給 browser。

## Frozen wire path (R1 must-fix — no ambiguity)

```
TCP chunk
  └─ if NOT compressed_mode:
        TelnetParser.push(chunk)
        · data events → (optional) still plaintext → ws binary
        · on IAC SB MCCP2 … IAC SE:
              compressed_mode = true
              any residual bytes AFTER SE in same chunk → inflate.write(residual)
  └─ if compressed_mode:
        inflate.write(entire TCP chunk)   // NEVER TelnetParser on wire zlib
        inflate 'data' → TelnetParser.push(decompressed)
        · decompressed data events → ws binary
        · IAC on decompressed stream still valid (negotiate rare post-start)
```

**Rules**

1. **Never** `parser.push` on compressed wire bytes.  
2. **Same-chunk SE + payload** fixture is **mandatory**.  
3. Use **`zlib.createInflate()`** (zlib wrapper, not raw) as primary; one test for raw-fallback **only if** documented server variant — default path is `createInflate`.  
4. **Delete hot-path** `tryInflateMccp` silent pass-through (`mccp.ts`); errors → control frame / log + **destroy connection** (no fallthrough as plaintext).  
5. **Caps**: max inflated bytes per session window e.g. **16 MiB burst / 64 MiB session** (env override); on exceed → destroy.  
6. **`ASSMUD_MCCP`**: `localhost-dev` default **1**; **`remote-prod` default 0** until soak — or 1 with caps (Board: default **1 both** with strict caps). **CEO freeze**: default **1** all modes; caps required.  
7. `replyToNegotiation`: flag off → DONT; flag on → DO for WILL MCCP2.

## Non-goals

- MCCP1-only, browser pako, MXP on  

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| M0 | Flag + DO/DONT in replyToNegotiation + bridge read | S | tests: DONT when 0, DO when 1 |
| M1 | Stream state machine + createInflate + same-chunk fixture | L | multi-chunk + SE residual tests green |
| M2 | Caps, destroy on error, remove tryInflateMccp from hot path | S | bomb/truncated tests |
| M3 | Docs checklist RW (manual) | S | md note |

## Tests (required)

- Negotiation DO/DONT  
- Multi-chunk inflate  
- **Same TCP chunk: SE then compressed bytes**  
- Truncated stream → close, no process throw  
- Output cap exceeded → close  

## Risks

| Risk | Mitigation |
|------|------------|
| Boundary wrong → mojibake | frozen path + fixtures |
| DoS inflate | caps + destroy |
| Silent wrong decode | no fallthrough |

## Review log

| Round | Result |
|-------|--------|
| R0 | authored |
| R1 hetero | **BLOCK** — path ambiguity, tryInflateMccp, caps, same-chunk fixture |
| R1 fold | path frozen; must-fix inlined → **approved for expand** |