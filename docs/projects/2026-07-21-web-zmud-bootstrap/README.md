# Web zMUD — bootstrap & tracking

> **Status**: In progress · **Size**: L · **Branch**: `main`  
> **Started**: 2026-07-21 · **Plan**: [R5](../../plans/2026-07-21-web-zmud-rw.md)

## OKR

**Objective**: Tracking + product frame for a **mobile-first secure multi-MUD web client** (remote auth proxy), RW depth benchmark.

**Key Results**:
- [x] Autopilot onboard + docs INDEX
- [x] North star: phone browser, no on-phone proxy app
- [x] ADR-001 stack (React/Tailwind/pluggable GPU/WASM compute)
- [x] ADR-002 mobile-first remote proxy + threat model
- [ ] Plan approved → Phase 1a scaffold

## Locked decisions

| Topic | Decision |
|-------|----------|
| UI | React + Vite + TS + Tailwind |
| Terminal | Framework-free packages; Canvas2D; WebGPU/WASM later (not TCP) |
| Networking | **Remote WSS+auth proxy** product path; localhost = dev |
| Official security | Allowlist, SSRF deny, quotas, metadata audit |
| KR3 automation | Generic top-10 declarative capabilities (plan §8) |

## Phases

| Phase | Status |
|-------|--------|
| P0 onboard/docs/OSS | ✅ |
| P0' design (ADR-001/002) | ✅ |
| P1a auth proxy + Big5 banner (**mobile-critical**) | pending |
| P1b map_d VT buffer | pending |
| P2 declarative automation | pending |
| P3 RW deep support | pending |
| P4 multi-mud + mobile polish | pending |
| P5 power features | pending |

## Next

1. Hetero plan review → fold → `status: approved`
2. Phase 1a monorepo + proxy auth + phone smoke

## Links

- [Plan R5](../../plans/2026-07-21-web-zmud-rw.md)
- [Architecture](../../architecture.md)
- [Threat model](../../security/hosted-proxy-threat-model.md)
- [RW probe](../../research/rw-probe-2026-07-21.md)
- [VT/map controls](../../research/rw-ansi-and-map-controls.md)
