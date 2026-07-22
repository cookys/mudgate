# zMUD feature matrix — 對照表（mudgate / RW）

> **SSOT**：之後要比「zMUD 有什麼、RW 要不要、我們做到哪」看這份。  
> **更新日期**: 2026-07-21（W05 ECHO survey 補注）  
> **來源**: Zugg zMUD 產品頁／MXP·MCCP 文檔、Mudlet Supported Protocols（ECHO）、Last Outpost ECHO/SGA、RFC 857、TinTin++、本倉 RW probe + code audit  
> **連動 plan**: [`docs/plans/2026-07-21-rw-connect-protocols.md`](../plans/2026-07-21-rw-connect-protocols.md)

### 欄位說明

| 欄 | 意義 |
|----|------|
| **zMUD** | 經典 zMUD（含常見後繼 CMUD 玩家預期）是否具備 |
| **RW 相關** | 對 Revival World 實際影響：`必須` / `高` / `中` / `低` / `無` |
| **mudgate** | `done` / `partial` / `todo` / `wont` / `n/a` |
| **優先** | 產品節奏：`P0` 連線正確 · `P1` 順暢 · `P2` 可玩深度 · `P3` 遠期 · `—` 不做 |
| **筆記** | 實作位置或決策理由 |

**mudgate 圖例**

- `done` — 主路徑可用  
- `partial` — 有骨架／util／故意簡化  
- `todo` — 計畫內未做  
- `wont` — 刻意不做或預設關閉（安全／範圍）  
- `n/a` — 產品形態不同（例如桌面 exclusive）

---

## 1. Wire / Telnet / 編碼

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| W01 | Raw TCP / Telnet NVT | ✅ | **必須** | done | P0 | proxy `bridge` → MUD |
| W02 | IAC 協商（通用） | ✅ | **必須** | done | P0 | `packages/protocol` TelnetParser |
| W03 | TTYPE | ✅ | **必須** | done | P0 | RW DO 24；回 ANSI |
| W04 | NAWS（視窗大小） | ✅ | **必須** | done | P0 | RW DO 31；hello cols/rows |
| W05 | ECHO（密碼遮罩） | ✅ | 高 | done | P1 | 短暫 `type=password`；proxy JSON echo；見 §1.1 |
| W06 | EOR / GA 忽略 | ✅ | 中 | partial | P1 | 不崩潰即可 |
| W07 | **MCCP1** | ✅ | 低 | n/a | — | 現代多用 MCCP2 |
| W08 | **MCCP2**（zlib 壓縮） | ✅ | **高** | partial | **P1** | RW WILL 86；現 **DONT**；util 有、bridge 無串流 |
| W09 | MCCP 壓縮率顯示 | ✅ | 低 | todo | P3 | zMUD 有 savings 顯示 |
| W10 | **MXP** 協商 | ✅ | 中 | done* | P0 | *WONT 拒絕；正確 |
| W11 | MXP 標籤渲染（連結／色） | ✅ | 中 | wont | P3 | XSS；明文顯示即可 |
| W12 | MSSP | ✅ | 低 | partial | P2 | RW WILL 70；可 DONT／忽略 |
| W13 | MSP（音效） | ✅ | 低 | wont | P3 | 非 RW 核心 |
| W14 | GMCP | 後期／他客 | 低（RW） | todo | P3 | RW 首包未見 |
| W15 | MSDP | 部分 | 低 | todo | P3 | 同上 |
| W16 | ATCP | 舊 | 無 | wont | — | 被 GMCP 取代 |
| W17 | CHARSET 協商 | 部分客 | 中 | partial | P2 | RW 用登入列 `BIG5`/`GB` 文字切 |
| W18 | Big5 / DBCS 解碼 | ✅（中文局） | **必須** | done | P0 | `codec-big5` HKSCS |
| W19 | GB 解碼 | ✅ | 中 | todo | P2 | 登入可選 GB；非預設 |
| W20 | UTF-8 MUD | ✅ | 低（RW） | partial | P2 | multi-MUD 路線 |
| W21 | TLS 到 MUD（telnets） | 部分 | 低（RW 明文） | todo | P3 | backlog |
| W22 | 瀏覽器 WSS + auth proxy | ❌（桌面直連） | **必須**（我們） | done | P0 | ADR-002；產品差異 |

### 1.1 W05 ECHO — 正確語意（2026-07-21 survey）

> **不是** trigger 抓「第二行輸入」。  
> **不是** 整場連線關掉 local echo（否則平常就看不到自己打的字）。

#### 協定：短暫 password-mode 旗標

標準 MUD / Mudlet / line-mode 客端慣例（RFC 857 + 實務）：

| 時機 | 伺服器 → 客戶端 | 客端行為 |
|------|-----------------|----------|
| 密碼提示前／當下 | `IAC WILL ECHO`（`FF FB 01`） | 輸入列改 **mask**（常見 `*` 或空白） |
| 密碼收完 | `IAC WONT ECHO`（`FF FC 01`） | **立刻恢復**明文輸入列 |

- 預設 `WONT ECHO`：remote echo 關 → **客端 line editor 自己顯示**正在打的字（平常玩看得到 `n` / `look` 的主因）。  
- `WILL ECHO`：伺服器宣稱「echo 由我負責」→ 客端 **不要本地回顯明文**；密碼時伺服器 **故意不 echo 任何字** → 畫面無明文。  
- 伺服器若忘記 `WONT`，客端會一直 mask（Mudlet 文件明列；並提供 user override 關 password masking）。

部分 MUD / 舊實作會把 DO/WILL 搞反；zMUD changelog 曾加 **同時處理 `WILL ECHO` 與 `DO ECHO`**。mudgate 應以 **server-initiated WILL/WONT** 為主，並對反轉 DO 做防禦性相容。

#### 三層「echo」（勿混為一談）

| 層 | 含義 | 平常玩 | 密碼時 |
|----|------|--------|--------|
| **A. 輸入列顯示** | command line 畫正在打的字 | 明文 | `WILL ECHO` → mask |
| **B. 指令回顯到輸出窗** | Enter 後把整行印進 scrollback（zMUD Echo commands / Mudlet Show text you sent） | 可開可關 | 不應印密碼明文 |
| **C. 伺服器 remote echo** | 伺服器 bounce 每個 key | 多數 line-mode MUD **不做** | 密碼更不做 |

zMUD / Mudlet 是 **獨立輸入列 + 輸出窗**，不是純 NVT 鍵盤直連印表機。使用者「看得到自己打什麼」≈ **A（± 可選 B）**；密碼隱藏 ≈ **A 進入 mask**。

#### zMUD 額外保險（仍非 trigger 抓密碼）

| 機制 | 作用 |
|------|------|
| Telnet ECHO 狀態 | 輸入當下 mask（主路徑） |
| `#PW` / character DB 送密 | 送出且 **不 echo 到文字窗** |
| 偏好：隱藏含密碼的行 | scrollback 防洩漏 |

用 trigger 對「Password:」再 `#send` 是 **玩家腳本捷徑**，不穩，也不是內建遮罩實作。

#### mudgate 現況（W05 shipped）

| 層 | 狀態 |
|----|------|
| `OPT.ECHO` + `replyToNegotiation` | WILL→DO、WONT→DONT、反轉 DO→WILL / DONT→WONT |
| proxy `bridge` | JSON `{ type: "echo", mask: bool }`（**非** StatusEvent） |
| web | `onEchoMask` → `input type=password` 僅 mask 期間 |
| residual | RW 實機 login 抓包確認；server 忘 WONT 的 user escape（P2） |

---

## 2. 終端 / 顯示 / VT

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| T01 | ANSI SGR 16 色 | ✅ | **必須** | done | P0 | soft palette canvas |
| T02 | xterm 256 色 | 後期 | 低 | todo | P3 | RW 宏多為 16 色 |
| T03 | VT CUP / ED / EL | ✅ | **必須** | done | P0 | map_d |
| T04 | 存／還原游標 (s/u) | ✅ | **必須** | done | P0 | SAVEC/REST |
| T05 | DECSTBM 捲動區 | ✅ | **必須** | done | P0 | FREEZE |
| T06 | 反索引／雙高寬 | ✅ | 中 | partial | P2 | RW 有宏；需對照 |
| T07 | 全螢幕地圖重繪 | ✅ | **必須** | done | P0 | ScreenBuffer |
| T08 | 雙色全形格 | 視版本 | 高 | partial | P1 | dual-color cell API 有 |
| T09 | 選取複製純文字 | ✅ | 高 | done | P0 | |
| T10 | 選取複製含 ANSI | ✅ | 中 | done | P1 | |
| T11 | 捲動回看 scrollback | ✅ | 高 | done | P1 | 滾輪/PageUp + 複製歷史 |
| T11b | 指令列 focus / ↑↓ 歷史 / Echo commands | ✅ | 高 | done | P1 | 見 `zmud-input-ux.md` |
| T12 | 字體選擇 | ✅ | 高 | partial | P1 | catalog + TC chain baseline |
| T13 | 字級／字距 | ✅ | 高 | partial | P2 | setTypography；試掘 UI residual |
| T14 | 等寬 1:2 對齊 | 系統字 | **必須** | done* | P1 | *cell width cjk/western（charset-aware）；字型 glyph 仍 fonts-f2 |
| T15 | 多輸出窗／分頁 | ✅ | 中 | partial | P2 | multi-tab session 有；非 split |
| T16 | 狀態列／gauge | ✅ | 中 | todo | P2 | 無 GMCP 則靠 trigger |
| T17 | 按鍵宏 toolbar | ✅ | 高 | partial | P2 | thumb pad n/s/e/w |
| T18 | Numpad 方向熱鍵（focus 在指令列也行） | ✅ | 高 | done | P1 | `numpadDirs` + `onUserCommand`；詳 input-ux |

---

## 3. 腳本 / 自動化（zMUD 招牌）

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| S01 | Alias（指令縮寫） | ✅ | **高** | done | P0 | script-engine |
| S02 | Trigger（收字觸發） | ✅ | **高** | done | P0 | |
| S03 | 變數 / 運算 | ✅ | 高 | partial | P1 | 引擎能力對照測試 |
| S04 | 類別／class 開關 trigger | ✅ | 中 | partial | P2 | |
| S05 | 路徑 / speedwalk | ✅ | **高** | partial | P1 | mapper + expand |
| S06 | #WAIT / 佇列指令 | ✅ | 高 | partial | P1 | |
| S07 | 按鈕／button bar | ✅ | 中 | todo | P2 | |
| S08 | 計時器 alarm | ✅ | 中 | todo | P2 | |
| S09 | 事件 onConnect 等 | ✅ | 中 | todo | P2 | |
| S10 | zScript 完整相容 | ✅ | 中 | wont* | P3 | *語意子集即可 |
| S11 | 匯入 `.mud` / settings | ✅ | 中 | todo | P2 | backlog spike |
| S12 | 套件 pack 匯入匯出 | ✅ | 高 | done | P1 | rw-pack + engine |
| S13 | 社群 pack 目錄 | 外掛生態 | 低 | todo | P3 | backlog registry |
| S14 | Lua/JS 外掛 | CMUD/他客 | 低 | wont | P3 | 安全沙箱成本高 |

---

## 4. Mapper / 世界

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| M01 | 自動建圖（走一步記一間） | ✅ | 高 | partial | P1 | `ClientMap` 簡化 |
| M02 | 地圖 UI 可編輯 | ✅ | 中 | todo | P2 | |
| M03 | 伺服器 ASCII map 顯示 | ✅ | **必須** | done | P0 | VT 路徑；非獨立 map widget |
| M04 | RW 網頁 2D map embed | ❌ | 中 | todo | P2 | backlog |
| M05 | 尋路 pathfind | ✅ | 中 | todo | P2 | |
| M06 | 房間 note／顏色 | ✅ | 低 | todo | P3 | |

---

## 5. 連線 / Session / 設定

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| C01 | 多主機 profile | ✅ | **高** | done | P0 | profiles 套件 |
| C02 | 自動登入字串 | ✅ | 高 | done | P1 | account+password+autoLogin；ECHO mask 送密；見 input-ux |
| C03 | 重連 | ✅ | **高** | done | P0 | MudSocket backoff |
| C04 | 多 session 分頁 | ✅ | 高 | done | P0 | tabs + close modal |
| C05 | 分屏同時看兩角 | ✅ | 中 | todo | P2 | backlog split |
| C06 | 語系 UI | 英／有限 | 高 | done | P0 | zh-TW/CN/en |
| C07 | 連線狀態顯示 | ✅ | 高 | done | P0 | StatusEvent + i18n |
| C08 | Session log 存檔 | ✅ | 高 | partial | P1 | download log 有 |
| C09 | 離線 replay | 部分 | 低 | todo | P3 | backlog |
| C10 | Proxy / 防火牆 | 部分 | **必須** | done | P0 | WSS auth proxy |
| C11 | Origin / token 安全 | n/a | **必須** | done | P0 | remote-prod |

---

## 6. 平台 / 發行（zMUD 無、我們有）

| ID | 功能 | zMUD | RW 相關 | mudgate | 優先 | 筆記 |
|----|------|------|---------|--------|------|------|
| P01 | 瀏覽器免安裝 | ❌ | 高 | done | P0 | |
| P02 | 手機 RWD | ❌ | 高 | partial | P1 | thumb pad；PWA backlog |
| P03 | PWA 安裝 | ❌ | 中 | todo | P2 | |
| P04 | 開源 MIT 客戶端 | ❌ | — | done | — | |
| P05 | 自架 proxy | n/a | 高 | done | P0 | |
| P06 | CI e2e mock MUD | n/a | 中 | todo | P1 | backlog |

---

## 7. 匯總儀表板（快速掃）

### 依 mudgate 狀態計數（約）

| 狀態 | 約略數 | 含義 |
|------|--------|------|
| done | ~25 | 已可當「能連 RW 的 web 客戶端」 |
| partial | ~18 | 有基礎，缺深度或 flag |
| todo | ~20 | 未做 |
| wont / n/a | ~10 | 刻意不做或形態不同 |

### 依優先（未 done 的重點）

| 優先 | 建議下一波 | ID 舉例 |
|------|------------|---------|
| **P1 連線順** | MCCP2 已 ship；下一刀 **ECHO 短暫 mask（W05）** | W05, W09? |
| **P1 顯示** | 字體試掘／1:2、scrollback UI | T11–T14 |
| **P1 腳本** | speedwalk／變數強化 | S03, S05, S06 |
| **P2** | profile auto-login、split、MXP 仍關 | C02, C05 |
| **P3** | GMCP、MSP、.mud 全相容 | W14, S11 |

### RW「最小可玩」檢查清單

- [x] W01–W04, W18, T01, T03–T05, T07, C01, C03, C04, C10  
- [x] **W08 MCCP2**（proxy 串流；見 mccp2-stream project）  
- [x] **W05 ECHO** 短暫 password mask（C2；見 §1.1 / plan echo-password-mask）  
- [x] W10 MXP 拒絕  
- [x] S01–S02 基礎  
- [ ] T12–T14 字體深度（baseline 有）  

---

## 8. 怎麼維護這張表

1. 新功能 PR：改對應列 **mudgate** + 筆記一行。  
2. 新 probe（他服）：加「該服」欄或另表 `matrix-<mud>.md`，本表保持 **zMUD × RW × mudgate**。  
3. 成案時：從 **優先 P1+todo** 勾到 `docs/plans/`。  
4. **不要**追求 100% zMUD 相容；以 **RW 必須 + multi-MUD 擴充** 為準。

## 9. 參考連結

- Zugg zMUD info / MXP / MCCP 說明頁；zMUD version history（WILL ECHO + DO ECHO 相容）  
- Mudlet Manual: Supported Protocols → **ECHO (Password Masking)**（WILL 開 mask / WONT 關）  
- [Last Outpost: ECHO and SGA for MUDs](https://www.last-outpost.com/LO/protocols/echosga.html)（line-mode hidden password entry）  
- [RFC 857 Telnet Echo Option](https://www.rfc-editor.org/rfc/rfc857.html)  
- TinTin++ MCCP2  
- 本倉: `docs/research/rw-probe-2026-07-21.md`, `rw-ansi-and-map-controls.md`  
