# Plan — Proxy abuse limits (hosted-ready)

> **Status**: **hetero multi-LLM: needs fold** (Grok+Codex BLOCK or split) — see docs/reviews/2026-07-21-hetero-multi-llm.md
> **Owner**: cookys  
> **Seq**: **5** on roadmap  
> **Backlog**: #11 · 連 threat-model 補強  

## Goal

hosted / demo proxy：**連線數、速率、token、Origin** 可配置限制 + 單元測試；文件寫清 self-host vs hosted。

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| A1 | Per-IP / per-token concurrent + rate limits | L | tests 綠 |
| A2 | Config env 文檔 + threat model 補一節 | S | `docs/security` 更新 |
| A3 | Metrics log（metadata only，不 log payload） | S | 可關 |

## Non-goals

- 完整 WAF  
- 付費配額  

## Review log

- R0 authored CEO  
