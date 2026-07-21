# Plan — Web zMUD client (deep support for Revival World)

> **Status**: draft  
> **Owner**: cookys  
> **Branch**: `main` (bootstrap); feature work on `feat/*` after stack pick  
> **Frame**: modern browser client that recreates zMUD-class power features, tuned first for [重生的世界 / Revival World](https://www.revivalworld.org)

## 0. Context / thesis

Classic zMUD (and successors like cMUD) gave power users triggers, aliases, variables, buttons, and automapper. Browsers + WebSockets can deliver the same loop without a Windows install. Revival World is a long-running Chinese LPMud (`mud.revivalworld.org:4000/5000/6000`) with its own encoding/ANSI/captcha/login quirks; **RW deep support is the product north star**, not a generic “any MUD” demo.

Prior art: RW already exposes a legacy Java web client (`http://java.revivalworld.org`) and telnet. This project replaces that mental model with a modern SPA + optional local/self-hosted WS↔TCP bridge.

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
- Browser never opens raw TCP; all game I/O goes through an explicit WS↔TCP proxy component.
- MUD server output is **untrusted**; terminal render path must HTML-escape / sanitize before DOM.
- No player passwords, session tokens, or captcha solutions committed to git.
- Traditional Chinese UI first; English secondary.
- Prefer TypeScript monorepo; stack final pick is Phase 0 (see open questions).
- Autopilot tracking: every L-size phase updates `docs/projects/.../README.md` + `docs/projects/INDEX.md`.

## 3. File-structure map (intended — after Phase 0)

| Path | Responsibility |
|------|----------------|
| `apps/web/` | SPA: terminal, settings, package manager UI |
| `apps/proxy/` (or `packages/proxy/`) | WS server bridging to MudOS TCP |
| `packages/terminal/` | ANSI parse, scrollback, selection, render |
| `packages/script-engine/` | triggers / aliases / variables / timers |
| `packages/protocol/` | line framing, encoding, reconnect policy |
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
- WS↔TCP proxy with origin checks; reconnect; idle handling.
- Terminal render: UTF-8 (and encoding strategy if RW needs conversion), ANSI colors, scrollback.
- Manual: connect to RW, see banner, type commands.
- **Acceptance**: KR1 path demonstrated; unit tests for ANSI + escape; proxy refuses open-relay.

### Phase 2 — Core automation engine (Size: L)
- Aliases, triggers (regex + simple), variables, send queues.
- Persist packages locally (IndexedDB); import/export JSON.
- Sandbox constraints for any user JS (if allowed).
- **Acceptance**: top automation cases from KR2 green; malicious script package cannot read cookies/local secrets in tests.

### Phase 3 — RW deep support pack (Size: L)
- Login/captcha UX helpers (human-in-the-loop; no captcha bypass).
- Common RW triggers pack (HP/bar, combat, channel highlights) — user-validated.
- Encoding edge cases, prompt detection, multi-line blocks.
- Optional: link-out to RW online who / 2D map.
- **Acceptance**: daily-play checklist signed off by user on live RW.

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
| Encoding mojibake | assume UTF-8 only | probe RW early; fixture real banners |
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

1. Preferred UI stack: React vs Svelte vs Solid? (recommend: **Vite + React + xterm.js** unless you prefer Svelte)
2. Proxy deployment: local-only sidecar first, or hosted multi-tenant later?
3. Do you have existing zMUD/Mudlet scripts to import as acceptance fixtures?
4. Primary encoding expectation on your client today (UTF-8 only, or still see Big5 paths)?
5. Must-have automation list (top 10) for KR2 freeze?

## Review log

- R0 2026-07-21 — author: onboard bootstrap (draft; awaiting Board answers before Phase 0 close)
