# Plan — Web zMUD client (secure multi-MUD; deep support for Revival World)

> **Status**: draft (R5 mobile-first; stack + networking locked; remaining §8 optional)  
> **Owner**: cookys  
> **Branch**: `main` (bootstrap); feature work on `feat/*` after Phase 0' close  
> **North star (Board)**: **手機優先**（及電腦）透過網頁，在 **加密安全** 條件下連上 **各家 MUD** 遊玩。  
> **Depth benchmark**: [重生的世界 / Revival World](https://www.revivalworld.org)（Big5 + 完整 VT/map_d）。  
> **Stack**: [ADR-001](../adr/ADR-001-stack.md) — React + Vite + TS + Tailwind; pluggable Canvas2D/WebGPU + WASM (compute only).  
> **Networking**: [ADR-002](../adr/ADR-002-mobile-first-proxy.md) — **remote authenticated WSS↔TCP proxy** is the product path; localhost is dev only.

## 0. Context / thesis

### Product goal (final)

| Dimension | Target |
|-----------|--------|
| Surfaces | **Mobile browser/PWA first**, desktop same app |
| Reach | Configured MUDs via **official/self-host proxy** (allowlist first; custom later) |
| Power | zMUD-class: terminal fidelity, triggers, aliases, variables, packages |
| Security | **WSS + login** on proxy; allowlist/quotas/audit; no open-relay; untrusted MUD output |
| Depth | RW first as the fidelity ceiling so “各家 mud” don’t regress Chinese/control edge cases |
| Non-goal UX | User must **not** run a proxy app on the phone |

Classic zMUD (and successors like cMUD) gave power users triggers, aliases, variables, buttons, and automapper. **All MUD game traffic is TCP (Telnet framing)** — that does not change. Revival World is a long-running Chinese LPMud (`mud.revivalworld.org:4000/5000/6000`); **RW is the deep-support benchmark**, not the only host.

**2026-07-21 live probe** ([research](../research/rw-probe-2026-07-21.md)) confirmed:

- TCP ports 4000/5000/6000 open; banner ~2KB + Telnet IAC.
- Server advertises: **TTYPE, NAWS, MCCP2, MXP, MSSP**.
- Charset: **Traditional Chinese BIG5** (server prints `Current charset is Traditional Chinese (BIG5)`; also accepts `GB`/`BIG5` switch).
- Payload is **not UTF-8**; decode path must be Big5-aware **before** Unicode UI.

**Browser constraint (not a product choice):** pure web pages (and in-page **WASM**) cannot open arbitrary TCP sockets.

| Mode | Path | Role |
|------|------|------|
| **A. Remote authenticated proxy** | Browser ⇄ **WSS+login** ⇄ proxy ⇄ **TCP → MUD** | **Product default (mobile + desktop)** |
| **B. Dev localhost proxy** | Browser ⇄ WS ⇄ `127.0.0.1` proxy ⇄ TCP | Developers only |
| **C. Desktop native shell** | App process raw TCP | Optional later — not required for phone |

Product language: **TCP to the MUD is non-negotiable**; **WSS+auth proxy is how phones play**. WASM is **compute-only**, not a TCP tunnel.

### Encryption & trust model (honest)

| Hop | Requirement |
|-----|-------------|
| User device → web app / API | **HTTPS only** in production |
| Browser → proxy | **WSS (TLS)**; **login required** on official/self-host prod |
| Proxy → MUD host | TCP (often cleartext telnet); TLS-to-MUD when offered; **never log passwords/payloads** by default |
| Official multi-tenant | Auth + **allowlist** + quotas + metadata audit — see [threat model](../security/hosted-proxy-threat-model.md) |
| Highest secrecy optional | User self-hosts proxy or future local bridge so mud hop never touches official IP |

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
- KR0 — **Phone north-star**: mobile browser reaches RW (or mock) over **HTTPS/WSS + logged-in proxy**, session usable 30+ min — **without** any proxy app on the phone.
- KR1 — Connect + login to **RW** without garbled text; map_d control plane works (see VT research).
- KR2 — Connect to **≥1 non-RW allowlisted MUD** via same UI (charset selectable).
- KR3 — Declarative automation: fixed **generic top-10 client capabilities** (alias/trigger/highlight/… — see §8); personal zMUD imports optional later.
- KR4 — Security: WSS+auth; allowlist/SSRF/quota tests green; open-relay red; XSS corpus green; metadata audit only; no secrets in git.
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
- **UI stack (locked)**: **React + Vite + TypeScript** shell; **Tailwind** for chrome; **no heavy UI kit** v1. See [ADR-001](../adr/ADR-001-stack.md).
- **Terminal is framework-free**: React only mounts a thin host (`<TerminalHost />`). **Forbidden**: one React node per map/terminal cell; GPU/WASM init inside React render.
- **Renderer plug-in**: default **Canvas2D**; optional **WebGPU** behind `Renderer` interface with feature detect + Canvas2D fallback. Paint loop lives in `packages/terminal` (rAF), not React state-per-frame.
- **Compute plug-in**: default **TypeScript** codecs/matchers; optional **WASM** behind stable interfaces (**hot path only**, after profiling). Repo name `assmud` is a WASM wink, not day-1 whole-client AssemblyScript.
- **Script engine v1**: **declarative** triggers/aliases/variables first; arbitrary user JS sandbox is later/optional (not Phase 2 blocker).
- **Proxy default**: local sidecar bind **127.0.0.1**; hosted/multi-tenant relay is opt-in and fail-closed (auth/allowlist). Phone/remote play uses self-host or hosted **WSS**, not open TCP from the browser.
- Autopilot tracking: every L-size phase updates `docs/projects/.../README.md` + `docs/projects/INDEX.md`.
- **Open-source hygiene**: no secrets, live credentialed captures, or unlicensed bulk third-party trees in git. Follow `docs/OPEN-SOURCE.md` + `SECURITY.md`. Local dumps only under gitignored `local/` / `private/` / `captures/`.

## 3. File-structure map (intended — after Phase 0')

| Path | Responsibility |
|------|----------------|
| `apps/web/` | React SPA: Tailwind chrome, profiles, thin `TerminalHost` |
| `apps/proxy/` | WSS↔TCP bridge (localhost default; allowlist/auth hooks) |
| `packages/terminal/` | Screen buffer, scrollback, `Renderer` (Canvas2D / WebGPU) |
| `packages/vt/` | CSI/C0 state machine: CUP, ED/EL, DECSTBM, save/restore, SGR |
| `packages/script-engine/` | declarative triggers / aliases / variables / timers |
| `packages/protocol/` | Telnet IAC, MCCP2, MSSP/MXP hooks, reconnect |
| `packages/codec-big5/` | Big5/DBCS streaming codec (TS now; WASM later) |
| `packages/client-automap/` | optional client-side automap (later; not server map_d) |
| `docs/adr/` | architecture decision records |
| `docs/plans/` | executable plans |
| `docs/projects/` | L-size execution tracking + INDEX |
| `docs/research/` | RW fixtures notes, encoding notes (no secrets) |
| `tests/fixtures/streams/` | golden byte/text streams (anonymized) |

## 4. Phases

### Phase 0' — Close design gates (Size: S)
- ~~Stack pick~~ → **done (ADR-001)**.
- ~~RW encoding / VT research~~ → **done** (`docs/research/*`).
- Remaining: Board §8 items (carriage confirmation, top-10 automations, optional script fixtures); freeze v1 feature cut.
- Keep `docs/architecture.md` + ADR-001 in sync.
- **Acceptance**: remaining §8 either answered or explicitly BACKLOG'd; plan → `status: approved` for Phase 1a.

### Phase 1a — Connect path + Big5 banner (Size: L)
- Scaffold monorepo (pnpm/npm workspaces) + CI smoke + vitest.
- **TCP-owning** proxy: WSS↔TCP, bind localhost by default, origin checks, reconnect, idle; Telnet IAC (TTYPE/NAWS minimum).
- React shell + Tailwind layout + `TerminalHost` wiring.
- Terminal: Big5 decode + SGR + scrollback; Canvas2D renderer; banner fixture golden.
- Manual: connect to RW, see「重生的世界」without mojibake, type at name prompt.
- **Acceptance**: Big5 banner golden; open-relay refused on default config; `ws://` localhost dev documented; no per-cell React rendering.

### Phase 1b — Screen buffer + map_d control plane (Size: L)
- Full minimum CSI set: save/restore, CUP, ED, DECSTBM, etc. (see research).
- Synthetic **city map frame** golden from RWlib sequence template.
- Human (optional same milestone): after login, `look` map redraws in-place (no scroll thrash).
- **Acceptance**: synthetic map golden (cursor restore leaves prompt region); “SGR-only client” documented as refuse-to-ship; KR1 path ready pending live login.

### Phase 2 — Core automation engine (Size: L)
- Declarative aliases, triggers (regex + simple), variables, send queues.
- Persist packages locally (IndexedDB); import/export JSON.
- **No arbitrary user JS required for v1 acceptance.**
- **Acceptance**: top automation cases from **KR3** green (list frozen with Board); package cannot read cookies/local secrets in tests.

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
| Unit (primary) | `packages/*`: VT, codec, trigger matcher, sanitize — vitest |
| Integration | proxy framing, reconnect, mock TCP server |
| Golden streams | anonymized RW-like fixtures (never live passwords) |
| UI (thin) | React Testing Library on shell only — not cell grid |
| E2E | Playwright against mock Mud; optional manual live RW |
| Security | XSS corpus on terminal; open-relay tests on proxy |
| Human-gated | live RW captcha/login, map walk, feel of latency, package UX |
| Perf gate (later) | only then consider WASM/WebGPU swaps; measure first |

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
| Script sandbox escape | eval user JS in page context | v1 declarative only; JS sandbox later + isolate |
| React paint bottleneck | per-cell components / setState per frame | thin host + Canvas2D/WebGPU package loop |
| WebGPU unavailable | assume GPU everywhere | feature detect; Canvas2D fallback required |

## 7. Out of scope (v1)

- Full cMUD/zMUD binary package format 100% compatibility
- **Public unauthenticated open proxy** (anyone → any TCP host) — security red line
- Guaranteeing end-to-end TLS when the **target MUD only speaks cleartext telnet** (we encrypt user↔us; mud hop is best-effort / optional TLS)
- 3D RW client (`rw3d`) integration
- Server-side botting / unattended farming
- Native App Store clients (mobile **browser / PWA** is in scope; Swift/Kotlin apps are not v1)
- Heavy UI component libraries (MUI/Ant/etc.) as the design system
- Day-1 mandatory WebGPU or whole-app WASM (interfaces only; implement when measured)

## 8. Open questions (Board / user)

| # | Question | Status |
|---|----------|--------|
| 1 | UI stack | **Resolved (R4)**: React + Vite + TS + Tailwind; custom terminal buffer (not xterm-only). [ADR-001](../adr/ADR-001-stack.md) |
| 2 | Carriage mode first | **Default (R4)**: local WSS↔TCP proxy on localhost; hosted relay opt-in fail-closed. Confirm if Board wants Tauri raw TCP in v1 (not required). |
| 3 | Existing zMUD/Mudlet scripts + 雙色字 sample log? | **Open** — nice for fixtures; synthetic map frames can proceed without |
| 4 | Encoding | **Resolved**: wire BIG5; GB switch supported |
| 5 | Top 10 automations for **KR3** freeze? | **Open** — blocks Phase 2 acceptance list |
| 6 | WASM appetite | **Resolved (R4)**: hot path only, pluggable; not brand-mandated day-1 |
| 7 | WebGPU | **Resolved (R4)**: optional `Renderer` backend; Canvas2D default + fallback |

## 9. WASM + WebGPU note (`assmud`)

| Layer | Day-1 | Later |
|-------|-------|--------|
| TCP/Telnet I/O | OS / Node net | — |
| Big5 + cellizer | **TypeScript** | **WASM** if CPU-bound |
| VT / screen buffer | **TypeScript** | stay TS unless proven hot |
| Trigger matcher | **TypeScript** declarative | WASM if 1k+ rules/frame |
| MCCP2 zlib | pako / Node zlib | — |
| Paint | **Canvas2D** | **WebGPU** if paint-bound + `navigator.gpu` |
| React UI | DOM/Tailwind | never WASM/GPU for chrome |

**Rule:** stable byte-oriented APIs in `packages/*` so Rust/WASM or WebGPU backends swap without rewriting `apps/web`. Honor the name without blocking MVP.

## Review log

- R0 2026-07-21 — author: onboard bootstrap (draft)
- R1 2026-07-21 — live TCP probe: BIG5 + MCCP2/MXP/MSSP/TTYPE/NAWS; TCP-first wording; dual-color + WASM notes
- R2 2026-07-21 — RWlib/Undine audit: map_d/city/area/title_screen require full VT control plane; elevated to Global Constraint + Phase 1 gate
- R3 2026-07-21 — Board north star: PC+mobile web, encrypted public path, multi-MUD; RW remains depth benchmark; KR0/KR2/Phase 4 added
- R4 2026-07-21 — Stack lock: React+Vite+TS+Tailwind; ADR-001 + architecture sketch; pluggable Canvas2D/WebGPU + WASM hot paths; Phase 0' / 1a / 1b split; KR3 automation numbering fix; declarative scripts v1
