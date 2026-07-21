# Web zMUD — bootstrap & tracking

> **Status**: In progress · **Size**: L · **Branch**: `main`  
> **Started**: 2026-07-21 · **Plan**: [R6](../../plans/2026-07-21-web-zmud-rw.md)

## OKR

**Objective**: Tracking + product frame for a **secure multi-MUD web client** on **desktop and mobile** (remote auth proxy where needed), RW depth benchmark.

**Key Results**:
- [x] Autopilot onboard + docs INDEX
- [x] North star: desktop + phone both considered; no on-phone proxy app
- [x] ADR-001 stack (React/Tailwind/pluggable GPU/WASM compute)
- [x] ADR-002 remote auth proxy + threat model (not “mobile-first” branding)
- [x] Hetero plan review R1+R2 (MiniMax/GLM/Qwen) → R7 fold
- [ ] Board marks plan `status: approved` → Phase 1a scaffold

## Locked decisions

| Topic | Decision |
|-------|----------|
| Surfaces | Desktop + mobile, both first-class; MUD hard on phone — honest KR6 |
| UI | React + Vite + TS + Tailwind |
| Terminal | Framework-free packages; Canvas2D; WebGPU/WASM later (not TCP) |
| Networking | Remote WSS+auth for remote/phone; localhost = dev |
| Official security | Allowlist, SSRF deny, quotas, metadata audit |
| KR3 automation | Generic top-10 declarative capabilities |

## Phases

| Phase | Status |
|-------|--------|
| P0 onboard/docs/OSS | ✅ |
| P0' design (ADR-001/002) | ✅ |
| P1a auth proxy + Big5 banner | pending |
| P1b map_d VT buffer | pending |
| P2 declarative automation | pending |
| P3 RW deep support | pending |
| P4 multi-mud + mobile polish | pending |
| P5 power features | pending |

## Next

1. Hetero plan review (when Board green-lights engines) → fold → `status: approved`
2. Phase 1a monorepo + proxy auth + desktop + phone smoke

## Links

- [Plan R6](../../plans/2026-07-21-web-zmud-rw.md)
- [Architecture](../../architecture.md)
- [Threat model](../../security/hosted-proxy-threat-model.md)
- [RW probe](../../research/rw-probe-2026-07-21.md)
- [VT/map controls](../../research/rw-ansi-and-map-controls.md)
