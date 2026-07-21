# Web zMUD — bootstrap & tracking

> **Status**: In progress · **Size**: L · **Branch**: `main`  
> **Started**: 2026-07-21 · **Plan**: [2026-07-21-web-zmud-rw](../../plans/2026-07-21-web-zmud-rw.md) (R4)

## OKR

**Objective**: Establish tracking + product frame for a **secure multi-MUD web client** (PC + mobile), with RW as depth benchmark.

**Key Results**:
- KR1 — Autopilot onboard complete (`.claude/*-config.md`, gitignore runtime block).
- KR2 — `docs/plans/` + `docs/projects/` + INDEX + BACKLOG exist and are the SSOT for `/next`.
- KR3 — Seed plan captures RW facts, full VT gate, and north star: encrypted web path → 各家 mud.
- KR4 — Board north star recorded in README + plan R3.
- KR5 — Stack locked: React + Vite + TS + Tailwind; WebGPU/WASM pluggable ([ADR-001](../../adr/ADR-001-stack.md)).

## Target MUD (facts)

| Item | Value |
|------|--------|
| Site | https://www.revivalworld.org |
| MUD host | `mud.revivalworld.org` |
| Ports | `4000`, `5000`, `6000` (all TCP OK) |
| Wire | **TCP + Telnet IAC** — TTYPE, NAWS, MCCP2, MXP, MSSP |
| Charset | **BIG5** (server-stated); optional GB switch at login |
| Legacy web | http://java.revivalworld.org |
| Telnet | `telnet://mud.revivalworld.org:4000` |
| Lineage | LPMud / MudOS-family (**Undine 1.5** banner), RWlib v1.1.0 |
| Online tools | [who](https://www.revivalworld.org/rw/online/who), [2D map](https://www.revivalworld.org/online/rw/map.html) |
| Probe | [docs/research/rw-probe-2026-07-21.md](../../research/rw-probe-2026-07-21.md) |
| Controls | [docs/research/rw-ansi-and-map-controls.md](../../research/rw-ansi-and-map-controls.md) |

## Stack (locked R4)

| Layer | Choice |
|-------|--------|
| Shell | React + Vite + TypeScript + Tailwind |
| Terminal | Framework-free packages; Canvas2D default |
| Later | WebGPU renderer / WASM codec via interfaces |
| Proxy | Local WSS↔TCP (localhost default) |

## Phases

| Phase | Status | Notes |
|-------|--------|-------|
| P0 — Onboard + docs framework | ✅ done | configs + INDEX + OSS hygiene |
| P0' — Design gates | 🟡 partial | ADR-001 + architecture done; §8 #3/#5 still open |
| P1a — Connect + Big5 banner | pending | monorepo + proxy + shell |
| P1b — map_d VT screen buffer | pending | synthetic map golden |
| P2 — Declarative automation | pending | needs KR3 top-10 list |
| P3 — RW deep support | pending | live map / 雙色 |
| P4 — Multi-MUD + mobile + TLS deploy | pending | |
| P5 — Power features | pending | optional |

## Success criteria

- [x] `.claude/` configs scaffolded and judgment-enriched for web MUD domain
- [x] `docs/projects/INDEX.md` tracks this project
- [x] Seed plan in `docs/plans/` with phases + constraints
- [x] Stack ADR-001 accepted (React/Tailwind/pluggable GPU/WASM)
- [ ] Remaining §8: top-10 automations; optional script/雙色 fixtures
- [ ] Plan `status: approved` → start Phase 1a scaffold

## Next actions

1. Board: freeze top-10 automations (KR3) when ready; optional fixture logs.
2. Confirm carriage default (local proxy) — Tauri not required for v1.
3. Approve plan → Phase 1a monorepo scaffold.

## Learnings

- Repo was empty greenfield: detector reported `package_manager: unknown`, no test/build commands yet. Re-run `project-detect.js` + update configs after stack scaffold.
- **RW is still BIG5 on the wire** (2026-07-21 probe). UTF-8-first clients will mojibake the entire banner.
- “走 TCP” is correct for MudOS; browser still needs a TCP-owning hop (proxy/native).
- Dual-color + **full VT** are ship gates for RW map_d.
- React vs Vue runtime is a wash for this architecture; React chosen for maintain/test density. Hot path stays in packages → **WebGPU/WASM OK later**.
- **Final goal (Board)**: PC/phone browser → TLS public path → play any MUD; never ship open-relay.
