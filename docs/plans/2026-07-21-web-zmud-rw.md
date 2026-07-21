# Plan — Web zMUD client (secure multi-MUD; deep support for Revival World)

> **Status**: draft  
> **Owner**: cookys  
> **Branch**: `main` (bootstrap); feature work on `feat/*` after stack pick  
> **North star (Board)**: 電腦或手機透過本網頁專案，在 **加密安全** 條件下連上 **各家 MUD** 遊玩。  
> **Depth benchmark**: [重生的世界 / Revival World](https://www.revivalworld.org)（Big5 + 完整 VT/map_d）作為最難適配標竿。

## 0. Context / thesis

### Product goal (final)

| Dimension | Target |
|-----------|--------|
| Surfaces | **Desktop + mobile** browsers (responsive; PWA later) |
| Reach | **Any Telnet/TCP MUD** the user chooses (host:port + charset + options) |
| Power | zMUD-class: terminal fidelity, triggers, aliases, variables, packages |
| Security | **TLS on the public path**; no open-relay; untrusted MUD output; no secrets in repo |
| Depth | RW first as the fidelity ceiling so “各家 mud” don’t regress Chinese/control edge cases |

Classic zMUD (and successors like cMUD) gave power users triggers, aliases, variables, buttons, and automapper. **All MUD game traffic is TCP (Telnet framing)** — that does not change. Revival World is a long-running Chinese LPMud (`mud.revivalworld.org:4000/5000/6000`); **RW is the deep-support benchmark**, not the only host.

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

Product language: **“TCP to the MUD” is non-negotiable.** WebSocket/WebTransport is only the browser-side carriage of that TCP byte stream.

### Encryption model (honest)

| Hop | Requirement |
|-----|-------------|
| User device → web app / API | **HTTPS only** in production |
| Browser → session bridge | **WSS (TLS)** on any non-loopback deployment |
| Bridge → MUD host | TCP (often cleartext telnet); use **TLS/telnets when the MUD offers it**; never log passwords |
| Hosted multi-tenant relay | Auth + allowlist/rate-limit + **anti open-relay**; prefer user-run local proxy for maximum trust |

Prior art: RW Java applet client + telnet. We replace that with a modern multi-MUD client that still speaks each mud’s real TCP/Telnet wire (RW: Big5 + full VT).

## 1. Problem

Players need a **modern web client** that:

1. Works on **PC and phone** without installing classic Windows zMUD.
2. Connects to **各家 MUD** (configurable host/port/charset), with **RW-class fidelity** when the mud needs it.
3. Keeps the **public path encrypted** and refuses to become an open TCP proxy for the internet.
4. Supports zMUD-depth automation (triggers / aliases / variables / scripts).
5. Is secure by default (MUD output untrusted; scripts sandboxed).

## 2. OKR / KRs

**Objective**: From phone or desktop browser, securely play MUDs (starting with daily-playable RW, then any user-configured mud).

**Key Results**:
- KR0 — **North-star demo**: mobile + desktop browsers reach a MUD over **HTTPS/WSS**, session usable 30+ min.
- KR1 — Connect + login to **RW** without garbled text; map_d control plane works (see VT research).
- KR2 — Connect to **≥1 non-RW MUD** via same UI (proves multi-mud path; charset selectable).
- KR3 — Trigger/alias/variable engine covers the user’s top 10 automation cases (list frozen with user).
- KR4 — Security: TLS in prod config; open-relay tests red; XSS corpus green; no credentials in git.
- KR5 — Docs tracking (`docs/plans` + `docs/projects` + INDEX) stays current for every L-size phase.

## 2.5 Global Constraints (copied verbatim into every dispatch)

- **Product north star**: PC + mobile web → encrypted public path → play **any** configured MUD; RW is the fidelity benchmark.
- Target MUD primary (depth): `mud.revivalworld.org` ports `4000|5000|6000`; architecture must not hard-code a single host.
- **Wire to the game host is always raw TCP + Telnet IAC** (never “HTTP-only MUD”).
- Browser UI may use WebSocket/WebTransport only as a **byte-pipe carriage** into a component that holds the real TCP socket (proxy or native shell). Do not pretend the MUD protocol is JSON-RPC.
- Production public endpoints: **HTTPS + WSS only**. Cleartext `ws://` allowed only on localhost dev.
- Hosted relay (if any) must be **authenticated / allowlisted / rate-limited** and fail closed against open-relay abuse.
- Default session charset for RW: **Big5** (GB switch is secondary). Do not assume UTF-8 on the wire.
- Stream pipeline is **byte-first**: IAC → (optional MCCP2 inflate) → Big5/DBCS tokenizer → **full control parser** → screen cells → render. Never `bytes.toString('utf8')` on RW traffic.
- Support Telnet option negotiation at least for: TTYPE, NAWS; optionally MCCP2, MSSP, MXP (MXP must be sanitized — XSS).
- **Complete ANSI/VT control plane is mandatory** (not SGR-only). RWlib `map_d` / city&area `show_map` / `title_screen` emit absolute cursor addressing, save/restore cursor, erase display, and scroll-region freeze. See `docs/research/rw-ansi-and-map-controls.md`. Client must maintain a real screen buffer.
- Minimum must-implement CSI/C0 for RW gate: `CSI s/u` (save/restore), `CSI H` / `CSI r;cH` (CUP), `CSI 2J` (ED), `CSI r` / `CSI t;br` (DECSTBM), full SGR (incl. bold/dim/reverse/underline/blink/fg/bg), BEL/BS/HT/LF/CR, Big5 DBCS with mid-stream SGR (雙色 / `ansi_part` map cells).
- **雙色字 / DBCS mid-glyph attributes** and map tile SGR carry (`ansi_part`) are first-class; strip-non-color CSI is a **ship blocker**.
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
| `packages/terminal/` | Screen buffer + VT control + Big5/DBCS cellizer + dual-color + scrollback + render |
| `packages/vt/` (or inside terminal) | CSI/C0 state machine: CUP, ED/EL, DECSTBM, save/restore, SGR |
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
- Terminal MVP: **Big5** + **screen buffer** + SGR + CUP + save/restore + ED + scroll region (the map_d minimum set).
- Fixtures: live banner + **synthetic city map frame** from RWlib sequence template (`docs/research/rw-ansi-and-map-controls.md`).
- Manual: connect to RW, see banner without mojibake; after login (human), `look` map must redraw in-place (not dump garbage scroll).
- **Acceptance**: KR1; Big5 banner golden; **synthetic map frame golden** (cursor restore leaves prompt region intact); open-relay refused; “SGR-only client” regression test documents failure mode we refuse to ship.

### Phase 2 — Core automation engine (Size: L)
- Aliases, triggers (regex + simple), variables, send queues.
- Persist packages locally (IndexedDB); import/export JSON.
- Sandbox constraints for any user JS (if allowed).
- **Acceptance**: top automation cases from KR2 green; malicious script package cannot read cookies/local secrets in tests.

### Phase 3 — RW deep support pack (Size: L)
- Login/captcha UX helpers (human-in-the-loop; no captcha bypass).
- **雙色字** + mid-DBCS SGR + `ansi_part`-style cell paint fixtures; GB/BIG5 switch at login.
- Live capture: city map + area map + title_screen freeze/unfreeze vs zMUD reference.
- Expand VT coverage beyond minimum if live probe shows more (EL, relative cursor, DECDHL/DECDWL).
- Optional MCCP2; careful MXP (off by default until sanitizer green).
- Common RW triggers pack (HP/bar, combat, channel highlights) — user-validated.
- Optional: link-out to RW online who / 2D map.
- **Acceptance**: daily-play checklist (incl. **walk city map without scroll thrash**) signed off on live RW; dual-color + map control goldens green.

### Phase 4 — Multi-MUD + mobile hardening (Size: L)
- Connection profiles: host/port/charset/TLS-to-mud flag; import/export.
- Responsive UI + mobile keyboard / touch send; optional PWA shell.
- Hosted or self-host deploy recipe with **TLS** (Caddy/nginx or platform).
- Second-mud smoke (UTF-8 English mud + RW Big5) on same build.
- **Acceptance**: KR0 + KR2; Lighthouse/mobile usable checklist; deploy doc with WSS.

### Phase 5 — Power features parity slice (Size: L, optional split)
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
| Map redraw broken | SGR-only / line-mode terminal | full CSI CUP+save/restore+ED+scroll region; screen buffer; synthetic map golden |
| Scroll thrash on move | treat map as append-only log | respect `\e[s`…`\e[u]` overlay model |
| MCCP2 corruption | inflate wrong stream | negotiate only after WILL/DO; zlib tests |
| MXP XSS | render MXP as HTML | default off; sanitizer; security review |
| Proxy becomes open relay | no origin/auth checks | default bind localhost; origin allowlist |
| XSS via MUD output | `innerHTML` raw | pure text/ANSI pipeline + tests |
| Scope explosion (full zMUD clone) | build everything before connect works | Phase 1 MVP gate |
| Captcha / ToS | automate captcha | human-in-the-loop only |
| Script sandbox escape | eval user JS in page context | isolate or restrict to declarative triggers first |

## 7. Out of scope (v1)

- Full cMUD/zMUD binary package format 100% compatibility
- **Public unauthenticated open proxy** (anyone → any TCP host) — security red line
- Guaranteeing end-to-end TLS when the **target MUD only speaks cleartext telnet** (we encrypt user↔us; mud hop is best-effort / optional TLS)
- 3D RW client (`rw3d`) integration
- Server-side botting / unattended farming
- Native App Store clients (mobile **browser / PWA** is in scope; Swift/Kotlin apps are not v1)

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
- R2 2026-07-21 — RWlib/Undine audit: map_d/city/area/title_screen require full VT control plane; elevated to Global Constraint + Phase 1 gate
- R3 2026-07-21 — Board north star: PC+mobile web, encrypted public path, multi-MUD; RW remains depth benchmark; KR0/KR2/Phase 4 added
