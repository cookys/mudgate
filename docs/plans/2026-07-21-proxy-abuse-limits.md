# Plan — Proxy abuse limits (hosted-ready)

> **Status**: **fold R2** (multi-LLM)  
> **Owner**: cookys  
> **Seq**: **5** on roadmap  
> **Backlog**: #11  
> **Project**: `docs/projects/2026-07-21-proxy-abuse-limits/`  

## Goal

WS/auth 層精確限流。Origin allowlist 屬既有 `policy.ts`。MCCP inflate caps 屬 mccp2-stream。

## Defaults

| Limit | hosted | localhost-dev |
|-------|--------|---------------|
| Concurrent WS / IP | 8 | 64 |
| Concurrent WS / token | 4 | 32 |
| Upgrades / IP / min | 30 | 120 |
| Hellos / conn / min | 20 | 60 |
| Inbound bytes / conn / min | 2 MiB | 16 MiB |
| Outbound bytes / conn / min | 16 MiB | 64 MiB |
| Hello timeout | 10s | 30s |

IPv4/IPv6 normalize; optional trusted proxy; fail-closed; atomic acquire/release; no payload logs.

## Phases

| ID | Work | Acceptance |
|----|------|------------|
| A1 | Enforce table at upgrade + hello | unit tests |
| A2 | Env + threat model section | md |
| A3 | Optional metadata metrics | off default |

## Review log

- R0 · R2 multi-LLM fold  
