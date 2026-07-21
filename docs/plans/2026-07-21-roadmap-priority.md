# Roadmap priority — full requirements scan (CEO ordered)

> **Status**: **approved order** MCCP→CI→fonts→OSS→abuse→profiles→research (multi-LLM R3)  


> **Owner**: cookys  
> **Method**: 掃描 BACKLOG + zMUD matrix + residual plans + ship gaps → 依「先能連／能驗／能公開／再加深」排序。

## Already SHIP (do not re-plan)

| Item | Ref |
|------|-----|
| Bootstrap P0–P5 / web-zmud-rw | `2026-07-21-web-zmud-rw.md` |
| UI shell + copy + MudSocket | `2026-07-21-ui-shell-ship.md` |
| i18n baseline + StatusEvent | `2026-07-21-i18n-locale.md` |
| Font stack baseline + TC chain | `terminal-fonts.md` (baseline) |

## Ordered queue — **SHIP complete on develop** (2026-07-22)

Impl multi-family ALL_CLEAR: [`queue-impl-hetero-all-clear`](../reviews/2026-07-21-queue-impl-hetero-all-clear.md).

| Seq | Plan slug | Size | Why this order | Status |
|-----|-----------|------|----------------|--------|
| **1** | [`mccp2-stream`](./2026-07-21-mccp2-stream.md) | L | RW WILL MCCP2；連線品質（**hetero 共識第 1**） | **SHIP** |
| **2** | [`ci-e2e-quality`](./2026-07-21-ci-e2e-quality.md) | L | 驗 MCCP/VT 回歸；**在 fonts/OSS 前** | **SHIP** |
| **3** | [`terminal-fonts-f2`](./2026-07-21-terminal-fonts-f2.md) | L | 試掘 UX／1:2／自選 | **SHIP** |
| **4** | [`open-source-readiness`](./2026-07-21-open-source-readiness.md) | S–L | secret scan + LICENSE + deploy 食譜 | **SHIP** |
| **5** | [`proxy-abuse-limits`](./2026-07-21-proxy-abuse-limits.md) | L | hosted 安全 | **SHIP** |
| **6** | [`profile-library`](./2026-07-21-profile-library.md) | L | multi-MUD 深度 | **SHIP** |
| **7** | [`research-spikes`](./2026-07-21-research-spikes.md) | S | 研究 only | **SHIP** docs |

## Deferred (P2 / not formal plan yet)

| Backlog # | Item | Note |
|-----------|------|------|
| 3 | session replay | after log UX stable |
| 4 | split sessions | after profile-library |
| 5 | RW 2D map embed | optional chrome |
| 6 | PWA | after mobile thumb polish |
| 7 | pack registry | community H |
| 10 | telnets upstream | RW cleartext today |
| 9 | threat model v2 write-up | fold into #5 when hosted |

## Expand rule

1. Child plan **hetero APPROVE / APPROVE_WITH_NITS**  
2. Bootstrap `docs/projects/2026-07-21-<slug>/`  
3. Implement on `feat/<slug>` · default impl grok-4.5 medium  
4. Loop review → depth-0 qc → merge `develop`  
