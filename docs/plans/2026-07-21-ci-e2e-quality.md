# Plan — CI e2e + golden terminal streams

> **Status**: **approved** (hetero R1 APPROVE_WITH_NITS) · project bootstrapped  
> **Owner**: cookys  
> **Seq**: **4** on roadmap  
> **Backlog**: #12  

## Goal

自動化防回歸：**unit 已有**；加 **mock MudOS/TCP fixture** + **golden VT/Big5 streams** + CI workflow 骨架。

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| Q1 | Mock telnet server (node) 播 fixture bytes | L | test 可連 127.0.0.1:port |
| Q2 | Golden stream tests: IAC → Big5 → VT buffer snapshot | L | 既有 fixtures 進 CI |
| Q3 | GitHub Actions / 本地 `npm run test:e2e` 腳本 | S | 無秘密；可 skip if no GHA |

## Non-goals

- 真連 RW 的 CI（不穩定／倫理）  
- 視覺 screenshot CI  

## Review log

- R0 authored CEO  
