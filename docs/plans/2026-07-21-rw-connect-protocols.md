# Plan — RW 連線協定與 zMUD 對齊（先能穩連、再擴）

> **Status**: research retained; **C1 execution →** `2026-07-21-mccp2-stream.md` (approved)  
> **Owner**: cookys  
> **Why**: 對齊 zMUD 生態裡 **RW 真的會碰到的 wire 能力**，優先「能連、能玩地圖」，再補壓縮／腳本。  
> **North**: 先 **connect-complete**，不是一次做滿 zMUD 全功能。

---

## 0. Research — zMUD 功能 vs RW 用得到的

### 0.1 zMUD 常見能力（產業／Zugg 文檔）

| 類別 | zMUD 能力 | 典型用途 |
|------|-----------|----------|
| **Wire** | Telnet IAC、TTYPE、NAWS、ECHO | 連線／密碼遮罩／視窗大小 |
| **壓縮** | **MCCP / MCCP2**（zlib） | 伺服器壓縮輸出，省頻寬、地圖大重繪較順 |
| **標記** | **MXP**（HTML 式 tag） | 可點連結、色塊；**XSS 風險**若當 HTML 渲染 |
| **狀態** | MSSP | 伺服器資訊；連線後可忽略 |
| **結構化** | GMCP / MSDP / ATCP | 血量／房間 JSON；**現代 MUD** 多，**舊 Big5 中文 MUD 少** |
| **音效** | MSP | 觸發音效；RW 非核心 |
| **VT** | ANSI + VT100 CUP/s/u/region | **地圖／標題全螢幕重繪** |
| **腳本** | alias / trigger / path / 變數 | 日常掛機、補血、自動 walk |
| **UI** | 多窗、mapper、button bar | 體驗層 |

參考：Zugg zMUD feature list（MXP/MCCP/MSP）、Mudlet Supported Protocols、TinTin++ MCCP2、mudvault protocols guide、本倉 `docs/research/rw-probe-2026-07-21.md`。  

**完整功能對照表（SSOT）**：[`docs/research/zmud-feature-matrix.md`](../research/zmud-feature-matrix.md)

### 0.2 RW 實際 probe（2026-07-21，連線首包）

| 伺服器 → 客戶端 | 選項 | RW 意義 |
|-----------------|------|---------|
| DO | **TTYPE** | 必須回 WILL + SB IS |
| DO | **NAWS** | 必須回視窗 cols×rows |
| WILL | **MCCP2 (86)** | 伺服器**想**壓縮；客戶端可 DONT 或 DO+inflate |
| DO | **MXP (91)** | 伺服器問要不要 MXP；**現拒 WONT 是對的** |
| WILL | **MSSP (70)** | 狀態協定；可 DONT／忽略 |
| — | **GMCP/MSDP** | 首包**未見**（可能登入後也無） |

Charset：**BIG5**（可切 GB）；地圖靠 **完整 VT**（CUP / SAVEC / REST / scroll region），見 `docs/research/rw-ansi-and-map-controls.md`。

### 0.3 assmud **現況**

| 能力 | 狀態 |
|------|------|
| WSS proxy → TCP RW | ✅ 可用 |
| Big5-HKSCS 解碼 | ✅ |
| VT screen buffer（map_d） | ✅ 主路徑 |
| TTYPE / NAWS | ✅ proxy bridge 協商 |
| **MCCP2** | ⚠️ 有 `tryInflateMccp` util，但 **`replyToNegotiation` = DONT**；bridge **未** inflate 串流 |
| MXP | ✅ 故意 **WONT**（安全） |
| MSSP | 未特別處理（當一般 IAC 拒絕即可） |
| GMCP/MSDP | 未實作（RW 非首要） |
| Alias / trigger pack | ✅ 有 script-engine + rw-pack **基礎** |
| zMUD `.mud` import | ❌ backlog |

**結論：現在就能連 RW 玩**（DONT MCCP2 仍合法）。要「更像 zMUD 長連／大地圖」下一刀是 **可選 DO MCCP2 + 正確 zlib 串流**。

---

## 1. 優先級 — 先能連線來用

### P0 — 連線正確／已大致具備（回歸即可）

1. **TCP + Telnet IAC** 不炸  
2. **TTYPE + NAWS** 正確  
3. **Big5** 解碼  
4. **VT 完整**（map 不花）  
5. **MXP 繼續關**（WONT；文字當 plain）  
6. **ECHO（密碼遮罩）** — 見 matrix **§1.1**：伺服器短暫 `WILL ECHO` → 輸入列 mask；`WONT ECHO` → 恢復明文。**不是**全程關 local echo，**不是** trigger 抓第二行

### P1 — 立刻加值「能連且順」（zMUD 玩家預期）

| # | 功能 | 理由 |
|---|------|------|
| **P1-a** | **DO MCCP2 + 串流 inflate** | RW **WILL MCCP2**；壓縮後大 map 重繪省流量；zMUD 預設會接 |
| **P1-b** | MCCP 狀態可觀測 | 除錯：是否已協商、inflate 錯誤 → StatusEvent |
| **P1-c** | 連線健康：GA/EOR 忽略不崩潰 | 部分 MUD 會送 |

### P2 — 玩得下去（非 wire，但是 zMUD 日常）

| # | 功能 |
|---|------|
| P2-a | 強化 **alias / trigger**（RW pack 擴充） |
| P2-b | 方向鍵／速度 walk（已有 thumb pad 基礎） |
| P2-c | session log 可複製（已有） |

### P3 — 刻意延後

| 功能 | 原因 |
|------|------|
| **MXP 渲染** | XSS；RW 可無 MXP 玩 |
| GMCP/MSDP UI | RW 首包無；他服再做 |
| MSP 音效 | 非連線阻塞 |
| zMUD `.mud` 全量 import | 研究 spike 另案 |
| telnets 到 MUD | RW 現況 cleartext |

---

## 2. MCCP2 實作要點（P1-a 規格）

### 2.1 協商

```
server: IAC WILL MCCP2
client: IAC DO MCCP2          // 改 DONT → DO（feature flag 可關）
server: IAC SB MCCP2 IAC SE   // 其後 payload 為 zlib
```

- 在 **SB 啟動壓縮之後**，TCP 後續 **data 事件** 先進 inflate，再餵 Big5／VT。  
- **切換點必須精確**：壓縮前 IAC 明文；壓縮後不可把 zlib 當 telnet 誤 parse。  
- 失敗：`StatusEvent { code: 'error', params: { detail: 'mccp inflate' } }` + 可選 fallback 重連 DONT。

### 2.2 位置

| 層 | 職責 |
|----|------|
| **proxy `bridge.ts`** | 協商 DO MCCP2；inflate 後送 **已解壓 binary** 給 browser（保持 browser 只懂 Big5+VT） |
| 或 client | 若未來直連 TCP（非目標）才在瀏覽器 pako |

**建議**：inflate 放 **proxy**（Node zlib 已有 `tryInflateMccp`；需改成 **串流 Inflate**，不能每 chunk 獨立 inflateSync）。

### 2.3 Feature flag

```
ASSMUD_MCCP=1   // default on for localhost-dev after ship
ASSMUD_MCCP=0   // force DONT（除錯）
```

### 2.4 Tests

- 合成 zlib 串流 fixture + 協商 bytes  
- 錯誤截斷不崩潰  
- 與現有 telnet tests 並存  

---

## 3. Phases

| Phase | Work | Size |
|-------|------|------|
| **C0** | 文件凍結 + flag 設計（本 plan Board GO） | S |
| **C1** | proxy 串流 MCCP2 DO + inflate；status 可觀測 | L |
| **C2** | **W05 ECHO 短暫 password mask**：proxy 傳 mask 狀態 → web 輸入列；RW login 實機確認 WILL/WONT；邊角 IAC 不炸 | S |
| **C3** | （可選）UI 顯示「壓縮中」；MSSP ignore 明確化 | S |

**Out of scope this plan**: MXP on、GMCP、zMUD import。

---

## 4. Acceptance（C1 ship）

1. 連 `mud.revivalworld.org:4000`，協商 **DO MCCP2** 成功（log／debug 可證）。  
2. 進遊戲後 map_d / 長輸出 **仍正確 Big5 + VT**（與 DONT 模式視覺一致）。  
3. `ASSMUD_MCCP=0` 可退回 DONT。  
4. inflate 錯誤不拖垮 proxy 進程。  
5. 既有 unit tests 綠 + 新增 MCCP 串流測試。  

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| 串流 inflate 邊界錯 → 花屏 | 狀態機 + 黃金 fixture |
| 與 telnet parser 交錯 | 壓縮後 **關閉 IAC parse** 或只在 decompressed 上 parse |
| 有人依賴 DONT | flag 關閉 |

---

## 6. Open questions (Board)

1. **預設打開 MCCP？**（推薦 **是**，flag 可關）  
2. inflate 只放 proxy？（推薦 **是**）  
3. C1 是否插隊在 fonts F2 之前？（推薦 **是** — 連線品質優先）  

---

## 7. Review log

- R0 2026-07-21 — web research (zMUD/Mudlet/TinTin protocols) + RW probe 對照 + assmud code audit  
