# Plan — Open-source readiness

> **Status**: **SHIP**  
> **Owner**: cookys  
> **Seq**: **4** on roadmap  
> **Backlog**: #13, #14, #8  
> **Project**: `docs/projects/2026-07-21-open-source-readiness/`  

## Goal

MIT LICENSE 核對、secret-scan **CI blocking**、HTTPS/WSS 部署食譜、GitHub checklist。

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| O0 | Root MIT `LICENSE` ↔ package metadata | S | consistent |
| O1 | gitleaks/trufflehog + `npm run secret-scan`；CI **must** run | S | blocking; remediation doc if hit |
| O2 | `docs/deploy/HTTPS-WSS.md` Origin/token/TLS/**MCCP caps** align `policy.ts` | S | matches code |
| O3 | `docs/deploy/GITHUB.md` branch protection | S | checklist |

## Non-goals

- GitHub org API automation without token  

## Review log

- R0 · R2 multi-LLM fold  
