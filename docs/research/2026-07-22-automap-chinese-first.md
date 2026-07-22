# Automap / Nav shell — Chinese-first research

> **Date**: 2026-07-22  
> **Status**: research + product decisions locked  
> **Plan**: [`docs/plans/2026-07-22-automap-nav-shell.md`](../plans/2026-07-22-automap-nav-shell.md)  
> **Hetero**: researcher + skeptic + Chinese MUD UX architect (session 2026-07-22)

## Problem

Side panel showed crude visit grid (`oooo@oooo`) — mocked as fake map.  
Server **map_d** (VT) is the real city map; client graph is a different product.

## Taxonomy (mapping-relevant)

| Kind | Truth | Chinese-MUD note |
|------|-------|------------------|
| Room graph | client / pack | 迷宮、跨區 path |
| Wilderness grid | coords / grid mode | 次要 |
| Server map_d | server VT only | RW 城區／區域圖 |
| Zone / overworld | area containers | 尺度斷裂 |
| Instance / floors | z / instance id | 樓層、副本 |
| Teleport / special | command edges | 回城、單向 |

## High precision (acceptance language)

Not WebGL glitter. **Display matches walkable truth; else mark unknown/guessed.**

| Level | Meaning |
|-------|---------|
| P0 | map_d visual fidelity |
| P1 | exit pad sends correct command |
| P2 | edge verified by transition |
| P3 | room identity stable (fingerprint) |
| P4 | path preview = command queue |

## Industry

- Mudlet: directed graph, areas, special exits, A*, grid mode, text or GMCP tracking  
- zMUD/cMUD: historical Chinese-player default automapper  
- GMCP Room.Info / MMP: optional; **RW probe = little/no GMCP**  
- Text pipeline: prompt → title → exits → dig / match / undo on fail  

## Risks (skeptic)

- Coord-as-identity + auto reverse = beautiful wrong maps  
- Title-only merge on 大街/小路  
- Competing with map_d for “the map”  
- Pretty UI before move-fail / forced-move handling  

## Product decision (user 2026-07-22)

| # | Decision |
|---|----------|
| 1 | Modes: **附近 + 城圖鏡像** switchable (mirror backlog) |
| 2 | Ship **P1 nearby first**; mirror backlog |
| 3 | **Triggers** for title/exits (text parse v1) |
| 4 | **Per-profile** dialect; **RW → en** (`e`/`n`/…) |
| 5 | **RW first**, then multi-mud |
| 6 | Go implement |

**Architecture**: Nav Shell (D) — default Nearby HUD; Trail = graph + WebGL POC; Mirror = backlog.

## Sources

- https://wiki.mudlet.org/w/Manual:Mapper  
- https://wiki.mudlet.org/w/Generic_mapper_tutorial  
- https://tintin.mudhalla.net/manual/mapping.php  
- mudgate `docs/research/rw-ansi-and-map-controls.md`  
- mudgate `docs/research/rw-probe-2026-07-21.md`  
