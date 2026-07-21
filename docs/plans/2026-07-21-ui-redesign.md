# Plan — UI redesign (modern terminal · MUD-native · RWD)

> **Status**: implementing (Board frozen 2026-07-21)  
> **Owner**: cookys  
> **Branch**: `feat/ui-redesign` (to cut from `develop`)  
> **Why**: 現介面被評為「太鳥」— 表單堆疊、終端像 demo、無明確視覺層級、RWD 僅勉強能用。  
> **Goal**: 用 2025–26 審美（dark minimal + 精準 accent）重做 shell，**終端仍是主角**，桌面/手機都好用。

---

## 0. Research notes (industry)

### 0.1 Modern terminal / IDE shells

| Source pattern | Takeaway for assmud |
|----------------|---------------------|
| **VS Code / Cursor / Warp / Hyper** | Near-black canvas (`#0d0d0f`–`#12141a`)；單一 accent（藍/青/琥珀）；chrome 極薄；等寬字優先 |
| **Dark mode as default (2025)** | 長時間閱讀以「低對比噪音 + 高對比語意色」為準，不是全灰糊成一團 |
| **Dribbble / Muzli dark UI** | 大留白、圓角 8–12px、1px hairline border、玻璃/霧面僅用在浮層不是整頁 |
| **Warp / modern terminals** | 輸入區是 **獨立 command bar**（有 send、history 暗示），不是塞在表單 grid 裡 |
| **Design tokens** | 色板 / 字級 / 間距系統化（CSS variables 或 Tailwind theme），禁止到處 hardcode |

### 0.2 Text MUD client layout (Mudlet et al.)

Mudlet 與傳統 zMUD 生態的 **實際使用布局**（非行銷話術）：

| Zone | Role | assmud 映射 |
|------|------|-------------|
| **Main output** | 最大、等寬、可捲、ANSI 色彩 | `TerminalHost` canvas — 必須佔主視覺 ≥60% 高度 |
| **Input bar** | 底欄固定、單行/可長、Enter 送出 | sticky bottom command bar |
| **Mapper** | 側欄或浮窗，可關 | 現有 client map → 可收合 side panel |
| **Chat / channels** | 可拆 tab 或第二窗 | Phase 後：channel split（本次可預留 slot） |
| **Connection** | 開機 dialog / 設定頁，**不要一直佔主畫面** | Connect 改 modal 或 drawer，連上後 chrome 收斂 |
| **Multi-game** | tabs | 保留 session tabs，視覺改成編輯器分頁風格 |

Mudlet 哲學重點：**主畫面 = 文字世界**；工具是週邊，不是搶戲的 dashboard。

### 0.3 既有 web MUD / 文字遊戲 UI 常見問題（我們要避開）

- 灰底 + 預設 system font → 廉價  
- 所有設定永遠展開 → 像後台表單  
- 終端區域太小 / 被工具列擠壓  
- 手機只有「能連」沒有拇指區（send / 方向鍵位置）  
- 無 focus 狀態、無連線語意色（連線中/斷線/錯誤同一灰）

### 0.4 我們的產品約束（不可破）

- 終端熱路徑仍是 **canvas buffer**（非 per-cell React）  
- 桌面 + 手機 **都要 RWD**，不宣稱手機 = 桌面 map 體驗  
- 開源 MIT；無重型 UI kit（可用 headless + 自寫 primitive）  
- Big5 / VT 完整度優先於花俏特效  

---

## 1. Problem

現 UI 問題（對照 code）：

1. **視覺**：zinc 灰堆疊、無設計 token、無字體層級、無品牌/產品感  
2. **資訊架構**：連線表單、token、profile、log、按鈕 **同一層永遠展開**  
3. **終端弱勢**：canvas 像附屬 demo，不是「進入遊戲的窗」  
4. **RWD**：grid 勉強折行，但手機缺底部安全區、方向鍵/快捷、全螢幕終端模式  
5. **狀態語意**：status 字串塞在副標，無 pill / 指示燈  

---

## 2. Design thesis

> **「一扇窗進世界」** — 連線後，畫面幾乎只有 **輸出 + 輸入**；設定、profile、map、腳本 退到 **可開關的邊欄 / drawer / modal**。  
> 審美：**ink terminal**（深墨底 + 單一 cyan/amber accent + 等寬正文），像現代 SSH client 遇上 Mudlet 主窗。

### 2.1 Visual direction (tokens)

| Token | Value (proposal) | Use |
|-------|------------------|-----|
| `--bg-void` | `#0a0b0e` | page |
| `--bg-panel` | `#12141a` | chrome panels |
| `--bg-elevated` | `#1a1d27` | inputs / cards |
| `--border` | `#2a2e3a` | hairline |
| `--text` | `#e8eaef` | primary |
| `--text-dim` | `#8b93a7` | secondary |
| `--accent` | `#3dffa8` or `#5b9dff` | **pick one** — recommend **mint** for MUD/「重生」生機感 |
| `--danger` | `#ff5c7a` | disconnect / error |
| `--ok` | `#3dffa8` | connected |
| `--warn` | `#ffc14d` | reconnecting |
| `--font-ui` | `"DM Sans", "Noto Sans TC", system-ui` | chrome |
| `--font-mono` | `"JetBrains Mono", "Sarasa Mono TC", ui-monospace` | terminal + input |
| Radius | 10px panel / 8px control | soft modern, not iOS 26 pill everything |
| Density | 8px grid | padding 12–16 mobile, 16–24 desktop |

**Avoid**: 霓虹賽博過載、整頁 glassmorphism、彩虹邊框、emoji 當主 icon。

### 2.2 Layout — desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────┐
│ [logo] assmud    [session tabs ……]     [● connected] [⚙] [?] │  40–48px topbar
├──────────────────────────────────────────────┬──────────────┤
│                                              │ Map / tools  │
│           TERMINAL CANVAS                    │ (collapsible │
│           (flex 1, min-height 0)             │  240–280px)  │
│                                              │              │
├──────────────────────────────────────────────┴──────────────┤
│ ⌨  input ………………………………………  [↑hist] [Send]   │  52–56px bar
│ [n][s][e][w]  ·  quick chips (optional row)                   │  mobile more, desktop optional
└─────────────────────────────────────────────────────────────┘
```

- **Settings / connect / token / profiles** → `⚙` 開 **right drawer** 或 **command palette (⌘K)**  
- **連線前**：居中 **Connect card**（hero 短文 + profile 選擇 + 一鍵進世界），不是滿版表單牆  

### 2.3 Layout — tablet (768–1023)

- Map 預設收合；topbar 保留 tabs  
- 終端全寬；drawer 覆蓋 40%  

### 2.4 Layout — mobile (<768)

```
┌──────────────────────┐
│ assmud    ●   ⚙  ☰  │  compact top
├──────────────────────┤
│                      │
│   TERMINAL           │  ~55–65vh
│   (pinch scroll)     │
│                      │
├──────────────────────┤
│ [input…………] [送出]  │  sticky + safe-area-inset-bottom
│ [←][↑][↓][→][look]   │  thumb cluster
└──────────────────────┘
```

- **全螢幕模式**（隱藏 topbar，只留薄把手）— 長按或 ⛶  
- 斷線時 bottom sheet 提示重連，不跳整頁  

### 2.5 Motion & feedback

- 連線狀態：soft pulse on status dot（1.5s）  
- Send：input 微 clear，不整頁 re-render 終端  
- Drawer：200ms ease-out  
- **禁止** 終端區用 CSS transition 扭曲 canvas  

### 2.6 A11y

- Focus ring 用 accent，可見  
- `prefers-reduced-motion` 關閉 pulse  
- 對比：正文 vs 底 ≥ WCAG AA（dim text 僅用於次要）  
- 觸控目標 ≥ 44px（方向鍵）  

---

## 3. File-structure map (implementation)

| Path | Change |
|------|--------|
| `apps/web/src/styles/tokens.css` | design tokens |
| `apps/web/src/components/shell/*` | Topbar, SessionTabs, StatusPill, CommandBar, SideDrawer, ConnectGate |
| `apps/web/src/components/terminal/TerminalStage.tsx` | framing around canvas |
| `apps/web/src/App.tsx` | 拆掉表單牆；組裝 shell |
| `apps/web/src/TerminalHost.tsx` | 保持薄；可接受 className / chrome slots |
| `apps/web/index.html` | fonts (Google or self-host Noto/JetBrains) |
| `docs/design/ui-spec.md` | 凍結後的視覺規格（本 plan 過後抽出） |

**不改**：`packages/*` 協議與 buffer 核心（除非 terminal 需要 theme 色板 API 給 canvas ANSI 對照）。

Canvas ANSI 色可對齊 token（`#0a0b0e` 底 + 柔和 16 色，非 Windows 刺眼 ANSI）。

---

## 4. Phases

### Phase U0 — Spec freeze (S)
- 選定 accent（mint vs blue）— **推薦 mint `#3dffa8`**  
- 字體授權：Google fonts CDN 或 self-host（開源友善）  
- 輸出 wireframe ASCII（上節）+ token 表進 `docs/design/ui-spec.md`  
- **Acceptance**: Board 點頭 accent + layout  

### Phase U1 — Shell rebuild (L) — **核心**
- tokens.css + Tailwind theme extend  
- Topbar / StatusPill / SessionTabs / CommandBar / Drawer  
- ConnectGate（未連線） vs PlayShell（已連線）  
- RWD breakpoints：sm / md / lg  
- **Acceptance**: 手機 390 寬、桌面 1440 寬截圖對得上 wireframe；連線後設定不佔主畫面  

### Phase U2 — Terminal stage polish (S–L)
- Canvas 容器：圓角、內陰影、scanline **可關**（預設關，避免老套）  
- ANSI palette soft remap in `canvas2d.ts`  
- Focus：點終端 → 聚焦 input  
- **Acceptance**: 長 session 視覺不疲勞；無 per-cell React  

### Phase U3 — Mobile thumb UX (S)
- 方向鍵 pad + safe-area  
- 全螢幕終端 toggle  
- 虛擬鍵盤彈起時 input sticky 不遮住（`visualViewport` 可選）  
- **Acceptance**: 單手可 look + 移動四向  

### Phase U4 — Motion + a11y pass (S)
- reduced-motion、focus、對比抽樣  
- **Acceptance**: keyboard-only 可完成連線與送指令  

### Phase U+i18n — Locale switch (see dedicated plan)

> **Plan**: [`2026-07-21-i18n-locale.md`](./2026-07-21-i18n-locale.md)  
> **Hetero R1**: [`docs/reviews/2026-07-21-i18n-hetero.md`](../reviews/2026-07-21-i18n-hetero.md)

- Shell-only en / zh-Hant；`StatusEvent` 結構化狀態；ConnectGate + drawer 切換  
- **不**翻譯 MUD 世界輸出  
- Merge gate = I1+I2+I3（禁止半套 status i18n）  

---

## 5. Out of scope (this redesign)

- 重寫 proxy / protocol  
- 完整 Mudlet 式可拖拽 dock 布局引擎  
- 多頻道獨立聊天窗（只預留 slot）  
- 3D / 粒子背景  
- 強制 light mode（可後加）  

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| 過度設計拖慢遊戲 | U1 先「能玩的漂亮殼」，特效 U2 可關 |
| 字體 CDN 隱私/中國可達 | 提供 self-host fallback |
| Canvas 色與 UI accent 衝突 | 終端 16 色獨立 token 表 |
| RWD 回歸 | 固定 viewport 截圖 checklist |

---

## 7. Success criteria

1. 陌生人 5 秒內看懂「這是進 MUD 的窗」  
2. 連線後主畫面 **≥60% 是終端**  
3. 手機與桌面同一套組件，breakpoint 行為明確  
4. 不破壞現有 proxy hello / Big5 / VT 測試  
5. 你主觀評語從「太鳥」→「還能看 / 想用」  

---

## 8. Open questions (Board)

1. Accent：**mint 生機** vs **電光藍 工具感**？（推薦 mint）  
2. 連線前要不要 **品牌短句**（如「重生的世界 · 及其他」）還是極簡 logo only？  
3. Map 預設：**桌面開 / 手機關**？（推薦）  
4. 是否接受 Google Fonts CDN？  

---

## 9. Next actions

1. Board 回 §8  
2. 建 `docs/design/ui-spec.md` + `feat/ui-redesign`  
3. 實作 U1 → 截圖 review → U2/U3  

## Review log

- R0 2026-07-21 — research (modern dark terminal + Mudlet layout) + design plan authored  
