# ADR-002 — Mobile-first networking: remote authenticated proxy

- **Date**: 2026-07-21
- **Status**: accepted
- **Plan**: [2026-07-21-web-zmud-rw](../plans/2026-07-21-web-zmud-rw.md) R5

## Context

Board north star is **playing from a phone browser** (and desktop), securely. Browsers cannot open arbitrary TCP to MUD ports; WebAssembly does not grant TCP either. A **localhost-only** proxy forces a companion process on the device — unrealistic for iOS/Android “open a URL and play.”

## Decision

| Concern | Choice |
|---------|--------|
| **Product default path** | **Remote** WSS↔TCP proxy (official host and/or user self-host) with **login** |
| **Mobile UX** | Browser/PWA only — **no** requirement to run a proxy app on the phone |
| **Dev path** | Localhost proxy on the developer machine (same protocol, different config) |
| **Desktop advanced** | Optional “local bridge” setting; not required for core journeys |
| **Auth on official proxy** | Required; sessions attributable (`user_id`) |
| **Destinations (official v1)** | **Allowlist** of MUDs (RW first); custom hosts later via request/approve |
| **WASM role** | Compute acceleration only — **not** networking |

## Consequences

- Phase ordering prioritizes **deployable authenticated proxy + WSS** early enough that mobile smoke works, not “localhost MVP then phone later.”
- Security work (allowlist, SSRF guards, quotas, metadata audit) is on the **critical path**, not a polish phase.
- Open-source defaults stay fail-closed: sample compose must not ship as a public open relay.
- Threat model: [hosted-proxy-threat-model.md](../security/hosted-proxy-threat-model.md).

## Alternatives rejected

| Alternative | Why not for this product |
|-------------|---------------------------|
| Localhost-only as product default | Phones cannot use it without a second app |
| Tauri/Electron as sole path | Abandons “open web URL on phone” |
| Browser WASM direct TCP | Not available in standard web platform |
| Unauthenticated public proxy | Open-relay / abuse / legal risk |
