# ADR-002 — Multi-surface networking: remote authenticated proxy

- **Date**: 2026-07-21
- **Status**: accepted (R6 reframes “mobile-first” → **desktop + mobile both in scope**)
- **Plan**: [2026-07-21-web-zmud-rw](../plans/2026-07-21-web-zmud-rw.md) R6
- **Supersedes wording in**: former “mobile-first” title (same decision, clearer product language)

## Context

Board wants a web client usable on **desktop and phone**. Browsers cannot open arbitrary TCP to MUD ports; in-page WASM does not unlock TCP either. A **localhost-only** proxy is fine for developers on a laptop, but does not cover:

- phone browser (no companion proxy app expected),
- desktop browser away from a home machine.

Classic MUDs are **hard on small touch screens** (dense ANSI maps, heavy typing, dual-color / VT overlays). We still **design for both surfaces**, without pretending phone UX will match a 32" desktop by default.

## Decision

| Concern | Choice |
|---------|--------|
| **Surfaces** | **Desktop and mobile are both first-class** targets (responsive web / optional PWA) |
| **Networking product path** | **Remote** WSS↔TCP proxy (official and/or self-host) with **login** when exposed beyond localhost |
| **Dev path** | Localhost proxy on the developer machine (same protocol, different config) |
| **Desktop advanced** | Optional “local bridge” — power users / max privacy; not required for core journeys |
| **Phone UX honesty** | Support connect + play; invest in usable input/chrome; accept that **map_d / power scripting** may remain better on desktop until proven otherwise |
| **Official security** | Auth, allowlist (v1), SSRF blocks, Origin check on WSS, quotas, metadata audit — [threat model](../security/hosted-proxy-threat-model.md) |
| **Session (v1)** | httpOnly Secure SameSite=Strict cookie (or equivalent ticket on first WS frame); ≥30 min sessions with refresh/revoke |
| **WASM role** | Compute only — **not** networking |

## Consequences

- Phase 1a still builds **auth-capable remote proxy + WSS** early (needed for phone *and* remote desktop), with localhost as a config profile — not “phone-only roadmap.”
- UX work is dual-track: **desktop density** (full VT/map, keyboard) and **mobile adequacy** (readable terminal, touch send, avoid requiring a second app).
- Success metrics should not be only “phone-first KPIs”; include desktop daily-play (especially RW map) and phone connect/smoke.
- Docs avoid “mobile-first” branding that understates desktop as the natural home of heavy MUD use.

## Alternatives rejected

| Alternative | Why not |
|-------------|---------|
| Localhost-only product | Breaks phone and remote desktop |
| Phone-only / mobile-first identity | Misrepresents Board intent and MUD realities |
| Require proxy app on phone | Bad UX; not “open a URL” |
| Browser/WASM raw TCP | Not available on the standard web |
| Unauthenticated public proxy | Open-relay risk |
