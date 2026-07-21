# Plan — Automap Nav Shell (Chinese-first P1)

> **Status**: **IMPL** (P1 + WebGL trail POC on develop)  
> **Date**: 2026-07-22  
> **Research**: `docs/research/2026-07-22-automap-chinese-first.md`  
> **Decisions**: modes switchable; P1 first; triggers; RW dialect en; RW→multi  

## Scope — this ship

| ID | Deliverable | Done |
|----|-------------|------|
| **N0** | Remove `oooo@oooo` as product surface | yes |
| **N1** | Nearby HUD: title, confidence, 8+u/d pad, click-to-walk | yes |
| **N2** | Text triggers: 出口：/Exits + title heuristic + move-fail | yes |
| **N3** | Room graph fingerprint identity; no auto reverse invent | yes |
| **N4** | Profile `moveDialect` en/zh; RW seeds en | yes |
| **N5** | Mode tabs: 附近 / 足跡 / 城圖 | yes |
| **N6** | 足跡 WebGL (Canvas2D fallback) POC | yes |
| **N7** | 城圖 mirror = backlog copy only | yes |

## Backlog (not this ship)

| ID | Item |
|----|------|
| **B1** | map_d mirror / pin second viewport |
| **B2** | Bookmarks + path preview + speedwalk queue |
| **B3** | Forced-move / follow / teleport events |
| **B4** | Map pack import/export |
| **B5** | Per-mud parser profiles beyond RW defaults |
| **B6** | A* pathfinding on graph |
| **B7** | Multi-session isolated graphs |

## Acceptance (P1)

1. Walk RW-style text (`中央廣場` + `出口：東、西`) → HUD shows title + exits.  
2. Click 東 pad with dialect en → sends `e`.  
3. dialect zh → sends `東`.  
4. Wall text `你不能…` → no phantom room dig.  
5. Trail tab shows nodes (WebGL or 2d).  
6. Mirror tab shows backlog honesty.  
7. Terminal map_d unchanged.

## Layout

| Path | Role |
|------|------|
| `packages/mapper/src/{dirs,parse,graph}.ts` | core |
| `apps/web/src/components/MapNavPanel.tsx` | shell UI |
| `apps/web/src/components/MapGraphPoc.tsx` | WebGL POC |
| `packages/profiles` | `moveDialect` |

## WebGL note

Trail POC uses WebGL points when available; Canvas2D fallback.  
Not required for P1 accuracy — presentation spike toward later high-density graphs.
