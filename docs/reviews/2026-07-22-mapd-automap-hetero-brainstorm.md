# Hetero brainstorm — map_d vs automap (2026-07-22)

> Brief: `2026-07-22-mapd-automap-brainstorm-brief.md`  
> Question: RW-class map_d 下還有哪些高大上、可做的導航產品？

## Engine roster

| Requested | Actual dispatch | Status |
|-----------|-----------------|--------|
| glm 5.2 | `qoderclicn -m GLM-5.2` | **OK** → `…-glm52.out` |
| minimax 3 | `qoderclicn -m MiniMax-M2.7` (closest on PATH) | **OK** → `…-minimax.out` |
| gemini-flash-3.5-high | `agy --model gemini-3.5-flash-high` / `3.6-flash-high` | **FAIL** — only model-id chatter, no design answer |
| kimi k3 | `qoderclicn -m Kimi-K2.7-Code` (closest) | **OK** → `…-kimi.out` |
| qwen 3.8 max | `qoderclicn -m Qwen3.8-Max-Preview` | **OK** → `…-qwen38.out` |
| gpt-5.6-sol | `codex exec -m gpt-5.6-sol` | **OK** → `…-gpt56sol.out` |

**N=5 successful families.** Gemini unavailable for opinion this run.

---

## Consensus stance (5/5)

> Client = **導航副駕 / 地圖翻譯官 / map_d 伴**，  
> **不是** 第二張更準的世界地圖。  
> Server map_d = spatial ground truth；client 做記憶、標註、旅程、無圖區 fallback。

---

## Idea heatmap (count of engines recommending)

| Idea cluster | Engines | Feasibility vibe | Notes |
|--------------|---------|------------------|-------|
| **map_d mirror + freeze-frame + annotate** | all 5 | **H** | Universal #1; zero topology |
| **Journey / route recorder** (replay, not auto-path) | GPT, GLM, Kimi, Qwen | H–M | Social + practical |
| **Session trail / breadcrumbs** (honest, local) | all 5 | H–M | Keep confidence labels |
| **VT cell fingerprint / visual anchor** (no OCR) | GPT, MiniMax, Qwen | M | Re-localize annotations |
| **VT stitch panorama** (walk → sew 25×9 frames) | **GLM star** | H–M | Most distinctive “wow” |
| **Expedition graph only when no map_d** | GPT, GLM, Kimi, Qwen | M | Gated fallback |
| **Semantic / NL search over room history** | Qwen, Kimi | M–L | Chinese-player fit |
| **Crowd / collaborative heatmap or merge** | GLM, MiniMax, GPT, Qwen | L | Moonshot; cold-start + privacy |
| **map change detector (frame diff)** | MiniMax, Qwen | M | Long-lived RW pain |
| **Haptics / audio nav** | Kimi | M | Accessibility niche |

---

## Explicit ANTI (shared)

- Mudlet-class full-world room-graph for RW cities  
- OCR of VT (use cell buffer instead)  
- Pretty dead-reckon as permanent world coords  
- Default auto-speedwalk on inferred paths  
- Pretending GMCP Room.Info will save the day  
- Competing with / regressing map_d  

---

## Highest-leverage “高大上” shortlist

### A. map_d Live Companion (consensus P0)
Mirror last map_d frame → freeze → zoom/pan → pin notes on cell coords.  
**Why wow:** leaves full-screen map but keeps a reference pane.  
**Depends on:** detecting map_d lifecycle without breaking SAVEC/REST.

### B. VT Stitch Canvas (GLM’s standout)
While player walks with map open, capture VT frames and **overlap-align** into a city panorama.  
**Why wow:** “Google Maps stitch” of *server-correct* tiles — not guessed topology.  
**Risk:** scroll direction detection, Big5 cell alignment, dynamic markers.

### C. Journey Recorder (GPT / GLM / Kimi)
Named paths = command sequence + map snapshots + breadcrumbs; step-by-step coach, not blind speedwalk.  
**Why wow:** shareable “銀行→鐵匠” packs without lying about coordinates.

### D. Visual Anchor Localization (GPT)
Fingerprint glyph+color neighborhood of current map_d viewport → reattach notes/journeys when you reopen map.  
**No OCR.** Confidence + candidates mandatory.

### E. Expedition Mode (GPT)
Room-graph **only** for maze / no-map_d zones; discard or archive on exit; never merge into city truth.

### F. Moonshots worth keeping in backlog
1. **Probabilistic Navigation Memory** (GPT) — “to 藥舖” → ranked routes with confidence/recovery  
2. **Crowd stitch / heatmap** (GLM/MiniMax) — anonymous trail aggregation  
3. **NL ask your history** (Qwen) — “上次賣藥的在哪” over IndexedDB text index  

---

## Recommended 2-sprint synthesis (merged)

| Phase | Ship |
|-------|------|
| **P0** | map_d freeze + last-frame mirror + pin notes; confidence UI on nearby/trail; map_d VT fixtures |
| **P1** | Journey recorder (record/replay/share text path); title/frame index search; optional stitch **prototype** on one city |
| **P2** | Expedition mode gated prototype in one maze; frame-diff “map changed?” alert; design-only crowd schema |

---

## Product one-liner (for UI copy)

> **終端 map_d 是地圖；側欄是導航記憶與副駕。**  
> 我們不畫假世界，我們讓官方圖更好用、讓你走過的路記得住。

Raw engine outputs: `docs/reviews/2026-07-22-mapd-brainstorm-*.out`
