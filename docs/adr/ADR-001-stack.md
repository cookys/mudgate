# ADR-001 — UI stack, styling, and pluggable hot-path backends

- **Date**: 2026-07-21
- **Status**: accepted
- **Plan**: [2026-07-21-web-zmud-rw](../plans/2026-07-21-web-zmud-rw.md) R6  
- **Related**: [ADR-002 remote auth proxy](ADR-002-remote-auth-proxy.md)

## Context

We need a web client (PC + mobile) with zMUD-class power features, RW-depth terminal fidelity (Big5 + full VT/map_d), and room to adopt **WebAssembly** / **WebGPU** later without rewriting the app. Board prioritizes performance of the real hot path, maintainability, and testability over human framework familiarity (AI implements).

## Decision

| Layer | Choice |
|-------|--------|
| UI framework | **React** + **Vite** + **TypeScript** |
| Styling | **Tailwind CSS** (utility-first); **no heavy UI kit** in v1 (no MUI/Ant/Vuetify) |
| App shell state | React local state; **Zustand** only if cross-view state gets noisy |
| Terminal core | **Framework-free** packages (`packages/terminal`, `vt`, `protocol`, `codec-big5`) |
| Terminal host in React | Thin `<TerminalHost />`: canvas/container ref, size, focus, input routing |
| Default renderer | **Canvas2D** |
| Optional renderer | **WebGPU** behind `Renderer` interface + feature detect; fallback Canvas2D |
| Optional compute | **WASM** behind `Codec` / matcher interfaces; **hot path only** after profiling |
| Forbidden | Per-cell React components; init GPU/WASM inside React render; WASM touching DOM |

## Consequences

- Hot path performance is independent of React vs Vue; React wins on ecosystem density for thin UI tests and monorepo examples.
- WebGPU/WASM can land as drop-in package backends without migrating the SPA.
- Styling stays light; terminal chrome is custom dark/CRT-friendly, not a design-system clone.
- Must keep package boundaries strict so vitest covers protocol/VT without mounting React.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Vue 3 | Equal runtime for our architecture; slightly thinner Testing Library / example density |
| xterm.js as sole terminal | Unicode-first; weak fit for Big5 dual-color + map_d absolute addressing without heavy adapters |
| Heavy UI kit day-1 | Bundle + aesthetics mismatch; terminal is not form-admin UI |
| WASM/WebGPU day-1 everywhere | Slows MVP; no measured hotspot yet |
