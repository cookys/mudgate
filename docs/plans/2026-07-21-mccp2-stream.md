# Plan — MCCP2 stream inflate (proxy)

> **Status**: **SHIP** (feat/mccp2-stream) (multi-LLM loop R2–R4; Grok+GLM+MiniMax APPROVE*; Codex must-fixes folded)
> **Owner**: cookys  
> **Seq**: **1**  
> **Branch**: `feat/mccp2-stream`  
> **Project**: `docs/projects/2026-07-21-mccp2-stream/`  

## Goal

Flag-gated **IAC DO MCCP2** + proxy **zlib stream inflate** before browser; never Telnet-parse compressed wire.

## Hetero engines (must satisfy)

Grok · Codex · GLM · MiniMax (Claude deferred to 2026-07-23 quota). See `docs/reviews/2026-07-21-hetero-multi-llm.md`.

## Frozen wire path (R1+R2)

### State

```ts
compressed_mode: boolean = false
inflate: zlib.Inflate | null = null
// counters (exact):
// inflated_session_bytes: number  // lifetime of this bridge connection
// inflated_window_bytes: number   // reset every WINDOW_MS
// WINDOW_MS = 60_000
// MAX_INFLATED_PER_WINDOW = env ASSMUD_MCCP_MAX_WINDOW_BYTES default 16*1024*1024
// MAX_INFLATED_SESSION = env ASSMUD_MCCP_MAX_SESSION_BYTES default 256*1024*1024  // NOT 64MiB hard kill for long play
// MAX_COMPRESSED_WIRE_SESSION = env default 128*1024*1024  // wire-side flood guard
// MAX_PARSER_FEED_CHUNK = 60_000  // < TelnetParser.MAX_BUF 65536
```

### Per TCP chunk

```
if (!compressed_mode):
  // Required atomic API (name is fixed):
  result = parser.pushUntilMccpStart(chunk)
  // { events, mccpStarted, residual }
  for data in events: forward to ws
  if mccpStarted:
    if !ASSMUD_MCCP_enabled:
      // rogue server — do NOT enter compressed_mode
      destroy("mccp se while disabled")
    else:
      compressed_mode = true
      inflate = zlib.createInflate()  // zlib wrapper, NOT inflateRaw by default
      wire inflate 'data' → feedParserDecompressed(buf)
      wire inflate 'error' → destroy, no further forward
      if residualAfterSe.length: inflate.write(residualAfterSe)

if compressed_mode:
  // NEVER parser.push(wireChunk)
  compressed_wire_session += chunk.length   // overflow-safe: reject if incoming > cap - current
  if over wire cap: destroy
  inflate.write(chunk)

// TCP close / EOF:
on sock 'end'/'close':
  if inflate:
    inflate.end()            // flush
    await 'end' or 'error'   // then close WS
    // truncated zlib without clean end → destroy/error (do not accept as success)
  else:
    close WS normally

function feedParserDecompressed(buf):
  split buf into slices <= MAX_PARSER_FEED_CHUNK
  for each slice:
    events = parser.push(slice)  // plaintext telnet after inflate
    count inflated bytes; enforce window/session caps BEFORE ws.send
    for data: ws.send(binary)
```

**residualAfterSe**: count `residualAfterSe.length` toward **compressed_wire_session** before `inflate.write(residual)` (it is compressed wire, not inflated).

### Parser API (canonical — R3 Codex)

Prefer **atomic** API only (do not rely on takeResidual alone):

```ts
pushUntilMccpStart(chunk): {
  events: TelnetEvent[];
  mccpStarted: boolean;
  residual: Uint8Array; // every byte AFTER completed IAC SB MCCP2 IAC SE, untouched
}
// Must preserve incomplete SE across pushes.
// After mccpStarted, MUST NOT parse or emit any following wire bytes as telnet.
```

`push(chunk)` remains for post-inflate plaintext only.

**Fixtures required**: same-chunk SE+payload; SE split across TCP chunks; successful stream finalization (inflate.end clean); truncated stream destroy.

### Flag

- `ASSMUD_MCCP` default **1**
- Read in **bridge/cli only**; pass `{ mccp: boolean }` into `replyToNegotiation(kind, option, opts)` — **no process.env in pure protocol package**
- flag 0 → DONT on WILL MCCP2; if server still sends SB MCCP2 SE → **destroy** (protocol violation)

### Ship atomicity

- **M0+M1 ship together** (or keep DONT until inflate ready). Never land DO without inflate path.

### tryInflateMccp

- **Remove export entirely** (unused; dangerous if reused). Stream only.

### Failure

- inflate error / truncated stream / cap → destroy TCP+WS; optional JSON `{type:error,message:'mccp'}` once; **no** silent plaintext fallthrough.

## Phases

| ID | Work | Acceptance |
|----|------|------------|
| M0+M1 | Flag, DO/DONT, parser residual API, stream inflate, fixtures | all unit+bridge tests below green |
| M2 | Caps, destroy paths, delete tryInflateMccp | bomb/trunc tests |
| M3 | Manual RW checklist doc | md |

## Required tests

1. DONT when flag 0; DO when flag 1  
2. Multi-chunk zlib after SE  
3. **Same chunk**: SE + compressed residual  
4. **SE split** across two TCP chunks  
5. Truncated stream → destroy  
6. Cap exceed → destroy  
7. No compressed bytes on WebSocket (assert non-zlib looking payload after start)  
8. Preceding plaintext before SE still forwarded  

## Review log

| Round | Engines | Result |
|-------|---------|--------|
| R1 multi-role single | Grok multi-role | BLOCK → partial fold |
| R2 multi-LLM | Grok+Codex BLOCK; GLM/MiniMax APPROVE_WITH_NITS | this fold R2 |
