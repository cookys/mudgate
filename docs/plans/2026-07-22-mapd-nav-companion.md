# Plan — map_d Nav Companion（導航副駕）

> **Status**: **SHIP C0** (2026-07-22) · unit+build+pre-smoke PASS · plan-hetero ALL_CLEAR R4



> **Owner**: cookys  
> **Date**: 2026-07-22  
> **Extends**: [`2026-07-22-automap-nav-shell.md`](./2026-07-22-automap-nav-shell.md)（P1 Nav Shell **已 SHIP**）  
> **Research**:  
> - [`docs/research/2026-07-22-automap-chinese-first.md`](../research/2026-07-22-automap-chinese-first.md)  
> - [`docs/research/rw-ansi-and-map-controls.md`](../research/rw-ansi-and-map-controls.md)  
> - Brainstorm hetero: [`docs/reviews/2026-07-22-mapd-automap-hetero-brainstorm.md`](../reviews/2026-07-22-mapd-automap-hetero-brainstorm.md)  
> - **Plan hetero R1**: [`docs/reviews/2026-07-22-mapd-companion-plan-hetero-r1.md`](../reviews/2026-07-22-mapd-companion-plan-hetero-r1.md)

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

### 2.2 map_d 活躍偵測（C0 契約 · R1 fold）

**問題**：何時把 live buffer 當成「地圖候選幀」？

| 訊號 | C0 | 契約 |
|------|----|------|
| A. CUP burst | **必做 auto** | 見下方 **BurstDetector v0** |
| B. SAVEC…REST | **不**當 C0 硬依賴 | fixture 可記錄；完整 state machine → C1 |
| C. 手動釘住 | **必做** | 永遠可用；見 2.2.2 標籤 |
| D. 框線密度 | C1+ | — |

#### 2.2.1 BurstDetector v0（可測、可假陽性 · R2 fold）

**Hook 鎖定（唯一）**：TerminalHost / ScreenBuffer **SHALL emit**  
`{ type: "cup-abs", row: number, at: number }` on absolute CUP.  
**buf-mut**：TerminalHost 提供 `setMapCaptureArmed(boolean)`；僅 `true` 時 cell-mutating write emit `{ type: "buf-mut", at }`。web 在 armed 升降時呼叫（terminal 不讀 web 狀態以外的耦合）。

```text
windowMs = 400
minDistinctCupRows = 6
settleQuietMs = 80
minIntervalMs = 250
lastCaptureAt = -Infinity   // 首幀不受 interval 擋

on cup-abs (if autoDetectEnabled):
  add row to set; drop rows with at < now-windowMs
  if |set| >= minDistinctCupRows:
    armed = true; setMapCaptureArmed(true)
    reset settleTimer(settleQuietMs)
on cup-abs OR buf-mut while armed:
  reset settleTimer(settleQuietMs)

function tryCapture():
  if !autoDetectEnabled || !armed: return
  if now - lastCaptureAt < minIntervalMs:
    schedule one-shot retryTimer at lastCaptureAt+minIntervalMs
    return
  result = persistSnapshot({ source: "auto-burst", confidence: "inferred" })
  // persist 失敗：不寫 lastMapFrameId（§2.3.2）
  if result.ok:
    lastMapFrameId[tabId] = result.id
    lastCaptureAt = now
  armed = false; setMapCaptureArmed(false)
  clear row set
  cancel retryTimer + settleTimer

on settleTimer fire: tryCapture()
on retryTimer fire: tryCapture()   // interval 已滿足；與 settle 同一路徑
on autoDetect disable: armed=false; setMapCaptureArmed(false); cancel timers
```

| 規則 | |
|------|--|
| 假陽性 | 允許；可刪 |
| 假陰性 | 手動釘住 |
| auto off | 永不 armed |
| 半幅 | settle = **無 cup-abs 且無 buf-mut** 連續 settleQuietMs |

**C0.3 + C0.8 必含 fixtures（ship gate）**

| # | 輸入 | 期望 |
|---|------|------|
| P1 | ≥6 distinct CUP → quiet（無 cup/buf-mut）≥settleQuietMs | 1 frame；cells 匹配 quiet 後 |
| **P2** | ≥6 CUP → **繼續 buf-mut 改字** → 再 quiet | frame == **最終** buffer |
| P3 | settle 時仍在 minInterval 內 | 延遲到 interval 後仍 capture 一次（不 stuck armed 永久） |
| N1 | 單次 CUP / 普通 scroll | 0 |
| N2 | auto off | 0 |

#### 2.2.2 手動「釘住目前終端畫面」

| 項目 | 契約 |
|------|------|
| 行為 | 複製 **當下整屏** cells（可能是聊天／非地圖） |
| `source` | `"manual-capture"` |
| `confidence` | `"user"` |
| UI 徽章 | **只**顯示「終端快照」— **禁止**「官方／城圖」字樣 |
| 成 lastMapFrame？ | 是（該 tab 顯示來源）；**預設 tab 不因 manual 強制切到城圖**（使用者已在城圖按釘住才更新顯示） |
| auto 幀徽章 | **「自動擷取 · 推測」** — **禁止**「官方幀」（R2：CUP 密度 ≠ 官方斷言） |
| UX 一句 | 「會保存目前可見的終端文字／畫面」 |

### 2.3 Frame 資料模型（R1 fold）

```ts
type FrameConfidence = "inferred" | "user" | "official-hint";
// official-hint reserved C1+ if SAVEC path lands; C0 only inferred|user

type MapFrameCell = {
  ch: string;
  /** null = default/unspecified; preserve what ScreenBuffer stores */
  fg: number | null;
  bg: number | null;
  bold: boolean;
  inverse: boolean;   // SGR 7 — map_d borders often use reverse
  /** wide glyph: lead cell has ch; trail cell ch === "" and wideCont=true */
  wideCont: boolean;
};

type MapFrame = {
  v: 1;                     // schema version — required
  id: string;
  capturedAt: number;
  cols: number;
  rows: number;
  cells: MapFrameCell[];    // length === cols*rows, row-major
  widthMode: "cjk" | "western"; // copy from ScreenBuffer at capture
  fingerprint: string;      // C0: always "" (compute in C1.5); field reserved
  source: "auto-burst" | "manual-capture" | "stitch-tile";
  confidence: FrameConfidence;
  profileKey: string;       // **profile.id only** (not host:port)
  tabId: string;            // capturing tab; lastMapFrame is memory-per-tab
  label?: string;
  protected: boolean;       // true if user froze/favorited — LRU skip
};

type MapPin = {
  v: 1;
  id: string;
  frameId: string;
  r: number;                // 0-based row, 0 <= r < frame.rows
  c: number;                // 0-based col, 0 <= c < frame.cols
  text: string;
  createdAt: number;
  profileKey: string;
};

type Journey = {
  v: 1;
  id: string;
  name: string;
  profileKey: string;
  steps: Array<{
    cmd: string;
    at: number;
    frameId?: string;
    titleHint?: string;
  }>;
  createdAt: number;
  updatedAt: number;
};
```

### 2.3.1 Snapshot fidelity（C0.1 契約）

`ScreenBuffer.snapshotCells()` **必須**：

- Deep clone；後續 `writeDecoded` **不**改變已 snapshot 物件  
- 含 blank cells、`wideCont`、fg/bg/bold/**inverse**  
- 不含 cursor 位置於 cells（cursor 可選 metadata，C0 可不渲染）  
- `widthMode` 與 buffer 當下一致  
- resize 後新 snapshot 用新尺寸；舊 frame 保留原 cols/rows  

### 2.3.2 Storage（選定 · R2 fold）

| 項目 | C0 鎖定 |
|------|---------|
| Backend | **IndexedDB** DB name `assmud-nav` v1；thin wrapper |
| Object stores created in C0 | `frames` · `pins` · `meta`（meta 可空；journeys 寫入 C1） |
| `MAX_FRAMES_PER_PROFILE` | **30** 含 protected（protected 佔名額但不被 LRU 刪） |
| Key paths | `frames`: keyPath `id`；index `byProfile`=`profileKey`；index `byProfileTime`=`[profileKey, capturedAt]` |
| | `pins`: keyPath `id`；index `byFrame`=`frameId`；index `byProfile`=`profileKey` |
| | `meta`: keyPath `key`（string），C0 可空 |
| 寫入事務 | **一 txn**：count byProfile → if ≥MAX **只驅逐 1 個**最舊 unprotected（cascade pins）→ put；commit 後才更新 lastMapFrameId |
| LRU 候選 | unprotected only；protected 計入 MAX |
| 全 protected 且已滿 | 不 put；toast `map.companion.storageFull`（**≥10s 節流**）；不改 lastMapFrameId |
| pin delete cascade | 同 txn；toast `map.companion.frameDeleted` |
| QuotaExceeded | abort → 新 txn 驅逐 **1** unprotected → 新 txn put **最多再 1 次**；仍失敗 toast、不改 id |
| 跨 tab MAX | per-txn best-effort；並發下可能短暫 >30，C0 可接受 soft cap |
| profile 隔離 | 所有 query `profileKey === activeProfile.id` |
| 清除 | confirm → 刪該 profile frames+pins |
| 隱私 | 本機、共用電腦可見；非 vault |

### 2.3.3 Multi-tab（C0 · R2 fold）

| 規則 | |
|------|--|
| `lastMapFrameId` | **僅 memory per tab** |
| IDB frames | 同 profile 共享；寫入走 **§2.3.2 單事務**（跨 tab 仍可能交錯，但每事務內 MAX 不破） |
| 顯示幀被他 tab 刪 | 偵測 get(frameId) miss → 空狀態 + i18n「幀已清除」；不崩潰 |
| 關 tab | memory 丟；IDB 留 |
| BroadcastChannel | C0 不做 |

### 2.3.4 Companion「即時」契約（C0）

| 模式 | 行為 |
|------|------|
| 即時 | 顯示該 tab `lastMapFrameId` 指向之快照；**非** 60fps live |
| 新 auto capture | 更新 lastMapFrameId → **pins 只畫當前 frameId**；舊幀 pins 不顯示（要註記請先凍結） |
| 凍結 | `protected=true`；顯示鎖定該 id；auto **不**改顯示 |
| 徽章 | auto →「自動擷取 · 推測」；manual →「終端快照」；**無「官方」** |
| 空狀態 | i18n 引導釘住／開城圖 |

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
| **C0.1** | `snapshotCells()` 符合 §2.3.1 | unit：clone 免疫後續 write；wideCont + inverse 保留 |
| **C0.2** | 手動 capture → IDB；標 `manual-capture` / `user` | 重載可見；文案非「官方城圖」 |
| **C0.3** | BurstDetector | fixtures **P1/P2/P3/N1/N2** 全過；關 auto 永不更新；失敗路徑不設假 id |
| **C0.4** | 城圖 tab 渲染 | canvas 2d；**cell 盒 = 與終端相同 monospace 度量 @1×**；2×=整數倍；色：複用 terminal 既有 16/256 SGR→RGB helper（若無則抽一份 shared）；徽章依 source；空狀態 `map.companion.empty` |
| **C0.5** | freeze / 解凍 | freeze→protected；解凍後 **仍顯示該 frame** 直到使用者選「即時」才跟 lastMapFrameId；1×/2×+pan |
| **C0.6** | Pin CRUD | click 空 cell→modal 新建；click **既有 pin**→同一 modal 編輯；文字 **trim 後 1–200 字**、禁止空；**純文字渲染**（React text node / 禁 HTML）；列表可刪；0-based bounds；手機 C1 |
| **C0.7** | i18n | 含 `map.companion.empty` / `storageFull` / `frameDeleted` / `frameGone` / 徽章鍵 / 隱私小字 |
| **C0.8** | Fixtures | **必須**含 P1+**P2**+P3+N1+N2；格式：測試內建構 CUP/write 序列（同 terminal test 風格），非外部神秘 bin |
| **C0.9** | 零回歸 | `packages/terminal/tests/map-vt.test.ts` + `tests/e2e/golden-streams.test.ts` + `scripts/pre-smoke-check.sh` PASS |
| **C0.10** | 清除本 profile 導航資料 | confirm 後刪 frames+pins |

**C0 不做**：stitch、journey 錄/重播、expedition、群眾、尋路、BroadcastChannel、SAVEC 完整狀態機。

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
[ 即時 | 凍結 ]  [釘住終端]  [清除本檔資料]
徽章：自動擷取·推測 | 終端快照   ← 依 source，禁止「官方」
┌─────────────────────────┐
│  cell canvas（拖/1×2×）   │
│  pins 僅當前 frameId     │
└─────────────────────────┘
非 client 重建拓樸 · 本機儲存
```

### 4.2 信心圖例（全側欄共用）

| 標籤 | 含義 | 顏色/形狀 |
|------|------|-----------|
| 自動擷取 · 推測 | auto-burst frame | 虛線 / inferred 色 |
| 終端快照 | manual-capture | 實線 user 色 |
| 已凍結 | protected 顯示中 | 鎖圖示 |
| 已驗證出口 | nearby HUD parse | accent |
| 推測足跡 | trail | 虛線 |
| 未知 | 無資料 | dim |

**禁止**在 C0 UI 使用「官方幀／官方地圖」稱呼任何 client 快照（含凍結）。

### 4.3 預設模式（RW profile）

| 狀態 | 預設 tab |
|------|----------|
| 有 lastMapFrame（auto-burst 或手動） | **城圖**（或記住使用者上次 tab） |
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
| Unit（C0） | snapshot immutability；wideCont/inverse；BurstDetector **P1/P2/P3/N1/N2** + N3 auto-off mid-retry；pin bounds；IDB 滿+全 protected；cascade delete |
| Fixture | synthetic map_d sequence（SAVEC + CUP rows + REST）→ auto 更新 lastMapFrame |
| Regression | `packages/terminal/tests/map-vt.test.ts`；e2e golden streams |
| Manual smoke（**僅 C0**） | 開 map → auto 或釘住見幀；freeze；釘 pin；關 map 仍見凍結；清除 profile 資料；**不含**旅程 |
| pre-smoke | 既有 script PASS |

**高精度定義（延續 research）**：顯示與可走一致；server map_d（終端）與 client 快照／足跡 UI **視覺與文案分離**；不一致標未知。

---

## 7. Risks & mitigations

| 風險 | 緩解 |
|------|------|
| map_d 偵測假陽性／假陰性 | 手動釘住為 P0 權威；auto 可關 |
| IndexedDB 配額 | LRU；限制幀數與解析度（可存 attrs 子集） |
| Stitch 對不齊 | 實驗標 + 一鍵清空；不進預設 on |
| Journey 重播踩雷（戰鬥） | 一步一確認；關鍵字 pause list |
| multi-tab 寫同一 store | profileKey + tabId 隔離幀；pins 可 per-profile 共享 |
| 效能（大幀複製） | 節流 = `minIntervalMs=250`；WebWorker 可選 C1 |
| auto toast 洗版 | storageFull toast **最多每 10s 一次** |

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

### 10.1 R1 已關閉（寫死）

| # | 決議 |
|---|------|
| Q1 偵測 | C0 = BurstDetector v0 + 手動 capture；**不**等 SAVEC 狀態機 |
| Q2 儲存 | IndexedDB `assmud-nav`；thin wrapper；MAX 30；protected 免疫 LRU |
| Q3 stitch | C1 預設 **關**；`assmud.nav.stitch=1` 才啟用 |
| profileKey | **profile.id only** |
| C0 縮放 | 僅 1×/2× + pan |

### 10.2 仍開（不挡 C0 若採預設）

| # | 問題 | 預設若 owner 不回 |
|---|------|-------------------|
| Q4 | Journey 重播允許「≤5 步二次確認連送」？ | **否**（一步一確認） |
| Q5 | plan-hetero ALL_CLEAR 才 impl？ | **是** — 本 loop 跑到全非 BLOCK |

---

## 11. Success metrics（定性 + 可選定量）

| 指標 | 目標 |
|------|------|
| 嘲諷「假地圖」 | 城圖 tab 顯示可釘/可凍結的終端幀且徽章誠實 |
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
| **approved** | **R4 ALL_CLEAR** (2026-07-22) |
| **impl C0** | **done** (code + unit/e2e; 2026-07-22) |
| **SHIP C0** | **done** (pre-smoke RESULT=PASS + dual `npm test` + web build + LAN entry probes; optional human map_d UX) |
| **impl C1/C2** | after C0 SHIP or parallel if capacity |

