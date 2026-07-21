# Plan — Web zMUD client (secure multi-MUD; deep support for Revival World)

> **Status**: draft (R7 post–hetero review fold; ready for Board approve)  
> **Owner**: cookys  
> **Branch**: `main` (bootstrap); feature work on `feat/*` after Phase 0' close  
> **North star (Board)**: **電腦與手機**都能用網頁，在 **加密安全** 條件下連上 **各家 MUD** 遊玩（兩表面都要考慮；不假裝 MUD 天生適合手機）。  
> **Depth benchmark**: [重生的世界 / Revival World](https://www.revivalworld.org)（Big5 + 完整 VT/map_d）。  
> **Stack**: [ADR-001](../adr/ADR-001-stack.md) — React + Vite + TS + Tailwind; pluggable Canvas2D/WebGPU + WASM (compute only).  
> **Networking**: [ADR-002](../adr/ADR-002-remote-auth-proxy.md) — remote authenticated WSS↔TCP proxy for remote/phone access; localhost = dev.

## 0. Context / thesis

### Product goal (final)

| Dimension | Target |
|-----------|--------|
| Surfaces | **Desktop + mobile** browsers (same app; optional PWA) — **both first-class** |
| Reach | Configured MUDs via **official/self-host proxy** (allowlist first; custom later) |
| Power | zMUD-class: terminal fidelity, triggers, aliases, variables, packages |
| Security | **WSS + login** on remote/public proxy; allowlist/quotas/audit; no open-relay |
| Depth | RW fidelity ceiling (map_d / Big5) — expect **best on desktop** |
| Mobile honesty | Phone: connect + play + decent chrome; dense map/scripting harder — improve if we can, **don’t over-claim** |
| Non-goal UX | Require a **proxy app on the phone** |

Classic zMUD (and successors like cMUD) gave power users triggers, aliases, variables, buttons, and automapper. **All MUD game traffic is TCP (Telnet framing)** — that does not change. Revival World is a long-running Chinese LPMud (`mud.revivalworld.org:4000/5000/6000`); **RW is the deep-support benchmark**, not the only host.

**2026-07-21 live probe** ([research](../research/rw-probe-2026-07-21.md)) confirmed:

- TCP ports 4000/5000/6000 open; banner ~2KB + Telnet IAC.
- Server advertises: **TTYPE, NAWS, MCCP2, MXP, MSSP**.
- Charset: **Traditional Chinese BIG5** (server prints `Current charset is Traditional Chinese (BIG5)`; also accepts `GB`/`BIG5` switch).
- Payload is **not UTF-8**; decode path must be Big5-aware **before** Unicode UI.

**Browser constraint (not a product choice):** pure web pages (and in-page **WASM**) cannot open arbitrary TCP sockets.

| Mode | Path | Role |
|------|------|------|
| **A. Remote authenticated proxy** | Browser ⇄ **WSS+login** ⇄ proxy ⇄ **TCP → MUD** | Product path for phone **and** remote desktop |
| **B. Dev localhost proxy** | Browser ⇄ WS ⇄ `127.0.0.1` proxy ⇄ TCP | Developers / same-machine desktop |
| **C. Desktop native shell** | App process raw TCP | Optional later |

Product language: **TCP to the MUD is non-negotiable**; **WSS+auth proxy is how a browser reaches TCP without a phone-side daemon**. WASM is **compute-only**, not a TCP tunnel.

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

**Objective**: From **desktop or phone** browser, securely play MUDs (daily-playable RW on desktop-class fidelity; phone usable; then multi-mud).

**Key Results**:
- KR0 — **Multi-surface connect**: desktop **and** phone browsers reach a MUD over **HTTPS/WSS + logged-in remote proxy** (or dev localhost), 30+ min session — phone needs **no** on-device proxy app.
- KR1 — **Desktop-class RW**: login without garbled text; map_d control plane works (VT research).
- KR2 — Connect to **≥1 non-RW allowlisted MUD** via same UI (charset selectable).
- KR3 — Declarative automation: **generic top-10 client capabilities** (see §8); personal zMUD imports optional.
- KR4 — Security: WSS+auth on public proxy; allowlist/SSRF/quota green; open-relay red; XSS green; metadata audit only.
- KR5 — Docs tracking stays current for every L-size phase.
- KR6 — **Mobile adequacy** (honest bar): readable terminal, send input, reconnect; not required to match desktop map power-user flow on day-1.

## 2.5 Global Constraints (copied verbatim into every dispatch)

- **Product north star (multi-surface)**: desktop **and** phone browsers → **HTTPS/WSS + authenticated remote proxy** (when not using dev localhost) → TCP MUD. No on-phone proxy app required. RW is the fidelity benchmark; **desktop is the natural power-user home**.
- Target MUD primary (depth): `mud.revivalworld.org` ports `4000|5000|6000`; architecture must not hard-code a single host in libraries (config/allowlist instead).
- **Wire to the game host is always raw TCP + Telnet IAC** (never “HTTP-only MUD”).
- Browser/WASM never open raw TCP. Browser uses WSS only as a **byte-pipe** into a **proxy process** that holds TCP.
- Production public endpoints: **HTTPS + WSS only**. Cleartext `ws://` only on localhost **dev**.
- **Official/self-host prod proxy**: login required; destination **allowlist** (v1); SSRF blocks; **WSS Origin allowlist**; per-user quotas; metadata-only audit; kill-switch. Session: httpOnly Secure SameSite=Strict cookie (or equivalent WS ticket). See ADR-002 + threat model.
- **Localhost proxy**: developer / same-machine convenience; same protocol, different config; **still block private/metadata IPs** (dev may relax public allowlist only).
- Default session charset for RW: **Big5-HKSCS superset** decode (wire still “BIG5” family; GB switch secondary). Do not assume UTF-8 on the wire.
- Stream pipeline is **byte-first**: IAC → (optional MCCP2 inflate) → Big5/DBCS tokenizer → **full control parser** → screen cells → render. Never `bytes.toString('utf8')` on RW traffic.
- Support Telnet option negotiation at least for: TTYPE, NAWS. **Phase 1a MUST reply `DONT MCCP2`** (and refuse options not yet implemented). Optional **DO MCCP2 + inflate** only from Phase 3+. MSSP optional; MXP off until sanitizer green.
- **Complete ANSI/VT control plane is mandatory for the RW ship gate (Phase 1b+)** (not SGR-only). Phase **1a** is intentionally partial (Big5 + SGR + scrollback + connect). Phase **1b** delivers CUP/save-restore/ED/DECSTBM screen buffer. See research.
- Minimum must-implement CSI/C0 for RW gate: `CSI s/u` (save/restore), `CSI H` / `CSI r;cH` (CUP), `CSI 2J` (ED), `CSI r` / `CSI t;br` (DECSTBM), full SGR (incl. bold/dim/reverse/underline/blink/fg/bg), BEL/BS/HT/LF/CR, Big5 DBCS with mid-stream SGR (雙色 / `ansi_part` map cells).
- **雙色字 / DBCS mid-glyph attributes** and map tile SGR carry (`ansi_part`) are first-class; strip-non-color CSI is a **ship blocker**.
- MUD server output is **untrusted**; terminal render path must not inject raw HTML from MXP/ANSI without a sanitizer.
- No player passwords, session tokens, or captcha solutions committed to git.
- Traditional Chinese UI first; English secondary.
- **UI stack (locked)**: **React + Vite + TypeScript** shell; **Tailwind** for chrome; **no heavy UI kit** v1. See [ADR-001](../adr/ADR-001-stack.md).
- **Terminal is framework-free**: React only mounts a thin host (`<TerminalHost />`). **Forbidden**: one React node per map/terminal cell; GPU/WASM init inside React render.
- **Renderer plug-in**: default **Canvas2D**; optional **WebGPU** behind `Renderer` interface with feature detect + Canvas2D fallback. Paint loop lives in `packages/terminal` (rAF), not React state-per-frame.
- **Compute plug-in**: default **TypeScript** codecs/matchers; optional **WASM** behind stable interfaces (**hot path only**, after profiling). Repo name `assmud` is a WASM wink, not day-1 whole-client AssemblyScript.
- **Script engine v1**: **declarative** triggers/aliases/variables first; **no** arbitrary network/`fetch`, **no** reading cookies/`localStorage` secrets. User JS sandbox later/optional. Personal zMUD import optional.
- **Proxy product default**: **remote authenticated WSS↔TCP** (official or self-host). **Localhost bind** is dev/advanced only.
- **Reconnect**: client must survive WSS drop → re-auth/ticket → re-IAC negotiate; screen buffer retained client-side (Phase 1a acceptance).
- Autopilot tracking: every L-size phase updates `docs/projects/.../README.md` + `docs/projects/INDEX.md`.
- **Open-source hygiene**: no secrets, live credentialed captures, or unlicensed bulk third-party trees in git. Follow `docs/OPEN-SOURCE.md` + `SECURITY.md`. Local dumps only under gitignored `local/` / `private/` / `captures/`.

## 3. File-structure map (intended — after Phase 0')

| Path | Responsibility |
|------|----------------|
| `apps/web/` | React SPA: Tailwind chrome, profiles, thin `TerminalHost` |
| `apps/proxy/` | WSS↔TCP bridge; profiles `remote-prod` \| `localhost-dev`; allowlist/auth/Origin |
| `packages/terminal/` | Screen buffer, scrollback, `Renderer` (Canvas2D / WebGPU) |
| `packages/vt/` | CSI/C0 state machine: CUP, ED/EL, DECSTBM, save/restore, SGR |
| `packages/script-engine/` | declarative triggers / aliases / variables / timers (no secret exfil) |
| `packages/protocol/` | Telnet IAC, MCCP2 refuse-then-optional, MSSP/MXP hooks, reconnect |
| `packages/codec-big5/` | Big5-HKSCS-capable streaming codec (TS now; WASM later) |
| `packages/client-automap/` | optional client-side automap (later; not server map_d) |
| `docs/adr/` | architecture decision records |
| `docs/plans/` | executable plans |
| `docs/projects/` | L-size execution tracking + INDEX |
| `docs/research/` | RW fixtures notes, encoding notes (no secrets) |
| `tests/fixtures/streams/` | golden byte/text streams (anonymized) |

## 4. Phases

### Phase 0' — Close design gates (Size: S)
- ~~Stack pick~~ → **done (ADR-001)**.
- ~~Networking / mobile path~~ → **done (ADR-002 + threat model)**.
- ~~RW encoding / VT research~~ → **done** (`docs/research/*`).
- Remaining optional: personal top automations flavor; zMUD import samples.
- Keep architecture + ADRs in sync.
- **Acceptance**: plan ready for `status: approved` → Phase 1a.

### Phase 1a — Auth proxy + Big5 banner (Size: L)
- Scaffold monorepo + CI smoke + vitest.
- **Proxy** (one codebase, two configs):
  - **prod/staging**: public WSS, **auth required**, allowlist (include RW), SSRF/quota/**Origin** tests.
  - **dev**: localhost bind; auth optional; **still deny private IPs**.
- Telnet: TTYPE/NAWS; **`DONT MCCP2`** (and refuse unimplemented options).
- React shell + Tailwind + login/session + `TerminalHost` (narrow + wide viewports).
- Terminal (**partial**): Big5-HKSCS family + SGR + scrollback; Canvas2D; banner golden (uncompressed path).
- **Reconnect**: WSS drop → re-establish → re-IAC; buffer kept client-side.
- Manual: desktop (required) + phone smoke (desired) → RW banner without mojibake.
- **Acceptance**: KR0 connect path; banner golden; unauth denied; private-IP denied; bad Origin denied; reconnect smoke; no per-cell React rendering.
- **Explicit non-goal for 1a**: full map_d CSI set (that is 1b).

### Phase 1b — Screen buffer + map_d control plane (Size: L)
- Full minimum CSI set: save/restore, CUP, ED, DECSTBM, etc. (see research).
- Synthetic **city map frame** golden — **clean-room** from research control sequences (not vendored RWlib).
- Synthetic **dual-color / mid-DBCS SGR** cell fixture (hand-built bytes) so `ansi_part`-style path is unit-tested before live capture.
- Terminal XSS sanitizer tests (adversarial SGR/MXP-like strings) bound here or shared with 1a if render ships early.
- Human (optional same milestone): after login, `look` map redraws in-place (no scroll thrash).
- **Acceptance**: synthetic map + dual-color goldens; “SGR-only client” refuse-to-ship; KR1 path ready pending live login.

### Phase 2 — Core automation engine (Size: L)
- Declarative aliases, triggers (regex + simple), variables, send queues.
- Persist packages locally (IndexedDB); import/export JSON.
- **No arbitrary user JS**; packages cannot read cookies / secret storage / arbitrary fetch.
- **Acceptance**: KR3 top-10 green; exfil negative tests green.

### Phase 3 — RW deep support pack (Size: L)
- Login/captcha UX helpers (human-in-the-loop; no captcha bypass).
- Live dual-color / map / title_screen captures (redacted); GB/BIG5 switch at login.
- Expand VT if live probe shows more (EL, relative cursor, DECDHL/DECDWL).
- Optional **DO MCCP2 + inflate**; MXP off until sanitizer green.
- Common RW triggers pack (user-validated).
- Optional: link-out to RW online who / 2D map.
- **Acceptance**: daily-play checklist (walk city map without scroll thrash) on live RW.

### Phase 4 — Multi-MUD + mobile polish (Size: L)
- Connection profiles within allowlist / approved custom; charset; TLS-to-mud flag.
- Mobile keyboard / touch send; PWA installability.
- Deploy recipe for **official/self-host** (TLS, secrets, allowlist ops).
- Second-mud smoke (UTF-8 mud + RW Big5).
- **Acceptance**: KR0 hardened + KR2; mobile checklist; runbook for bans/quotas.

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
| 1 | UI stack | **Resolved**: React + Vite + TS + Tailwind. [ADR-001](../adr/ADR-001-stack.md) |
| 2 | Carriage / surfaces | **Resolved (R6)**: remote auth proxy for remote/phone access; localhost = dev; desktop + phone both in scope; MUD-on-phone hard — honest KR6. [ADR-002](../adr/ADR-002-remote-auth-proxy.md). |
| 3 | zMUD scripts / dual-color logs | **Non-blocking**: use public patterns + synthetic/RWlib-derived fixtures; personal imports optional |
| 4 | Encoding | **Resolved**: BIG5 on wire |
| 5 | Top 10 automations (KR3) | **Resolved as generic client capabilities** (below); personal RW flavor packs later |
| 6 | WASM | **Resolved**: compute hot path only; **not** TCP |
| 7 | WebGPU | **Resolved**: optional renderer; Canvas2D default |

### KR3 — generic top-10 automation capabilities (v1)

1. Alias expand (short → command string)  
2. Regex trigger → send command  
3. Regex trigger → highlight line  
4. Variable capture from trigger + substitute in alias  
5. Gag / suppress matching lines  
6. Simple multi-command send queue (`a;b;c`)  
7. Package enable/disable  
8. Import/export package JSON  
9. Persist packages in IndexedDB  
10. Basic cooldown / rate-limit on a trigger (anti-spam)

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
- R5 2026-07-21 — Remote authenticated proxy as product path for remote access; localhost demoted to dev; ADR-002 + threat model; WASM not TCP; generic KR3 top-10
- R6 2026-07-21 — Board correction: **not** mobile-first branding; **desktop + mobile both first-class**; honest MUD-on-phone limits (KR6); rename ADR-002 to remote-auth-proxy
- R7 2026-07-21 — Hetero plan review (MiniMax-M3 FIX-THEN-SHIP, GLM-5.2 SHIP empty, Qwen3.8-Max-Preview FIX-THEN-SHIP): fold auth/Origin/MCCP DONT/HKSCS/dual-color 1b/reconnect/clean-room fixtures/XSS phase bind
