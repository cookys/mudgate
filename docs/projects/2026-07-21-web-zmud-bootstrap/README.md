# Web zMUD — bootstrap & tracking

> **Status**: In progress · **Size**: L · **Branch**: `main`  
> **Started**: 2026-07-21 · **Plan**: [2026-07-21-web-zmud-rw](../../plans/2026-07-21-web-zmud-rw.md)

## OKR

**Objective**: Establish project tracking + product frame for a modern web zMUD client deep-tuned for Revival World MUD.

**Key Results**:
- KR1 — Autopilot onboard complete (`.claude/*-config.md`, gitignore runtime block).
- KR2 — `docs/plans/` + `docs/projects/` + INDEX + BACKLOG exist and are the SSOT for `/next`.
- KR3 — Seed plan captures RW connection facts and phased roadmap (draft until Board open questions answered).

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

## Phases

| Phase | Status | Notes |
|-------|--------|-------|
| P0 — Onboard + docs framework | ✅ done | this project dir + configs |
| P0b — Product/architecture design | pending | close plan open questions; ADR stack |
| P1 — Connect + terminal MVP | pending | blocked on P0b |
| P2 — Automation engine | pending | |
| P3 — RW deep support pack | pending | |
| P4 — Power features slice | pending | optional |

## Success criteria

- [x] `.claude/` configs scaffolded and judgment-enriched for web MUD domain
- [x] `docs/projects/INDEX.md` tracks this project
- [x] Seed plan in `docs/plans/` with phases + constraints
- [ ] User answers plan §8 open questions
- [ ] Stack ADR accepted → start Phase 1 scaffold

## Next actions

1. Answer plan open questions (stack, proxy model, existing scripts, encoding, top-10 automations).
2. Optional: short survey of web MUD clients + xterm.js vs custom render.
3. Run Phase 0 design → approve plan `status: approved` → implement Phase 1.

## Learnings

- Repo was empty greenfield: detector reported `package_manager: unknown`, no test/build commands yet. Re-run `project-detect.js` + update configs after stack scaffold.
- **RW is still BIG5 on the wire** (2026-07-21 probe). UTF-8-first clients will mojibake the entire banner.
- “走 TCP” is correct for MudOS; browser still needs a TCP-owning hop (proxy/native). Do not reframe the product as non-TCP.
- Dual-color (雙色字) needs DBCS-aware cellization; stock xterm.js alone is a risky default.
- `assmud` ⇒ WASM is a branding/perf escape hatch, not day-1 mandate.
