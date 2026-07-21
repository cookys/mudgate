# Plan — Web zMUD client (deep support for Revival World)

> **Status**: draft  
> **Owner**: cookys  
> **Branch**: `main` (bootstrap); feature work on `feat/*` after stack pick  
> **Frame**: modern browser client that recreates zMUD-class power features, tuned first for [重生的世界 / Revival World](https://www.revivalworld.org)

## 0. Context / thesis

Classic zMUD (and successors like cMUD) gave power users triggers, aliases, variables, buttons, and automapper. **All MUD game traffic is TCP (Telnet framing)** — that does not change. Revival World is a long-running Chinese LPMud (`mud.revivalworld.org:4000/5000/6000`); **RW deep support is the product north star**.

**2026-07-21 live probe** ([research](../research/rw-probe-2026-07-21.md)) confirmed:

- TCP ports 4000/5000/6000 open; banner ~2KB + Telnet IAC.
- Server advertises: **TTYPE, NAWS, MCCP2, MXP, MSSP**.
- Charset: **Traditional Chinese BIG5** (server prints `Current charset is Traditional Chinese (BIG5)`; also accepts `GB`/`BIG5` switch).
- Payload is **not UTF-8**; decode path must be Big5-aware **before** Unicode UI.

**Browser constraint (not a product choice):** pure web pages cannot open arbitrary TCP sockets. Therefore the **MUD leg is always TCP**; the **browser leg** is either:

| Mode | Path | When |
|------|------|------|
| A. Local/sidecar proxy | Browser ⇄ WebSocket/WebTransport ⇄ **proxy process** ⇄ **TCP → MudOS** | default web |
| B. Native shell | Tauri/Electron/WASI-host opens **raw TCP** | if we ship a desktop wrapper |
| C. Hosted relay | Browser ⇄ wss ⇄ our relay ⇄ TCP → MudOS | multi-device; needs auth + anti-open-relay |

Product language: **“TCP to the MUD” is non-negotiable.** WebSocket is only the browser-side carriage of that TCP byte stream.

Prior art: RW Java applet client + telnet. We replace that with a modern client that still speaks the same TCP/Telnet/Big5 wire.

## 1. Problem

Players need a **modern web client** that:

1. Connects reliably to Revival World from the browser.
2. Renders Chinese + ANSI correctly and snappily.
3. Supports zMUD-depth automation (triggers / aliases / variables / scripts) without shipping a desktop app.
4. Is secure by default (MUD output is untrusted; scripts can be malicious).

## 2. OKR / KRs

**Objective**: Ship a usable web zMUD-class client that a daily RW player can prefer over telnet/zMUD for core play.

**Key Results**:
- KR1 — Connect + login to RW from browser (via proxy), stable 30+ min session without garbled text.
- KR2 — Trigger/alias/variable engine covers the user’s top 10 RW automation cases (list to be frozen with user).
- KR3 — Zero stored credentials in repo; XSS from adversarial MUD output blocked in tests.
- KR4 — Docs tracking (`docs/plans` + `docs/projects` + INDEX) stays current for every L-size phase.

## 2.5 Global Constraints (copied verbatim into every dispatch)

- Target MUD primary: `mud.revivalworld.org` ports `4000|5000|6000`.
- **Wire to MudOS is always raw TCP + Telnet IAC** (never “HTTP-only MUD”).
- Browser UI may use WebSocket/WebTransport only as a **byte-pipe carriage** into a component that holds the real TCP socket (proxy or native shell). Do not pretend the MUD protocol is JSON-RPC.
- Default session charset for RW: **Big5** (GB switch is secondary). Do not assume UTF-8 on the wire.
- Stream pipeline is **byte-first**: IAC → (optional MCCP2 inflate) → Big5/DBCS tokenizer → cells → render. Never `bytes.toString('utf8')` on RW traffic.
- Support Telnet option negotiation at least for: TTYPE, NAWS; optionally MCCP2, MSSP, MXP (MXP must be sanitized — XSS).
- **雙色字 / DBCS mid-glyph attributes** are a first-class rendering requirement for Chinese MUD fidelity (see research note).
- MUD server output is **untrusted**; terminal render path must not inject raw HTML from MXP/ANSI without a sanitizer.
- No player passwords, session tokens, or captcha solutions committed to git.
- Traditional Chinese UI first; English secondary.
- Performance: **TypeScript-first**; WASM only where measured hotspots need it (see §0 WASM note / ADR). Repo name `assmud` is an intentional WASM wink, not a mandate to write the whole client in AssemblyScript day one.
- Autopilot tracking: every L-size phase updates `docs/projects/.../README.md` + `docs/projects/INDEX.md`.

## 3. File-structure map (intended — after Phase 0)

| Path | Responsibility |
|------|----------------|
| `apps/web/` | SPA: terminal, settings, package manager UI |
| `apps/proxy/` (or `packages/proxy/`) | WS server bridging to MudOS TCP |
| `packages/terminal/` | Big5/DBCS cellizer, ANSI/SGR, dual-color, scrollback, render |
| `packages/script-engine/` | triggers / aliases / variables / timers (match on decoded lines + raw optional) |
| `packages/protocol/` | Telnet IAC, MCCP2, MSSP/MXP hooks, encoding, reconnect |
| `packages/codec-big5/` (or inside protocol) | Big5↔Unicode + DBCS-safe split; WASM candidate later |
| `packages/mapper/` | optional automap (later phase) |
| `docs/plans/` | executable plans |
| `docs/projects/` | L-size execution tracking + INDEX |
| `docs/research/` | RW fixtures notes, encoding notes (no secrets) |
| `tests/fixtures/streams/` | golden byte/text streams (anonymized) |

## 4. Phases

### Phase 0 — Product + architecture design (Size: L)
- Confirm must-have zMUD features vs nice-to-have.
- Capture RW constraints (encoding, captcha, line discipline) with user-assisted probes.
- Pick stack (e.g. Vite+React/Svelte + xterm.js vs custom canvas; Node/Bun proxy).
- Write `docs/architecture.md` + ADR-001 stack.
- **Acceptance**: ADR approved by user; Phase 1 file map frozen; open questions closed or deferred to BACKLOG.

### Phase 1 — Connect path + terminal MVP (Size: L)
- Scaffold monorepo + CI smoke.
- **TCP-owning** proxy (or Tauri TCP) with origin checks; reconnect; idle handling; Telnet IAC (TTYPE/NAWS minimum).
- Terminal: **Big5 default**, ANSI SGR, scrollback; fixture from live banner (`tests/fixtures/streams/rw-banner-4000.bin`).
- Manual: connect to RW, see「重生的世界」banner without mojibake, type at name prompt.
- **Acceptance**: KR1 path demonstrated; Big5 banner golden test; proxy refuses open-relay; UTF-8 mis-decode test fails closed.

### Phase 2 — Core automation engine (Size: L)
- Aliases, triggers (regex + simple), variables, send queues.
- Persist packages locally (IndexedDB); import/export JSON.
- Sandbox constraints for any user JS (if allowed).
- **Acceptance**: top automation cases from KR2 green; malicious script package cannot read cookies/local secrets in tests.

### Phase 3 — RW deep support pack (Size: L)
- Login/captcha UX helpers (human-in-the-loop; no captcha bypass).
- **雙色字** + mid-DBCS SGR fixtures; GB/BIG5 switch at login.
- Optional MCCP2; careful MXP (off by default until sanitizer green).
- Common RW triggers pack (HP/bar, combat, channel highlights) — user-validated.
- Prompt detection, multi-line blocks.
- Optional: link-out to RW online who / 2D map.
- **Acceptance**: daily-play checklist signed off by user on live RW; dual-color fixture renders two attrs on one full-width glyph.

### Phase 4 — Power features parity slice (Size: L, optional split)
- Buttons / keypad, multi-session tabs, basic mapper spike.
- Log save / search.
- **Acceptance**: feature matrix vs zMUD core shows planned parity; deferred items in BACKLOG.

## 5. Test / validation

| Layer | What |
|-------|------|
| Unit | ANSI parser, trigger matcher, encoding, sanitize |
| Integration | proxy framing, reconnect, mock TCP server |
| Golden streams | anonymized RW-like fixtures (never live passwords) |
| E2E | Playwright against mock Mud; optional manual live RW |
| Security | XSS corpus on terminal; open-relay tests on proxy |
| Human-gated | live RW captcha/login, feel of latency, package UX |

## 6. Risks + inversion

| Risk | Inversion (what guarantees failure) | Mitigation |
|------|-------------------------------------|------------|
| Encoding mojibake | assume UTF-8 only | **probe done: BIG5**; golden banner fixture; fail tests on UTF-8 path |
| Dual-color broken | Unicode-first terminal | byte/DBCS cellizer; mid-glyph attr tests |
| MCCP2 corruption | inflate wrong stream | negotiate only after WILL/DO; zlib tests |
| MXP XSS | render MXP as HTML | default off; sanitizer; security review |
| Proxy becomes open relay | no origin/auth checks | default bind localhost; origin allowlist |
| XSS via MUD output | `innerHTML` raw | pure text/ANSI pipeline + tests |
| Scope explosion (full zMUD clone) | build everything before connect works | Phase 1 MVP gate |
| Captcha / ToS | automate captcha | human-in-the-loop only |
| Script sandbox escape | eval user JS in page context | isolate or restrict to declarative triggers first |

## 7. Out of scope (v1)

- Full cMUD/zMUD binary package format 100% compatibility
- Hosting a public open proxy for the whole internet
- 3D RW client (`rw3d`) integration
- Server-side botting / unattended farming
- Mobile-native apps (PWA later ok)

## 8. Open questions (Board / user)

1. Preferred UI stack: React vs Svelte vs Solid? (recommend: **Vite + React**; terminal likely **custom Big5 cell renderer**, not stock xterm.js alone — xterm is UTF-8/Unicode oriented)
2. Carriage mode first: **local TCP proxy sidecar** vs **Tauri raw TCP** vs hosted relay?
3. Do you have existing zMUD/Mudlet scripts + a **雙色字 sample log** to freeze as fixtures?
4. ~~Encoding?~~ **Resolved by probe: BIG5** (GB switch still supported). Confirm you still play in BIG5 mode.
5. Must-have automation list (top 10) for KR2 freeze?
6. WASM appetite: **hot path only** (Big5/ANSI tokenizer, trigger matcher) vs “brand as WASM client”?

## 9. WASM note (`assmud` 惡趣味)

| Layer | Need WASM day-1? | Why |
|-------|------------------|-----|
| TCP/Telnet I/O | No | OS socket / Node net / Tauri |
| Big5 + ANSI cellizer | **Maybe later** | JS is fine for 80×24×N; WASM if profiling shows multi-MB scrollback or 1k+ triggers/frame |
| Trigger regex engine | Maybe later | many concurrent RE on hot path |
| MCCP2 zlib | No | browser/`pako`/Node zlib enough |
| UI React/DOM | No | WASM does not help |

**Recommendation:** ship TypeScript pipeline first; design `packages/codec-big5` + `packages/terminal` with a stable byte-oriented API so a **Rust/WASM** (or AssemblyScript) backend can swap in without rewriting the app. That honors the `assmud` joke without blocking MVP.

## Review log

- R0 2026-07-21 — author: onboard bootstrap (draft)
- R1 2026-07-21 — live TCP probe: BIG5 + MCCP2/MXP/MSSP/TTYPE/NAWS; TCP-first wording; dual-color + WASM notes
