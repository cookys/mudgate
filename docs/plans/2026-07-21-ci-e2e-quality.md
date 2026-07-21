# Plan — CI e2e + golden terminal streams

> **Status**: **fold R2** (multi-LLM)  
> **Owner**: cookys  
> **Seq**: **2** on roadmap  
> **Backlog**: #12  
> **Project**: `docs/projects/2026-07-21-ci-e2e-quality/`  

## Goal

Mock TCP fixtures + golden streams (**including MCCP2**) + **mandatory** `npm run test:e2e` for qc-gate.

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| Q1 | Mock telnet server 播 fixture | L | 127.0.0.1 可連 |
| Q2 | Goldens: (a) uncompressed IAC→**protocol data events** (b) **MCCP2 WILL→DO→SB SE→zlib multi/same-chunk→decompressed Big5/VT events** | L | 兩套綠；非 pixel snapshot |
| Q3 | `npm run test:e2e` + GHA **blocking**；qc-gate 必跑 local e2e | S | **禁止** skip |

## Non-goals

- Live RW in CI  
- Full browser pixel e2e (unless separately scoped)  

## Review log

- R0 CEO · R2 multi-LLM fold (Grok/Codex/GLM/MiniMax)  
