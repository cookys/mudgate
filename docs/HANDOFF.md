## 目標

mudgate：中文優先 web MUD 客端。**Companion C0+C1**、**site S0–S3** 已 SHIP。Wishlist BACKLOG 已 triage deferred（見 `docs/OPEN-WORK-INVENTORY.md`）。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | `git log -1` |
| Working tree | hetero `*.err` 勿 commit |
| Companion | **C0+C1 SHIP**；C2 deferred |
| Site / daemon | **S0–S2 code SHIP**；**S3 ADR + Session Protocol v0 SHIP**（daemon 本體 deferred） |

### DONE（本輪 goal）

1. Open-work inventory SSOT  
2. ADR-003 + session-protocol-v0  
3. Companion C1：journey CRUD/export、search、fingerprint reattach、stitch prototype  
4. Site S0–S2 更早 SHIP  

### IN-FLIGHT / 未做

- Companion **C2**（expedition）— deferred  
- Player **daemon binary** — deferred（S3 只 ADR）  
- BACKLOG wishlist — deferred（見 inventory）  

## 下一步（可選）

1. P-daemon MVP  
2. Companion C2  
3. idle  

## 驗證

| 線 | 命令 |
|----|------|
| Unit | `npm test`（含 nav-memory C1） |
| Ship gate | pre-smoke PASS |

## 接續

```text
read /home/cookys/projects/mudgate/docs/HANDOFF.md 接續
```
