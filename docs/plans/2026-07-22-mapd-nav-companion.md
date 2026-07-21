# Plan — map_d Nav Companion（導航副駕）

> **Status**: **draft** — formal plan from hetero brainstorm; **not implemented**  
> **Owner**: cookys  
> **Date**: 2026-07-22  
> **Extends**: [`2026-07-22-automap-nav-shell.md`](./2026-07-22-automap-nav-shell.md)（P1 Nav Shell **已 SHIP**）  
> **Research**:  
> - [`docs/research/2026-07-22-automap-chinese-first.md`](../research/2026-07-22-automap-chinese-first.md)  
> - [`docs/research/rw-ansi-and-map-controls.md`](../research/rw-ansi-and-map-controls.md)  
> - Hetero: [`docs/reviews/2026-07-22-mapd-automap-hetero-brainstorm.md`](../reviews/2026-07-22-mapd-automap-hetero-brainstorm.md)  
>   Engines: GLM-5.2 · MiniMax-M2.7 · Kimi-K2.7 · Qwen3.8-Max · gpt-5.6-sol（Gemini FAIL）

---

## 0. Problem

### 0.1 產品矛盾

| 玩家以為「地圖」 | assmud 側欄曾給的 |
|------------------|-------------------|
| RW **map_d** 城圖（server VT 全螢幕） | `oooo@oooo` / 假 room-graph |
| 迷宮才需要 client 記路 | 用 client 跟城圖搶「地圖」權威 |

**Hetero 共識（5/5）**：client = **導航副駕**，不是第二張世界圖。  
Server map_d = spatial ground truth；client 做 **記憶、標註、旅程、無圖區 fallback**。

### 0.2 已落地（勿重做 · Nav Shell P1）

| 能力 | 狀態 | 位置 |
|------|------|------|
| 側欄模式：附近 / 足跡 / 城圖 | done | `MapNavPanel` |
| 附近 HUD + 八向 pad + `moveDialect` | done | mapper + Profile |
| 出口／房名 text trigger + move-fail undo | done | `@assmud/mapper` |
| Dead-reckon session trail | done | `RoomTracker.noteOutbound` |
| 城圖 tab 僅 backlog 文案 | done | i18n `map.mirror.backlog` |
| 終端 VT buffer（CUP/SAVEC/REST）map_d 可畫 | done | `ScreenBuffer` |

### 0.3 本 plan 要解決

1. **城圖 tab 有內容**：無失真利用 **已正確的 VT cell buffer**（非 OCR、非猜拓樸）。  
2. **玩家記憶層**：凍結幀、釘註記、旅程錄放（非 auto-speedwalk）。  
3. **高大上可選**：stitch 全景 prototype、迷宮 Expedition（gated）。  
4. **明確 ANTI**：不為 RW 城區做 Mudlet 式全圖 room-graph。

### 0.4 產品一句話（UI 文案 SSOT）

> **終端 map_d 是地圖；側欄是導航記憶與副駕。**  
> 我們不畫假世界——讓官方圖更好用，讓你走過的路記得住。

---

## 1. Goals / Non-goals

### 1.1 Goals

| ID | Goal |
|----|------|
| **G1** | 側欄「城圖」模式 = **Live Companion**：最新 map_d 幀鏡像 + freeze + 縮放平移 |
| **G2** | 在凍結／鏡像幀上 **釘註記**（cell 座標錨定，非猜 room id） |
| **G3** | **Journey Recorder**：錄指令序列 + 可選幀錨點；逐步重播（非自動跑完全程） |
| **G4** | 信心語意一致：Known / Inferred / Unknown 貫穿 nearby、trail、companion |
| **G5** | map_d **零回歸**（SAVEC/REST/CUP/雙寬）— golden fixtures 必過 |
| **G6** | Stitch **單城 prototype**（可關、可標實驗）— 繼承 server 畫面，不推拓樸 |
| **G7** | Expedition：**僅無 map_d 區** 臨時 graph；離區封存；不併入城圖真相 |

### 1.2 Non-goals（ANTI · hetero 共識）

| 不做 | 原因 |
|------|------|
| RW 城區 Mudlet 式全圖 room-graph | 無 GMCP；必錯；與 map_d 搶權威 |
| OCR VT 畫面 | cell buffer 已有；OCR 傷 Big5/色 |
| 預設 auto-speedwalk 推斷路徑 | 假路徑比沒路徑危險 |
| 把 dead-reckon 當永久世界座標 | 瞬移／門會漂 |
| 假設 GMCP Room.Info 會來 | RW probe 未見；不可當骨幹 |
| 群眾熱力／雲端聚合 | moonshot backlog only（本 plan 只寫 schema 備註） |
| 自然語言 LLM 導航 v1 | P3+ |
| 改寫終端搶主畫面取代 map_d | regression |

---

## 2. Architecture

### 2.1 雙層模型（硬邊界）

```text
┌─────────────────────────────────────────────┐
│  Terminal ScreenBuffer (SSOT for map_d)     │
│  cells[][] · attrs · SAVEC/REST/CUP         │
└──────────────────┬──────────────────────────┘
                   │ snapshotFrame()  [read-only clone]
                   ▼
┌─────────────────────────────────────────────┐
│  packages/nav-memory (new)                  │
│  FrameStore · PinStore · JourneyStore       │
│  VisualAnchor (fingerprint) · optional Stitch│
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  MapNavPanel modes                          │
│  附近(HUD) | 足跡(trail) | 城圖(Companion)  │
│  + Journey UI · Expedition (gated)          │
└─────────────────────────────────────────────┘
```

| 層 | 真相 | 可寫？ |
|----|------|--------|
| ScreenBuffer live | server 當下畫面 | 只由 VT write 寫 |
| Frame snapshot | 某時刻 cell 複本 | client 持久化 |
| Pins / journeys | 玩家記憶 | client only |
| RoomTracker trail | session 推測 | client；**永不覆蓋 map_d** |

### 2.2 map_d 活躍偵測（Companion 前提）

**問題**：何時把 live buffer 當成「城圖幀」而不當成普通輸出？

| 訊號 | 強度 | 實作策略 |
|------|------|----------|
| A. 短時間大量 CUP 絕對定址列 | 高 | 解析 write 路徑計數 `CUP row` 密度 |
| B. SAVEC → 多列 paint → REST 模式 | 高 | 既有 `savedCursor` / 研究文件 pattern |
| C. 使用者手動「釘住目前畫面為地圖」 | 確定 | **P0 必做 fallback**（不靠自動偵測） |
| D. 啟發式：框線字元密度 + 25×9 / 31×9 有效區 | 中 | P1 加強 |

**P0 決策**：  
- **自動**：若偵測到 map_d-like paint burst → 更新 `lastMapFrame`（不打擾終端）。  
- **手動**：側欄「釘住目前終端畫面」永遠可用（即使 auto 失敗）。  
- **錯誤代價**：誤判 → 多一張垃圾快照（可刪）；**不可**改 live buffer。

### 2.3 Frame 資料模型

```ts
/** One frozen VT viewport — ground-truth cells, not topology */
type MapFrame = {
  id: string;
  capturedAt: number;       // epoch ms
  cols: number;
  rows: number;
  /** row-major cells: ch + fg/bg/bold subset */
  cells: Array<{ ch: string; fg?: number; bg?: number; bold?: boolean }>;
  widthMode: "cjk" | "western";
  /** optional visual fingerprint for re-attach */
  fingerprint: string;
  source: "auto-mapd" | "manual-pin" | "stitch-tile";
  profileKey: string;       // host:port or profile id
  tabId?: string;           // session scope
  label?: string;           // user rename
};

type MapPin = {
  id: string;
  frameId: string;          // or fingerprint+zone if reattached
  r: number;                // cell row
  c: number;                // cell col
  text: string;             // 繁中備註
  createdAt: number;
};

type Journey = {
  id: string;
  name: string;
  profileKey: string;
  steps: Array<{
    cmd: string;            // actual sent (e / 東)
    at: number;
    frameId?: string;       // optional map snapshot at step
    titleHint?: string;     // room title if parsed
  }>;
  createdAt: number;
  updatedAt: number;
};
```

**Storage**

| 資料 | 建議 | 理由 |
|------|------|------|
| 最近 N 幀（縮圖級） | IndexedDB | 超過 localStorage 5MB |
| Pins / journey metadata | IndexedDB 或 localStorage JSON | 小 |
| Stitch 全景 | IndexedDB only | 大 |
| 金鑰前綴 | `assmud.nav.*` / IDB `assmud-nav` | 與 vault 分離；**非秘密** |

Quota：超過上限 **LRU 丟最舊幀**；pins 若 frame 被丟 → pin 標 `orphan` 或一併刪（P0：一併刪 + toast）。

### 2.4 Visual Anchor（無 OCR）

```text
fingerprint = hash(
  sample grid of cells at fixed strides,
  ch + coarse fg,
  cols, rows, widthMode
)
```

- 再開 map 時：`lastMapFrame.fingerprint` 與 live 比對 → 相似則挂回 pins。  
- 低信心：列出 2–3 候選，**不**自動 merge。  
- **禁止** 把 fingerprint 當成 room vnum。

### 2.5 Stitch（P1 prototype · GLM idea）

```text
while (mapd-like frames arriving && stitchEnabled):
  tile = snapshot(region of interest)  // city ~rows of map body
  estimate offset from:
    - last move dir (n/s/e/w → ±cell step heuristic)
    - optional overlap correlation on cell ch grid
  place tile on panorama canvas
```

| 規則 | |
|------|--|
| 預設 **關** | 設定或側欄實驗開關 |
| 標「實驗 · 非完整拓樸」 | UI 必顯 |
| 只 stitch **map_d-like** 幀 | 普通 scroll 文字不進 |
| 失敗可清空 | 一鍵 reset panorama |
| 不做 pathfind | 全景是**視覺記憶** |

### 2.6 Expedition（P2 · gated）

啟用條件（**全部**滿足才自動建議；可手動開）：

1. 連續 T 秒 / N 次 look **無** map_d-like frame  
2. 玩家確認或設定「此區當迷宮」  
3. RoomTracker 出口 parse 有最低可用率  

行為：

- 使用既有 `RoomTracker` graph  
- 離開區／重連 → **封存**為 `expedition-{id}`，不併入「城圖」  
- UI 標 **推測地圖** + confidence  

### 2.7 Journey Recorder（非 auto-walk）

| 模式 | 行為 |
|------|------|
| 錄製 | 每個成功送出的移動／關鍵指令 append step；可選同步 `lastMapFrame` id |
| 重播 | 顯示下一步；**使用者按「送出下一步」** 才 `mudSend`；中斷條件：戰鬥字樣、move-fail、使用者停 |
| 匯出 | JSON（無 vault 密碼）；可分享 |
| 明確不做 v1 | 無確認的全速 speedwalk 佇列 |

### 2.8 與 Nav Shell 模式對應

| Tab | 現況 | 本 plan 後 |
|-----|------|------------|
| 附近 | HUD + pad | 保留；信心標籤統一 |
| 足跡 | trail nodes | 保留；文案「session 推測」 |
| 城圖 | backlog 字 | **Companion**：live/last frame + freeze + pins |
| （新）旅程 | — | 錄/播列表（可嵌城圖下方或子 panel） |
| （新）實驗 stitch | — | 城圖進階或設定開關 |

---

## 3. Phased delivery

### Phase C0 — Companion 核心（**本 plan 首 ship 最小集**）

| ID | 交付 | 驗收 |
|----|------|------|
| **C0.1** | `ScreenBuffer` 或 TerminalHost **read-only snapshot API**（deep clone cells+attrs 子集） | unit：snapshot 不受後續 write 污染 |
| **C0.2** | 手動「釘住目前畫面」→ `MapFrame` 進 store | 重載後仍可開 |
| **C0.3** | 自動：map_d-like burst → 更新 `lastMapFrame`（可關） | 不影響終端 paint |
| **C0.4** | 城圖 tab：渲染 last/frozen frame（canvas 或 cell grid） | 與終端雙寬 mode 一致 |
| **C0.5** | freeze / 解除 / 縮放平移（基礎） | 終端仍可玩 |
| **C0.6** | Pin CRUD（cell 點選 + 文字） | 綁 frameId；刪 frame 清 pin |
| **C0.7** | i18n 文案：副駕定位；去掉「假 map」感 | zh-TW/CN/en |
| **C0.8** | map_d VT regression fixture 擴充（至少 1 synthetic city frame） | CI / vitest 綠 |
| **C0.9** | **零回歸**：既有 golden-streams / map-vt tests 全過 | pre-smoke PASS |

**C0 不做**：stitch、journey 重播、expedition、群眾、尋路。

### Phase C1 — Journey + 索引 + stitch prototype

| ID | 交付 | 驗收 |
|----|------|------|
| **C1.1** | Journey 錄製 / 命名 / 列表 / 刪除 | per profileKey |
| **C1.2** | 逐步重播 UI（一步一確認） | move-fail 停止 |
| **C1.3** | Journey 匯出／匯入 JSON | 無 secrets |
| **C1.4** | Frame/title 簡易搜尋（字串 contains） | 「銀行」命中 pin/titleHint |
| **C1.5** | Visual fingerprint reattach pins（候選 UI） | 低信心不自動 |
| **C1.6** | Stitch prototype：單開關 + 清空 + 「實驗」標 | 至少 3 步移動可見拼合趨勢（允許不完美） |
| **C1.7** | 連續幀 cell-diff 高亮（可選） | 兩幀差異可見 |

### Phase C2 — Expedition + 變更偵測 + moonshot 設計

| ID | 交付 | 驗收 |
|----|------|------|
| **C2.1** | Expedition 閘門 + 封存 | 城圖 tab 不顯示 expedition 為「官方」 |
| **C2.2** | 同 fingerprint／同 label 幀 diff →「地圖可能改了」提示 | 可 dismiss |
| **C2.3** | Crowd / NL-search：**設計附錄 only**（本 phase 不實作後端） | plan §8 |

---

## 4. UX 細節

### 4.1 城圖 tab（Companion）

```text
[ 即時 | 凍結 ]  [釘住終端]  [清除]
┌─────────────────────────┐
│  VT cell 渲染（可拖可縮） │
│  pins: ★藥 ★銀行         │
└─────────────────────────┘
信心：官方幀 · 非 client 重建
```

### 4.2 信心圖例（全側欄共用）

| 標籤 | 含義 | 顏色/形狀 |
|------|------|-----------|
| 官方 | map_d / 凍結幀 cell | 實線框 |
| 已驗證 | 出口 parse + 移動確認 | accent |
| 推測 | dead-reckon trail | 虛線 |
| 未知 | 無資料 | dim |

### 4.3 預設模式（RW profile）

| 狀態 | 預設 tab |
|------|----------|
| 偵測到 map_d-like / 有 lastMapFrame | **城圖**（或記住使用者上次） |
| 普通房間 | **附近** |
| 使用者開 expedition | 足跡強化或獨立徽章 |

### 4.4 手機

- 側欄預設關（既有）  
- Companion 以全高 bottom sheet 可選（C1）  
- 釘 pin 用長按 cell（C1）

---

## 5. 技術落點（建議路徑）

| 模組 | 職責 |
|------|------|
| `packages/terminal` | `snapshotCells(): MapFrameCells`；不改 paint 語意 |
| `packages/nav-memory`（新）或擴 `packages/mapper` | FrameStore, PinStore, JourneyStore, fingerprint, stitch |
| `apps/web/.../MapCompanion.tsx` | 城圖 tab 主 UI |
| `apps/web/.../JourneyPanel.tsx` | 錄放 |
| `TerminalHost` | 可選 callback `onMapdLikelyFrame` / 暴露 snapshot 給 App |
| `MapNavPanel` | 掛載 Companion；城圖不再是純文字 backlog |

**依賴方向**：web → nav-memory → terminal types；**禁止** terminal 依賴 web。

---

## 6. Testing / QC

| 層 | 內容 |
|----|------|
| Unit | snapshot immutability；fingerprint 穩定；pin orphan 規則；journey step 序列化 |
| Fixture | synthetic map_d sequence（SAVEC + CUP rows + REST）→ auto 更新 lastMapFrame |
| Regression | `packages/terminal/tests/map-vt.test.ts`；e2e golden streams |
| Manual smoke | 開 map → 側欄見幀；freeze；釘 pin；關 map 仍見凍結；錄 3 步旅程逐步重播 |
| pre-smoke | 既有 script PASS |

**高精度定義（延續 research）**：顯示與可走一致；官方幀與推測 UI **視覺分離**；不一致標未知。

---

## 7. Risks & mitigations

| 風險 | 緩解 |
|------|------|
| map_d 偵測假陽性／假陰性 | 手動釘住為 P0 權威；auto 可關 |
| IndexedDB 配額 | LRU；限制幀數與解析度（可存 attrs 子集） |
| Stitch 對不齊 | 實驗標 + 一鍵清空；不進預設 on |
| Journey 重播踩雷（戰鬥） | 一步一確認；關鍵字 pause list |
| multi-tab 寫同一 store | profileKey + tabId 隔離幀；pins 可 per-profile 共享 |
| 效能（大幀複製） | 節流 capture（≥200ms）；WebWorker 可選 C1 |

---

## 8. Moonshot backlog（本 plan 不實作）

| 構想 | 來源 | 備註 |
|------|------|------|
| Probabilistic Navigation Memory | gpt-5.6-sol | 需大量 journey + 確認迴路 |
| Crowd stitch / heatmap | GLM / MiniMax | 隱私、冷啟動、ToS |
| NL「上次賣藥的在哪」 | Qwen | IndexedDB 全文即可先做輕量版於 C1.4 延伸 |
| Haptics / 音效出口 | Kimi | a11y 可選 |

Crowd **資料模型草稿**（僅文件）：

```ts
// NOT IMPLEMENTED — future
type AnonTrailShare = {
  profileHostHash: string;  // not raw account
  steps: Array<{ titleNorm: string; dir: string }>;
  // no exact coords claim
};
```

---

## 9. Implement order (when approved)

```text
C0.1 snapshot API
  → C0.2–C0.3 frame store + capture
  → C0.4–C0.6 Companion UI + pins
  → C0.7–C0.9 i18n + fixtures + pre-smoke
C1 journeys + search + stitch proto
C2 expedition + diff alert
```

**建議 ship 節奏**：C0 單獨可 ship；C1/C2 各一 PR 或一 plan 增量。

---

## 10. Open questions（Board）

1. **自動 map_d 偵測**：P0 是否接受「僅手動釘住 + 粗暴 CUP burst」？還是必須等精確 SAVEC 狀態機？  
2. **IndexedDB vs localStorage-only**：是否接受新依賴 `idb` 小包／自寫 IDB wrapper？  
3. **Stitch 預設**：C1 進 develop 但是否 hidden behind `localStorage assmud.stitch=1`？  
4. **Journey 重播**是否允許「連續送 N 步（N≤5）需二次確認」捷徑？  
5. **hetero plan review**：本 plan 是否跑 Codex+MiniMax/GLM 一輪 ALL_CLEAR 再 impl？（建議 **是**）

---

## 11. Success metrics（定性 + 可選定量）

| 指標 | 目標 |
|------|------|
| 嘲諷「假地圖」 | 城圖 tab 顯示官方幀後消失 |
| map_d 回歸 | 0 已知 VT 破壞 |
| Companion 使用 | 開 map 後側欄城圖有幀的 session 比例（自測） |
| Journey | 至少 1 條玩家自建「常用路線」可重播 |
| Stitch | prototype 錄影可 demo；不要求生產級對齊 |

---

## 12. References

- Hetero synthesis: `docs/reviews/2026-07-22-mapd-automap-hetero-brainstorm.md`  
- Raw: `docs/reviews/2026-07-22-mapd-brainstorm-{glm52,minimax,kimi,qwen38,gpt56sol}.out`  
- Nav Shell shipped: `docs/plans/2026-07-22-automap-nav-shell.md`  
- RW map_d: `docs/research/rw-ansi-and-map-controls.md`  

---

## 13. Status transitions

| Status | When |
|--------|------|
| **draft** | now |
| **approved** | user + optional hetero ALL_CLEAR on this plan text |
| **impl C0** | after approved |
| **SHIP C0** | pre-smoke + manual map_d smoke |
| **impl C1/C2** | after C0 SHIP or parallel if capacity |

**Decision needed from owner**：確認 §10 開放問題 → 標 **approved** → 開 C0 實作。
