# Plan candidates — from BACKLOG (待 Board 核對成案)

> **Status**: draft · **awaiting Board triage**  
> **Owner**: cookys  
> **Source**: `docs/BACKLOG.md`（16 項未成案）  
> **Goal**: 與你核對優先級後，勾選項升級為正式 `docs/plans/YYYY-MM-DD-*.md` → hetero review → 成案。

## 怎麼核對

請對每一列回：

- **P0** 下一個 sprint 必做  
- **P1** 近季  
- **P2** 有空再做  
- **DROP** 不做／併入他案  
- **SPIKE** 只做研究、不成產品 plan  

也可改寫「建議 slug / 一句 scope」。

---

## Product / client（7）

| # | Backlog 原文 | 建議 plan slug | 建議 size | 建議你標 |
|---|--------------|----------------|-----------|----------|
| 1 | Connection profile library（各家 mud presets + custom host:port/charset） | `profile-library` | L | ？ |
| 2 | zMUD-compatible trigger / alias import（`.mud` research） | `zmud-import` | L（先 S spike） | ？ |
| 3 | Offline log viewer / session replay | `session-replay` | L | ？ |
| 4 | Multi-character / multi-session split view | `split-sessions` | L | ？ |
| 5 | Optional RW 2D live map embed | `rw-map-embed` | S–L | ？ |
| 6 | Mobile / PWA installability | `pwa-install` | L | ？ |
| 7 | Shared trigger package registry（community packs） | `pack-registry` | H（遠） | ？ |

## Platform / security（7）

| # | Backlog 原文 | 建議 plan slug | 建議 size | 建議你標 |
|---|--------------|----------------|-----------|----------|
| 8 | Production HTTPS + WSS deploy recipe | `prod-deploy-wss` | S–L | ？ |
| 9 | Self-host vs hosted relay threat model write-up | `proxy-threat-model-v2` | S（doc） | ？ |
| 10 | Optional TLS-to-MUD (telnets) | `telnets-upstream` | L | ？ |
| 11 | Open-relay abuse tests + rate limits | `proxy-abuse-limits` | L | ？ |
| 12 | CI: unit + golden streams + e2e mock MudOS | `ci-e2e-mock` | L | ？ |
| 13 | CI secret scan before public push | `ci-secret-scan` | S | ？ |
| 14 | GitHub remote: branch protection + advisories | `github-hardening` | S | ？ |

## Research spikes（2）

| # | Backlog 原文 | 建議 | 建議你標 |
|---|--------------|------|----------|
| 15 | Capture real RW login banner + captcha fixtures（user-gated） | spike only；**禁** credentials 進 repo | ？ |
| 16 | Compare Mudlet / BeipMU / webmud / mudportal matrix | spike → 餵 feature backlog | ？ |

---

## 已成案、本次實作中（不在上表）

| 項 | Plan | 狀態 |
|----|------|------|
| 語系 + StatusEvent | `2026-07-21-i18n-locale.md` | **feat/i18n-fonts 實作中** |
| 終端字體 / TC chain / 試掘 | `docs/design/terminal-fonts.md` | **同分支實作 baseline** |

## 建議預設優先（供你改）

若你沒意見，CEO 預設成案順序：

1. **P0** `#13` ci-secret-scan + `#8` prod-deploy-wss（開源／上線前）  
2. **P0** `#12` ci-e2e-mock（品質）  
3. **P1** `#1` profile-library  
4. **P1** `#11` proxy-abuse-limits  
5. **P2** 其餘 product  
6. **SPIKE** `#15` `#16` `#2` research 先  

回覆格式範例：

```
1 P0
2 SPIKE
3 P2
…
8 P0
13 P0
DROP 7
```

成案後會為 P0/P1 各寫完整 plan + hetero review log。  
