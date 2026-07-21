# Plan — Open-source readiness (scan + GitHub + deploy recipe)

> **Status**: **hetero multi-LLM: needs fold** (Grok+Codex BLOCK or split) — see docs/reviews/2026-07-21-hetero-multi-llm.md
> **Owner**: cookys  
> **Seq**: **3** on roadmap  
> **Backlog**: #13, #14, #8  

## Goal

公開 repo 前：**密文掃描**、**GitHub 防護建議**、**HTTPS/WSS 部署食譜**（文件為主，可執行腳本可選）。

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| O1 | gitleaks 或 trufflehog config + `npm run secret-scan` | S | CI 本地可跑；README 一行 |
| O2 | `docs/deploy/HTTPS-WSS.md` Caddy/nginx 範例 | S | 含 Origin allowlist、token、TLS |
| O3 | `docs/deploy/GITHUB.md` branch protection checklist | S | 不強制改 remote（無 token 時文件 only） |

## Non-goals

- 代使用者操作 GitHub org 設定（無 API token 時）  
- 完整 k8s chart  

## Review log

- R0 authored CEO  
