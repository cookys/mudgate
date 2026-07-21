# Plan — Connection profile library

> **Status**: **fold R2** (multi-LLM)  
> **Owner**: cookys  
> **Seq**: **6** on roadmap  
> **Backlog**: #1  
> **Project**: `docs/projects/2026-07-21-profile-library/`  

## Goal

Schema + UI + RW seeds + safe optional auto-login.

## Security

- Secrets in `assmud.profileSecrets` separate from exportable profiles  
- Export **omits** secrets by default  
- Never log secrets; opt-in + plaintext warning  
- Custom host still subject to proxy allowlist  

## Schema

- charset: `big5hkscs` \| `big5` \| `gbk` \| `utf8`  
- port 1–65535  
- seed RW 4000/5000/6000  

## Phases

| ID | Work | Acceptance |
|----|------|------------|
| P1 | Strict import validation | reject bad JSON |
| P2 | CRUD UI | offline edit |
| P3 | Seeds + docs | 3 RW ports |
| P4 | Secrets store + export exclude | no leak via export |

## Review log

- R0 · R2 multi-LLM fold  
