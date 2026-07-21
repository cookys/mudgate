# Terminal fonts — Big5 / RW map alignment

> Linked from i18n+UI plans. **RW（重生）地圖、框線、全形符號極度依賴「半形 1 格、全形 2 格」**。  
> Canvas renderer 必須用 **dual-width mono**（CJK advance ≈ 2 × ASCII advance），否則 map_d / 框線會歪。

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

## 2. 推薦字體（開源、適合 MUD / Big5 符號）

排序：**地圖對齊優先 → 觀感 → 體積 / 授權**。

### A. 首選 — 更紗等寬（Sarasa Mono）★

| | |
|--|--|
| **專案** | [Sarasa Gothic / 更紗黑體](https://github.com/be5invis/Sarasa-Gothic)（Iosevka + Source Han） |
| **變體** | **`Sarasa Mono TC`**（台灣正體）／ **`Sarasa Mono HC`**（香港）／ `Sarasa Mono SC`（簡體）／ `Sarasa Term *`（終端、少連字） |
| **為何適合 RW** | 專為「中文寬 = 英文 2 倍」的程式／終端場景；框線、半形標點、混排穩定 |
| **授權** | SIL OFL |
| **注意** | 完整家族大；web 建議 **subset 或 self-host 單一 weight（Regular/Medium）**，不要整包 Google 拉 |

**推薦預設（繁中玩家）**: `Sarasa Mono TC` 或 `Sarasa Term TC`（Term 較不易被連字搞亂 map）。

### B. 次選 — 思源等寬（Source Han Mono）

| | |
|--|--|
| **專案** | [source-han-mono](https://github.com/adobe-fonts/source-han-mono) 思源等寬 |
| **變體** | TW / HC / CN 區域 |
| **觀感** | 較「正式印刷」；西文來自 Source Code Pro 加寬思路 |
| **授權** | OFL |
| **注意** | 體積大；web 同樣要 subset |

### C. 觀感向 — Maple Mono CN

| | |
|--|--|
| **專案** | [Maple Mono](https://github.com/subframe7536/maple-font) |
| **特點** | 圓角、可讀性高；**中英 2:1 對齊**（以加寬中文間距達成） |
| **授權** | OFL |
| **注意** | 連字（ligature）**預設應關** 給 MUD map；選 **NL（no ligature）** 或 Term 變體 |

### D. 後備 / 系統

| 字體 | 場景 |
|------|------|
| **Noto Sans Mono CJK TC** | CDN 方便，對齊通常可用但不如 Sarasa 專精 terminal |
| **MingLiU / 細明體、新細明體**（Windows） | 傳統 BBS/MUD 玩家熟悉的「對齊感」；符號老派但 map 穩 |
| **蘋方／冬青** 等比例字 | **不要**當終端主字 — 會毀對齊 |

### E. 不建議當唯一終端字

- 純西文 mono + 任意 CJK fallback（現況 JetBrains + Noto 混用風險）  
- 手寫／楷體主導（霞鶩文楷等）：好看但 **地圖框線** 常不如 Gothic mono  

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
| `preset` | id | `sarasa-tc` \| `sarasa-term-tc` \| `source-han-mono-tw` \| `maple-nl` \| `noto-mono-cjk` \| `system-ming` \| `custom` |
| `fontFamily` | string | custom 時的 CSS family |
| `fontSizePx` | number | 預設 14–16；影響 `cellH` |
| `cellWidthScale` | number | 0.85–1.25，乘在測得的半形寬 |
| `lineHeightScale` | number | 1.0–1.4，`cellH = fontSize * scale` |
| `letterSpacingPx` | number | 額外半形字距（**小心**：過大破壞 1:2） |
| `ligatures` | boolean | **預設 false**（MUD） |

### 4.2 Renderer 契約（`Canvas2DRenderer`）

1. `setTypography({ fontFamily, fontSizePx, cellWidthScale, lineHeightScale, letterSpacingPx })`  
2. 用離屏 canvas `measureText('M')` 與 `measureText('中')`：  
   - 若 `w中 / wM` ∉ `[1.85, 2.15]` → UI 警告「此字體可能無法對齊地圖」並仍允許使用  
3. `cellW = wM * cellWidthScale (+ letterSpacing 策略)`  
4. `cellH = fontSize * lineHeightScale`  
5. 全形字元繪製時 **水平佔 2 cell**（與 buffer 雙寬模型一致；若 buffer 已處理 WCWidth 則 follow buffer）

### 4.3 UX 放置

- Drawer → **Terminal display** 區塊：字體 preset 下拉、字級 slider、行高、字寬微調、重設預設  
- 即時預覽：小 ASCII art / 框線 sample（`┌─┐│ └─` + `中英AB`）  
- **不需要** 為換字體重連 MUD  

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
| F0 | 凍結 preset 列表 + 授權/self-host 策略 |
| F1 | Renderer typography API + measure 警告 |
| F2 | Drawer 控制 + localStorage |
| F3 | Self-host Sarasa Term TC subset（或文件化「請本機安裝」dev 路徑） |

## 7. 參考

- Sarasa: https://github.com/be5invis/Sarasa-Gothic  
- Source Han Mono: https://github.com/adobe-fonts/source-han-mono  
- Maple Mono: https://github.com/subframe7536/maple-font  
- 中英 1:2 對齊整理: https://feeshy.github.io/lists/monospace-fonts-width  
