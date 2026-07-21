# Plan — Connection profile library (multi-MUD)

> **Status**: **hetero multi-LLM: needs fold** (Grok+Codex BLOCK or split) — see docs/reviews/2026-07-21-hetero-multi-llm.md
> **Owner**: cookys  
> **Seq**: **6** on roadmap  
> **Backlog**: #1  

## Goal

可維護的 **MUD profile 庫**：內建常見服（含 RW 多 port）、自訂 host:port/charset、匯入匯出（已有 JSON 基礎上擴充 UX + 驗證）。

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| P1 | Schema 驗證（host/port/charset/cols） | S | bad JSON 拒絕 |
| P2 | UI：新增／編輯／刪除 profile（drawer） | L | 不連線可編 |
| P3 | 內建 seed 擴充 + 文件 | S | RW 4000/5000/6000 |
| P4 | 可選 auto-login 字串（預設關、警告明文） | S | 需 explicit opt-in |

## Non-goals

- 雲端同步帳密  
- 自動探測伺服器協定  

## Review log

- R0 authored CEO  
