# Hetero R1 — roadmap child plans (2026-07-21)

**Reviewer**: multi-role (Architect/Ops/Skeptic/Product)  
**Input**: 8 plans under `docs/plans/2026-07-21-{roadmap,mccp2,fonts-f2,oss,ci,abuse,profile,research}*`

## Matrix

| Plan | R1 | After fold | Project |
|------|----|------------|---------|
| roadmap-priority | APPROVE_WITH_NITS | approved | n/a meta |
| **mccp2-stream** | **BLOCK** | **approved** (path/caps/fixtures frozen in plan) | `2026-07-21-mccp2-stream` |
| terminal-fonts-f2 | APPROVE_WITH_NITS | approved | `2026-07-21-terminal-fonts-f2` |
| open-source-readiness | APPROVE_WITH_NITS | approved | `2026-07-21-open-source-readiness` |
| ci-e2e-quality | APPROVE_WITH_NITS | approved | `2026-07-21-ci-e2e-quality` |
| proxy-abuse-limits | APPROVE_WITH_NITS | approved | `2026-07-21-proxy-abuse-limits` |
| profile-library | APPROVE_WITH_NITS | approved | `2026-07-21-profile-library` |
| research-spikes | APPROVE | approved | `2026-07-21-research-spikes` |

## MCCP BLOCK → fold summary

Must land in plan (done):

1. Frozen pre/post SE path; no parser on zlib wire  
2. Same-chunk SE+payload fixture required  
3. Retire silent `tryInflateMccp` hot path  
4. `createInflate` primary  
5. Output caps + destroy  
6. Flag defaults + remote-prod noted  

## Expand order (implement)

1. mccp2-stream  
2. ci-e2e-quality (include MCCP goldens after #1) **or** fonts-f2 parallel  
3. terminal-fonts-f2  
4. open-source-readiness  
5. proxy-abuse-limits (↑ if public host)  
6. profile-library  
7. research-spikes (R2 anytime)  

## Bootstrap

All APPROVE* projects created under `docs/projects/2026-07-21-*/`.  
**Implement not started** in this pass (plan+project expand only).  
