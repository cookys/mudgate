# Terminal fonts — Big5 / RW map alignment

> Linked from i18n+UI plans. **RW（重生）地圖、框線、全形符號極度依賴「半形 1 格、全形 2 格」**。  
> Canvas renderer 必須用 **dual-width mono**（CJK advance ≈ 2 × ASCII advance），否則 map_d / 框線會歪。  
> **Status**: approved spec · **next implement**（未在 2026-07-21 shell ship）

## 0. Board / UX decision — 試掘（trial）怎麼做最好？

### 0.1 結論（寫進產品，不要只給 3 個推薦）

| 做法 | 評價 | 採納 |
|------|------|------|
| 只內建 2–3 個「我們覺得最好」 | 省事，但 RW 玩家對細明／更紗／思源偏好差很大 | ❌ 當唯一路徑 |
| **全列可選 catalog** + 標籤（對齊／授權／來源） | 透明、可自己挑 | ✅ **主路徑** |
| **並排比較（A\|B 試掘）** 同一段 map sample | 最能「看出誰不歪」 | ✅ **預設開試掘面板** |
| 自動 `document.fonts` / 系統已安裝探測 | 本機細明體、Sarasa 免下載也能出現 | ✅ catalog 動態合併 |
| 一次 CDN 載入全部 CJK mono | 體積爆炸 | ❌ 僅 **on-demand** 載入選中的 webfont |

**產品句**：  
> 終端字體 = **可捲動的完整清單（bundled + 系統偵測 + 自訂）**，外加 **並排試掘** 與 **1:2 對齊分數**；預設推薦標在第一列，但不鎖定。

### 0.2 試掘 UX（Drawer → Terminal type 或獨立「試掘」）

```
┌─ 終端字體試掘 ─────────────────────────────────────┐
│ Sample: map_d 框線 + 中英混排 + Big5 標點（固定 fixture） │
│ ┌──────────────┐  ┌──────────────┐                  │
│ │ A: Sarasa    │  │ B: 細明體    │  ← 即時 canvas    │
│ │ score 1.99   │  │ score 2.00   │                  │
│ └──────────────┘  └──────────────┘                  │
│ [套用 A] [套用 B]   字級 ─●─  字寬 ─●─  行高 ─●─      │
│ ───────────────────────────────────────────────── │
│ Catalog（正體 mono 優先）                            │
│ ★ Sarasa Term TC     dual-width · OFL · bundled?  │
│   Sarasa Mono TC     …                              │
│   Source Han Mono TW …                              │
│   Noto Sans Mono CJK TC                             │
│   MingLiU / PMingLiU （系統）  detected ✓            │
│   …                                                 │
│   + 自訂 CSS font-family…                           │
└─────────────────────────────────────────────────────┘
```

Acceptance（試掘）：

1. 切 catalog 任一列 → sample **&lt;100ms** 重繪（已載入字）或顯示 loading 再繪。  
2. 每列顯示 **alignScore** = `measureText('中')/measureText('M')`（綠 ≈2.0、黃、紅）。  
3. 可 **A/B 釘選** 兩個 preset 並排。  
4. 「套用」才寫 `localStorage.assmud.termFont`；取消不污染。  
5. 未安裝 / 未 bundle 的 webfont：列上標 **需載入**，點選才 fetch。

## 1. 為什麼一般「等寬英文字」不夠

| 字體 | 問題 |
|------|------|
| JetBrains Mono / Fira Code / Cascadia | 幾乎只有西文；CJK fallback 到 Noto 後 **寬度比不保證 1:2** |
| 系統「等寬」混搭 | 半形與全形 advance 不整除 → 地圖裂縫 |
| 只調 CSS `letter-spacing` | 無法修正「全形應佔兩格 cell」的 buffer 模型 |

assmud 的 `ScreenBuffer` 是 **cell grid**（一中文常佔 2 columns）。Renderer 的 `cellW` 必須讓：

```
width(ASCII) ≈ cellW
width(CJK / 全形標點 / 許多框線) ≈ 2 × cellW
```

## 1.1 三件事：無中文字型 · TC fallback chain · 使用者自選（**必須支援**）

> 早期 draft 偏「選一個 dual-width 全家」；產品現實是：**西文好看字常常沒中文**，中文要 **TC 鏈** 接住，且 **user 一定要能自己填**。

### A. 字型「不含中文」（Latin-only mono）

| 行為 | 規格 |
|------|------|
| 允許當 **主西文字** | ✅ 可選 JetBrains / Cascadia / Iosevka / 自訂 Latin mono |
| 單獨當 **唯一** canvas family | ❌ 試掘紅燈：CJK 會吃系統亂 fallback，map 必歪 |
| 正確用法 | **主字（Latin）+ TC CJK fallback chain** 組成 stack（§1.2） |
| 探測 | `measureText` / 缺字：對 `中`、`國`、`▲`、框線抽樣；coverage &lt; 閾值 → 標「無／少中文，將用 fallback」 |

### B. TC fallback chain（正體優先鏈，不是單一 family）

Canvas / CSS 最終永遠是 **有序 stack**，不是一個名字：

```
fontStack = [
  primary,           // user 選的主字（可 Latin-only 或 CJK mono）
  ...userExtras[],   // user 自訂後備（可空）
  ...tcChain,        // 產品內建正體 dual-width 鏈（可配置）
  "monospace"
]
```

**預設 `tcChain`（正體 / Big5 / map 友善，前到後）：**

1. `Sarasa Term TC`（若已 bundle / 已載入）  
2. `Sarasa Mono TC`  
3. `MingLiU` / `細明體` / `PMingLiU` / `新細明體`（系統）  
4. `MingLiU_HKSCS`（若在）  
5. `Source Han Mono TW` / `Noto Sans Mono CJK TC`  
6. `Noto Sans Mono CJK` / `Noto Sans CJK TC`（最後防線，可能 1:2 較差 → 試掘黃燈）

- **zh-CN UI** 時 `tcChain` 可換成 SC 變體在前，但 **TC 鏈仍保留在後**（繁簡混服、RW 仍可能出繁中）。  
- **alignScore** 必須對 **整條 stack 解析後實際繪出的字** 測（canvas 用第一個有 glyph 的 face——實作時用 offscreen 分 face 測 primary vs fallback 兩段分數並顯示）。  
- Catalog 每一列可顯示：`primary` + `chain preview` 字串。

### C. 使用者自行選擇字體

| 能力 | 規格 |
|------|------|
| Catalog 點選 | ✅ bundled + 系統 detected |
| **自訂 primary** | ✅ 輸入任意 CSS `font-family` 名（本機已安裝即可） |
| **自訂整段 stack** | ✅ 進階：逗號分隔 family 列表，覆寫／插在 tcChain 前 |
| **關閉內建 tcChain** | ✅ 進階開關「僅用我指定的字」（警告：缺中文會豆腐／歪 map） |
| 持久化 | `assmud.termFont.primary` + `extras[]` + `useDefaultTcChain: boolean` + metrics sliders |
| 試掘 | 自訂也可進 A/B；套用前必跑 coverage + alignScore |

**最小設定模型（實作）：**

```ts
type TermFontConfig = {
  primary: string;              // e.g. "JetBrains Mono" | "Sarasa Term TC" | custom
  extras?: string[];            // user fallbacks before product chain
  useDefaultTcChain?: boolean;  // default true
  // + fontSizePx, cellWidthScale, lineHeightScale, letterSpacingPx, ligatures
};
// resolvedCss = [primary, ...extras, ...(useDefaultTcChain ? tcChain : []), "monospace"]
```

## 2. Catalog — 正體中文可用 mono（盡量列全，給 user 自選）

> **原則**：catalog **全列**；「★ 推薦」只是排序權重與預設，不是唯一選項。  
> 實作資料：`apps/web/src/termFonts/catalog.ts`（id / family / region / source / license / tags）。

### 2.1 開源 · 可 self-host / 可下載（正體或 CJK 含 TC）

| id | 顯示名 | CSS `font-family` 候選 | 區域 | 1:2 | 授權 | 備註 |
|----|--------|------------------------|------|-----|------|------|
| `sarasa-term-tc` | ★ Sarasa Term TC | `Sarasa Term TC` | TW | 優 | OFL | **預設推薦**；終端、少連字 |
| `sarasa-mono-tc` | ★ Sarasa Mono TC | `Sarasa Mono TC` | TW | 優 | OFL | 程式感；map 通常穩 |
| `sarasa-term-hc` | Sarasa Term HC | `Sarasa Term HC` | HK | 優 | OFL | 港字形；可給 HK 玩家 |
| `sarasa-mono-hc` | Sarasa Mono HC | `Sarasa Mono HC` | HK | 優 | OFL | |
| `sarasa-ui-tc` | Sarasa UI TC | `Sarasa UI TC` | TW | 中 | OFL | UI 向；終端次選 |
| `source-han-mono-tw` | Source Han Mono TW | `Source Han Mono TW` | TW | 優–中 | OFL | 思源等寬；檔大 |
| `source-han-mono-hc` | Source Han Mono HC | `Source Han Mono HC` | HK | 優–中 | OFL | |
| `noto-sans-mono-cjk-tc` | Noto Sans Mono CJK TC | `Noto Sans Mono CJK TC` | TW | 中 | OFL | CDN 友好 |
| `maple-mono-nl` | Maple Mono NL | `Maple Mono NL` / `Maple Mono` | SC 主、可排 CJK | 優* | OFL | *靠加寬中文；**關 ligature** |
| `iosevka-term-ss*` | Iosevka Term + CJK fallback | `Iosevka Term` | — | 視 fallback | OFL | 西文美；**必須**配 CJK dual-width |
| `unifont` | GNU Unifont | `Unifont` | 全 | 方塊穩 | GPL/OFL-ish | 醜但覆蓋廣；除錯用 |

\* Maple 的 1:2 機制與 Sarasa 不同（見 feeshy 文）；仍列入 catalog，試掘分數說話。

### 2.2 系統字（執行時 `document.fonts.check` / canvas 探測；有才顯示「已安裝」）

| id | 顯示名 | 典型 family 名 | 平台 | 1:2 | 備註 |
|----|--------|----------------|------|-----|------|
| `mingliu` | 細明體 MingLiU | `MingLiU`, `細明體` | Win | 優（傳統 BBS） | RW 老玩家常愛 |
| `pmingliu` | 新細明體 PMingLiU | `PMingLiU`, `新細明體` | Win | 優 | |
| `mingliu-extb` | MingLiU-ExtB | `MingLiU-ExtB` | Win | 視字 | 擴展區 |
| `mingliu_hkscs` | 細明體_HKSCS | `MingLiU_HKSCS` | Win | 優 | HKSCS |
| `lihei-pro` | 儷黑 Pro | `LiHei Pro` | macOS 舊 | 中 | 探測到再列 |
| `pingfang-tc-mono-fallback` | （勿當主字） | — | — | 差 | **不進可選主列表**；僅警告 |
| `noto-sans-mono-cjk-tc-sys` | 系統 Noto Mono CJK | 同名 | 各 | 中 | Linux 包常見 |
| `wenquanyi-microhei-mono` | 文泉驛微米黑等寬 | `WenQuanYi Micro Hei Mono` | Linux | 中 | |
| `droid-sans-fallback` | Droid Sans Fallback | … | Android | 差–中 | 通常非真 mono |

### 2.3 簡體側（zh-CN 預設用；正體 UI 仍可選）

| id | 名 | 備註 |
|----|-----|------|
| `sarasa-term-sc` / `sarasa-mono-sc` | Sarasa SC | |
| `source-han-mono-cn` | 思源等寬 CN | |
| `maple-mono-cn` | Maple Mono CN | |

### 2.4 明確 **不** 當終端主字（catalog 可「進階顯示」但預設隱藏 + 紅燈）

- JetBrains Mono / Fira Code / Cascadia / Consolas **單獨**使用（無 dual-width CJK）  
- 蘋方、思源黑體 **比例** 家族當 canvas 主字  
- 霞鶩文楷等楷體主導（框線易飄）  

### 2.5 預設與排序權重（仍「全列」）

```
sort = 
  recommended first (sarasa-term-tc, sarasa-mono-tc, mingliu if detected)
  then dual-width OFL bundled
  then system-detected
  then others by name
```

**zh-TW 冷啟動預設**：`sarasa-term-tc`（若未 bundle 且系統有 `MingLiU` → 可暫用細明並提示「建議載入更紗」）。

## 3. Web 載入策略（實作約束）

1. **預設 self-host 或可快取 CDN** 單一 subset（TC Regular ~ 視 subset 而定）  
2. `font-display: swap` + 載入前用 **metrics 探測**（見下）  
3. 使用者可選「系統字體堆疊」減少流量  
4. 與 UI chrome 字體分離：  
   - **UI**: DM Sans + Noto Sans TC（可比例）  
   - **Terminal canvas**: 僅 dual-width mono 堆疊  

## 4. 字體切換 + 字寬字距（產品能力）

### 4.1 設定項（localStorage `assmud.termFont`）

| Key | 型別 | 說明 |
|-----|------|------|
| `preset` | id | **catalog 任一 id** 或 `custom`（見 §2，勿鎖死少數 enum） |
| `fontFamily` | string | custom 或解析後的 CSS stack |
| `fontSizePx` | number | 預設 14–16；影響 `cellH` |
| `cellWidthScale` | number | 0.85–1.25，乘在測得的半形寬 |
| `lineHeightScale` | number | 1.0–1.4，`cellH = fontSize * scale` |
| `letterSpacingPx` | number | 額外半形字距（**小心**：過大破壞 1:2） |
| `ligatures` | boolean | **預設 false**（MUD） |
| `compareA` / `compareB` | id? | 試掘釘選（可選持久化） |

### 4.2 Renderer 契約（`Canvas2DRenderer`）

1. `setTypography({ fontFamily, fontSizePx, cellWidthScale, lineHeightScale, letterSpacingPx })`  
2. 用離屏 canvas `measureText('M')` 與 `measureText('中')`：  
   - 若 `w中 / wM` ∉ `[1.85, 2.15]` → UI 警告「此字體可能無法對齊地圖」並仍允許使用  
3. `cellW = wM * cellWidthScale (+ letterSpacing 策略)`  
4. `cellH = fontSize * lineHeightScale`  
5. 全形字元繪製時 **水平佔 2 cell**（與 buffer 雙寬模型一致；若 buffer 已處理 WCWidth 則 follow buffer）

### 4.3 UX 放置（與 §0 一致）

| 入口 | 內容 |
|------|------|
| Drawer → **終端顯示** | 目前套用 preset 摘要 +「開啟試掘」 |
| **試掘面板**（modal 或全高 sheet） | catalog 全列 + A/B 並排 + 對齊分數 + 套用 |
| 快捷 | 設定內搜尋字體名（filter catalog） |

- 即時預覽 fixture：框線 `┌─┐│└─` + `中英AB` + 一截 synthetic map（可重用 `tests/fixtures`）  
- **不需要** 為換字體重連 MUD  

### 4.4 系統字探測

```ts
// pseudo
async function detectSystemMono(): Promise<CatalogEntry[]> {
  const candidates = SYSTEM_TC_MONO_CANDIDATES; // §2.2
  return candidates.filter((e) => document.fonts.check(`16px "${e.family}"`)
    || measureCanvasHasGlyph(e.family, "中"));
}
```

Catalog = **static bundled list** ∪ **detected system** ∪ **user custom**（去重 by id）。

## 5. 與語系的關係

| Locale | 建議預設 terminal preset |
|--------|-------------------------|
| `zh-TW` | `sarasa-tc` / `sarasa-term-tc` |
| `zh-CN` | `sarasa-sc` 或 `source-han-mono-cn` / `maple-nl` |
| `en` | 仍建議 CJK-capable mono（多 MUD 仍有中文）；可 `sarasa-tc` 或 `noto-mono-cjk` |

語系切換 **可** 提示「是否套用該語系建議字體」，但 **不要** 強制覆寫使用者已自訂的 preset。

## 6. Phase 建議（可併 terminal polish）

| Phase | Work |
|-------|------|
| **F0** | Catalog 資料結構 + §2 列表進 `catalog.ts`；授權/self-host 策略 |
| **F1** | Renderer `setTypography` + `alignScore` measure |
| **F2** | **試掘 UX**：全列 catalog + A/B 並排 + 套用；系統字探測 |
| **F3** | on-demand webfont（Sarasa Term TC subset 優先 self-host） |
| **F4** | 字級/字寬/行高 sliders + 重設；與 locale 建議連動（不強制） |

**SHIP 字體的條件**：F0–F2 必達（可選字、可試掘、有分數）；F3 可「未 bundle 則引導本機安裝」。

## 7. 這份有沒有在「目前 plan」裡？

| 文件 | 有無試掘／全列 |
|------|----------------|
| `docs/design/terminal-fonts.md`（本檔） | ✅ **規格本體**（2026-07-21 補 §0 試掘 + §2 全 catalog） |
| `docs/plans/2026-07-21-ui-redesign.md` U+fonts | 🔗 連到本檔；先前只寫「可切換 + Sarasa」 |
| `docs/plans/2026-07-21-i18n-locale.md` | 🔗 字體與語系分離；**不**含 catalog 細節 |
| `docs/plans/2026-07-21-ui-shell-ship.md` | ❌ 明確 **未 ship** 字體 UI |
| 程式碼 | ❌ 尚無試掘／catalog（canvas 僅 fallback 字串） |

**答 user**：先前 plan **有**「可切字體 + 幾個推薦 preset + measure 警告」，**沒有**寫死「全列正體 mono + 並排試掘」；**現在已補進本 spec**，實作以 F2 為主。

## 8. 參考

- Sarasa: https://github.com/be5invis/Sarasa-Gothic  
- Source Han Mono: https://github.com/adobe-fonts/source-han-mono  
- Maple Mono: https://github.com/subframe7536/maple-font  
- Noto CJK: https://github.com/notofonts/noto-cjk  
- 中英 1:2 對齊整理: https://feeshy.github.io/lists/monospace-fonts-width  

