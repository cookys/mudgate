# Plan — CJK cell width + 台灣泥巴列表相容（含 IP 多開 survey）

> **Status**: **SHIP**（W1–W4+I1；`feat/cjk-cell-width`）  
> **Owner**: cookys  
> **Why**: RW MOTD 錯位根因是 **Ambiguous/DBCS 字寬**；產品目標**朝向** [台灣泥巴列表](https://www.revivalworld.org/mud/taiwanmudlist)（~23 站）可用，需 **charset-aware** 修法，並釐清 **共用 proxy IP** 與 MUD 多開偵測。  
> **North**: 盡可能相容最多中文 MUD；**不**用全域 `Ambiguous=2` 搞壞 UTF-8／英文服。  
> **連動**: matrix T14 / W18；profile charset；proxy-abuse；profile-library  
> **SSOT 字寬語意**: 本 plan §1  
> **Hetero**: `docs/reviews/2026-07-21-cjk-width-hetero.md`  

---

## 0. Problem

| 現象 | 根因 |
|------|------|
| RW MOTD／框線 art 歪 | `ScreenBuffer.isWide` 把 Unicode **Ambiguous**（`─│┌` 等）當 **1 格**；Big5 art 按 **DBCS=2** 排 |
| 若全域 Ambiguous→2 | 英文 UTF-8 MUD 框線 art **會撐爆** |
| 台灣列表多站 | 多數 **Big5** 中文 ES2／類似；少數可能 GB／不同 port 家族；字寬策略需綁 **session charset** |
| Web proxy 多開 | 所有玩家從 **proxy 出口 IP** 進 MUD → 與「同 IP 多登」規則衝突 |

---

## 1. Cell width — 相容最多中文 MUD 的修法

### 1.1 原則（強制）

1. **字寬模式綁 session**，**不是**全域常數。  
2. **Effective mode 先解析，再算 isWide**（`isWide` **永不**接收 `"auto"`）。  
3. **CJK legacy charset** 預設 cjk mode；**`utf8` / 未知** 預設 western（保守，不誤傷）。  
4. Profile 可 **人工 override** `widthMode: "cjk" | "western"`（無 auto 欄；auto 只存在於推導函式）。  
5. **連線建立前**套用 effective mode；**切換 charset / profile 時清空或重建 ScreenBuffer**，禁止舊 cells 混用兩套寬度語意。  

### 1.2 Charset 正規化 → effective mode

```
normalizeCharset(raw) → one of:
  big5 | big5hkscs | gbk | gb18030 | utf8 | unknown

aliases（**常見子集，非 exhaustive**；未列 → `unknown` → western）:
  big5-hkscs, big5hkscs, cp950, ms950 → big5hkscs
  big5, cn-big5 → big5
  gbk, gb2312, cp936 → gbk
  gb18030 → gb18030
  utf-8, utf8 → utf8

function resolveWidthMode(profile):
  if profile.widthMode in {cjk, western}: return profile.widthMode
  // auto derive:
  cs = normalizeCharset(profile.charset)
  if cs in {big5, big5hkscs, gbk, gb18030}: return "cjk"
  return "western"   // utf8 | unknown | future encodings

// isWide ONLY sees effective mode:
function isWide(ch, mode: "cjk" | "western"):
  if codepoint < 0x80: return false
  if mode == "western":
    return EAW in {F, W}          // Ambiguous → 1
  // mode == "cjk": 中文 MUD / BBS / zMUD 心智
  if EAW in {F, W, A}: return true
  if CJK Unified / Hangul / fullwidth ranges: return true
  return false   // EAW=N 罕見 → 1，避免亂撐
```

**v1 範圍誠實聲明**：實作為 **pragmatic** F/W + 常見 Ambiguous 區段（框線／方塊／幾何／常見 banner 符號），**不是**完整 Unicode TR11 表。以 RW MOTD golden + western 框線回歸鎖行為。v1.1 可選完整 EAW 表或 DBCS-source bit。  
**非目標 charset**（euc-kr / shift-jis）：v1 不進 auto→cjk；需要時用 **手動 widthMode=cjk**。

### 1.3 不在 v1 做

| 項目 | 原因 |
|------|------|
| 全域 Ambiguous=2 | 搞壞 UTF-8 服 |
| Prompt 猜「這是 MOTD」再特判 | 脆 |
| 改伺服器 MOTD | 非我方 |

### 1.4 實作位置

| 層 | 工作 |
|----|------|
| `packages/profiles` | **`resolveWidthMode` + charset alias 表**（charset 已在此）；`widthMode?: "cjk"\|"western"` |
| `packages/terminal` | `isWide(ch, "cjk"\|"western")`；`ScreenBuffer` ctor / `setWidthMode` + **set 時 clear** |
| `apps/web` TerminalHost | 連線前 resolve；profile 變更 → 新 buffer 或 clear |
| Tests | 見 §3 |

### 1.5 Canvas 視覺

Cell 佔 2 格後，`fillText` 仍可能畫成半形 glyph（字型問題）。  
**v1 acceptance 只驗 cell 游標／欄位前進，不驗 glyph 像素美觀**；字型 dual-width mono 屬 **fonts-f2**。

---

## 2. 台灣泥巴列表 — 相容範圍

### 2.1 產品目標（措辭約束）

- **方向**：讓 [台灣泥巴列表](https://www.revivalworld.org/mud/taiwanmudlist)（~23 站）**最終**都能用 assmud 玩。  
- **本 plan ship（W1–W4）不得宣稱**「已支援全部 23 站」。  
- 全表相容 = **T1 probe 完成 + 逐站驗證 + allowlist 審核** 之後的產品狀態。  
- 未知 charset：**western + 人工 override**，不瞎猜 cjk。

### 2.2 列表快照（研究用，非 allowlist 定稿）

| 泥巴 | host:port | 線上(當日) | 預設 charset 假設 |
|------|-----------|------------|-------------------|
| 三國歪傳 yyy | mud.csie.org:3838 | 72 | big5* |
| 大神小站 | 210.59.236.38:3000 | 3 | big5* |
| 五星物語 | fss.twcos.com:5000 | 9 | big5* |
| 再戰江湖 | 210.59.236.38:7788 | 160 | big5* |
| 狂想空間 | fs.twkang.net:5555 | 2 | big5* |
| 東方故事 | es.clovers.tw:8000 | 91 | big5* |
| 風之大陸 | windmud.web-games.net:4040 | N/A | big5* |
| 風雲再起 | windcloud.twmuds.com:8000 | 88 | big5* |
| 原始物語 | psmud.ddns.net:6789 | 0 | big5* |
| 時空幻境 | td.muds.net:5500 | 2 | big5* |
| 異想世界 | hopto.mud.ren:4000 | 233 | big5* |
| 渾沌幻世 | 54.238.179.235:5555 | 4 | big5* |
| 虛幻時空 | it.muds.net:7000 | N/A | big5* |
| 亂世群雄 | 1.34.119.71:7878 | 離線 | — |
| 萬王之王 | kk.muds.idv.tw:4000 | 233 | big5* |
| 夢幻七域 | 210.59.236.38:7000 | 0 | big5* |
| 龍域傳奇 | dragonrealms.co:3000 | N/A | ? |
| 小貓的世界 | catworld.muds.me:5555 | 162 | big5* |
| 失落的國度 | doom.twmuds.com:4000 | 66 | big5* |
| 金庸修真錄 | jy.mud.com.tw:6666 | 74 | big5* |
| 重生的世界 | mud.revivalworld.org:4000 | 6 | **big5 已證實** |
| 聖殿英雄傳說 | sanc.game.tw:4002 | 181 | big5* |
| 東方故二天朝遊俠錄 | us.muds.net:4000 | 23 | big5* |

`*` = **假設**（台系 ES2 慣例）；正式 seed 前需 **read-only probe**（IAC + 首包 charset 提示），結果寫入 `docs/research/taiwanmud-probe-YYYY-MM-DD.md`。

### 2.3 分層交付

| 層 | 內容 | 優先 |
|----|------|------|
| **L0 字寬** | §1 CJK mode（本 plan 核心 ship） | P0 |
| **L1 RW 驗證** | RW MOTD golden + 登入後 map 不歪 | P0 |
| **L2 列表 probe** | 各站 banner charset / MCCP / ECHO 表 | P1 |
| **L3 profile seeds** | 列表 → **草稿 seeds only**；**≠** proxy allowlist（技術隔離） | P1 |
| **L4 IP 策略** | §4 選路實作（可能跨 plan） | P1–P2 |

**Out of scope v1**: 為每站客製 trigger pack；GMCP；站方改規則。

---

## 3. Acceptance（字寬 ship）

1. **Unit**: CJK mode 下 `─│┌╮`（U+2500 系 Ambiguous）→ wide；ASCII → 不 wide。  
2. **Unit**: Western mode 下同上框線 → **不** wide。  
3. **Unit**: `resolveWidthMode({charset:'big5hkscs'})=='cjk'`；`utf8`→`western`；`unknown`→`western`；顯式 `widthMode:'cjk'` 覆蓋 charset。  
4. **Golden（可判定）**:  
   - Fixture：優先 **reuse** 既有 redacted banner（若有 `tests/fixtures/streams/rw-banner-*`）；否則 W3 新增 `packages/terminal/tests/fixtures/rw-motd-login.big5.bin`（無密碼）。  
   - 以 `widthMode=cjk`、`cols=80` 寫入 buffer 後，對 **約定列號**（MOTD 圖形區，例如 decodable 後非空 art 列）斷言：  
     - 每列「有效 display width」（至最後非空白 cell）**等於** 該列 Big5 **byte-cell width**（DBCS=2, ASCII=1）；或  
     - 與 committed **golden 游標欄位表** `rw-motd-cols.json` 逐列一致。  
   - **禁止**「差 ≤ 歷史」這類模糊條件。  
5. Profile / 連線：charset 切換 → buffer clear／rebuild（unit 或 host 測）。  
6. **明確不驗**：glyph 像素／字型美觀（fonts-f2）。  
7. `npm test` + web build 綠。

---

## 4. Survey — Proxy IP / 多開偵測

### 4.1 你的猜測

> 多數 MUD 用 **IP** 做多開／連線數／洗版／機器限制。

**大致正確**，但實務是 **多層**：

| 機制 | 常見程度 | 說明 |
|------|----------|------|
| **同 IP 連線數上限** | 很高 | NAT 家庭、學校、**共用 proxy** 最痛 |
| 同 IP 多角色登入 | 高 | 反外掛／反多開 |
| 帳號綁 IP／異常 IP 踢 | 中 | 安全 |
| Cookie / 機器碼 | 少（telnet 難） | 網頁服較多 |
| 行為／頻率 | 中 | 刷指令 |

Web 客戶端經 **單一 hosted proxy** 出口時：  
**N 個真人 = 1 個 IP** → 很容易觸發「同 IP 太多連線」。

### 4.2 業界／社群常見解法（由佳到差）

| 方案 | 做法 | 優點 | 缺點 | 對 taiwanmudlist |
|------|------|------|------|------------------|
| **A. 官方認可 proxy + 白名單** | 站方把 proxy IP 加入「共享出口例外」或提高上限 | 最乾淨 | 需逐站談；慢 | 長期目標 |
| **B. 用戶自架 proxy（VPS／家裡）** | 瀏覽器 → 自己的 WSS proxy → MUD；出口=用戶 IP | **IP 還原為個人**；站方無感 | 門檻高；手機需公網/隧道 | **相容性最佳** |
| **C. 桌面「半直連」** | Electron/Tauri 本機 TCP 直連（無共享出口） | 與 zMUD 相同 IP 模型 | 非純瀏覽器；PWA 難 | 進階路徑 |
| **D. 多出口 IP pool** | hosted 多台 egress／住宅代理 | 分散連線 | 成本、濫用、法律、站方敵視住宅代理 | **不建議當主路徑** |
| **E. 協定告知真實 IP** | 自製 `IAC`／handshake 傳 client IP | 理論美 | **台系舊 MUD 不認**；可偽造；需站方改碼 | 幾乎不可行 |
| **E2. PROXY protocol / 獨立 IPv6 egress** | 每用戶獨立出口或 L4 標註 | 分散／可稽核 | 需基建 + 站方支援；**非**舊 telnet 預設 | 長期 hosted 可研 |
| **F. 什麼都不做** | 單一 proxy IP | 實作零成本 | 熱門站多開即撞牆 | 只夠少數人測 |

**沒有**「客端單方面偽造不同 source IP」的乾淨 telnet 解法——TCP 來源 IP 由 **出口主機** 決定。

**白名單（A）誠實邊界**：站方放寬「同 IP 連線數」≠ 能識別每個真人；仍須 proxy **token 認證、每用戶限流、稽核**（abuse plan）。

### 4.3 assmud 建議策略（分階段）

| 階段 | 策略 | 說明 |
|------|------|------|
| **現在（dev）** | **localhost-dev proxy** | 出口=玩家機器 IP ≈ zMUD；**不**觸發共享 IP |
| **Ship web 給朋友** | 文件寫明：熱門站請 **自架 proxy** 或本機 dev | 誠實 UX |
| **Hosted 產品** | **B 為一等公民**（一鍵 deploy 腳本 / docker）；hosted 僅 allowlist 站 + 嚴格 per-token 連線上限 | 見 abuse plan |
| **關係** | **A**：對 RW／願意配合的站提供「官方 proxy IP 列表 + 用途說明」 | 營運，非 code |
| **禁止預設** | **D 住宅代理池**當預設 | 濫用與 ban 風險 |

### 4.4 與 abuse-limits 的邊界

| 議題 | 本 plan | proxy-abuse-limits |
|------|---------|-------------------|
| 字寬／MOTD | **本 plan** | — |
| 台灣列表 probe／seeds | **本 plan** L2–L3 | allowlist 目的地 |
| 同 IP 連線上限（**proxy 自己**防濫用） | 引用 | **主責** |
| MUD 端「同 IP 多開」 | **本 plan §4 策略**；實作多為文件 + 部署模式 | 可加 metrics「upstream connect from egress」 |

### 4.5 IP 結論（給 Board）

1. **技術上無法**在共享 proxy 上讓 MUD 看到「瀏覽器真實 IP」而不改站方或不用特殊協定。  
2. **相容最多中文站**的 IP 策略 = **預設還原玩家出口 IP**（自架／本機）+ hosted 當便利層並控並發。  
3. 你的直覺「都靠 IP 多開」→ **對到痛點**；解法是 **部署拓撲**，不是再多一個 IAC 選項。

---

## 5. Phases

| ID | Work | Size | Depends |
|----|------|------|---------|
| **W1** | `widthMode` + `isWide(ch, mode)` + ScreenBuffer API | S | — |
| **W2** | Web：profile charset → mode；連線生命週期 | S | W1 |
| **W3** | Tests：cjk vs western + RW MOTD fixture（redacted） | S | W1 |
| **W4** | 文件：matrix T14；taiwanmud 目標；IP 策略短文 | S | — |
| **T1** | Read-only probe 台灣列表子集（top online + RW）→ research md | S | 網路 |
| **T2** | profile-library **draft** seeds only（JSON 標記 `draft:true`） | S | T1, profile plan |
| **I1** | IP：docs/deploy 自架 proxy 一等公民 + hosted 限制說明 | S | — |
| **I2** | （可選）與 RW／站方溝通白名單流程（非 code） | — | 營運 |

### Seeds ≠ allowlist（強制隔離）

| 產物 | 用途 | 禁止 |
|------|------|------|
| Profile **draft seeds** | UI 選單預填 host/port/charset | **自動**加入 proxy 可連目的地 |
| Proxy **allowlist** | 審核過的精確 `host:port` | 任意 host；private / link-local / loopback（DNS 後再拒；防 rebinding） |

**本 ship 預設 expand**：**W1–W4 + I1**（字寬 + IP 文件）。  
**T1–T2 / I2** 文件或下一刀；**不得**因未完成 T1 而 BLOCK 字寬 ship。

---

## 6. Risks

| 風險 | 緩解 |
|------|------|
| CJK mode 誤用於 utf8 服 | charset 預設 + western 回歸測 |
| 字型半形 glyph 仍醜 | fonts-f2；acceptance 以 **cell 對齊** 為主 |
| Probe 被站方當掃描 | 低頻、只 banner、遵守 robots／站規；失敗跳過 |
| Hosted IP 被 ban | 文件 + 自架優先；勿住宅代理池 |
| Allowlist 誤開危險 host | 維持 proxy 目的地政策；seeds ≠ 自動放行 |

---

## 7. Out of scope

- 全域 Ambiguous=2  
- 住宅 IP 代理池  
- 偽造 source IP  
- 完整 23 站 trigger pack  
- 站方改 multi-login 規則（僅建議溝通）

---

## 8. Hetero review 焦點（給審稿引擎）

請回：

```
VERDICT: APPROVE | APPROVE_WITH_NITS | BLOCK
MUST_FIX: []
NITS: []
```

並明確回答：

1. §1 CJK/western 雙模式是否足以「相容最多中文、不搞壞 UTF-8」？  
2. §4 IP 策略是否誠實、有無遺漏實務解法？  
3. W1–W4 是否可 ship 而不綁死 T1 全列表 probe？  
4. 安全：probe / seeds / allowlist 有無 open-relay 風險？  

---

## 9. Review log

| Round | Engines | Result |
|-------|---------|--------|
| R0 | Grok + Codex + MiniMax（GLM id miss） | Codex **BLOCK**；MiniMax APPROVE_WITH_NITS |
| R1 fold | — | API auto、golden、buffer lifecycle、23 站措辭、seeds≠allowlist、IP |
| R2 | Codex + MiniMax + GLM-5.2 | **APPROVE*** / APPROVE_WITH_NITS；MUST_FIX 空 |

## 10. References

- [台灣泥巴列表](https://www.revivalworld.org/mud/taiwanmudlist)  
- Unicode EAW；WezTerm/Kitty ambiguous-width options  
- 本倉：`buffer.ts` `isWide`；`profiles` charset；`docs/security/hosted-proxy-threat-model.md`  
- Session：RW MOTD byte-width vs isWide mismatch survey  
