# Plan — T1-site（站方自架 proxy）+ 出口 IP／身份 · 與「Rust core = TinTin 式 daemon」架構討論

> **Status**: **APPROVED · plan-hetero ALL_CLEAR R2**（R1+R2 fold；gpt REQUEST_CHANGES 兩點已收）  


> **Owner**: cookys  
> **Date**: 2026-07-22  
> **Extends**: [`2026-07-21-selfhost-proxy-trust.md`](./2026-07-21-selfhost-proxy-trust.md)（T0–T3 **已 SHIP**）  
> **Related**: ADR-002 remote auth proxy · `docs/deploy/SELF-HOSTED-PROXY.md` · threat model · proxy abuse limits  
> **Trigger**: 站方若自架 → wss 護瀏覽器；但 mud 常只見 `127.0.0.1` → 限連／多開／ban 失效；並牽動「核心是否該是 TinTin 式 daemon」  

---

## 0. Problem

### 0.1 部署缺一格

現有信任表（selfhost-proxy-trust）：

| 等級 | 誰跑 proxy | 典型出口 IP |
|------|------------|-------------|
| T0 | 玩家本機 | 玩家 ISP |
| T1a | 玩家 VPS | VPS |
| T1b | 玩家家 + CF Tunnel | 玩家 ISP |
| T2 | assmud 官方 | 共用官方 |
| T3 | 陌生人 URL | 未知 |

**缺：T1-site — MUD 站方自己跑 proxy（與 mud 同信任域）。**

| 站方自架的甜頭 | 代價 |
|----------------|------|
| 公網玩家用 **wss/https**，不必裸 telnet 出站 | 站方仍見帳密（本來就管 mud） |
| allowlist 可鎖死本站 `host:port` | mud 預設見 **proxy 的 TCP src**（常 `127.0.0.1`） |
| 可跟官網同源、站方帳號綁 | IP 限連／多開策略要改或補 identity |

### 0.2 Source IP 鐵律

```text
mud accept() 看到的 = 建立 TCP 連線那一端的位址
瀏覽器無法「直接」當 telnet client 的 src IP
```

站方 hop：

```text
玩家 --wss--> [站方 proxy] --tcp--> mud:4000
                    ↑
              mud 看到 proxy（多為 127.0.0.1 / 內網）
```

**不能**在不改 mud／不加 shim 的情況下，讓標準 TCP 假裝 src = 玩家家寬。

### 0.3 架構討論觸發

若「站方 daemon」變一等公民，自然問：

> 是否應有 **Rust（或 native）core** 像 **TinTin++** 一樣當常駐 **execute daemon**（握 TCP、腳本、mapper 狀態），  
> **Web 只負責顯示／輸入**？

本 plan **同時**定 T1-site 產品契約，並把 daemon 分層做成 **可裁決的架構選項**（不立刻重寫，但鎖方向）。

---

## 1. Goals / Non-goals

### Goals

| ID | Goal |
|----|------|
| **S1** | 定義 **T1-site** 信任級、UX 文案、與 T1a／T2 差異 |
| **S2** | 站方一鍵／文件：proxy 只連本站 mud；wss + origin + token 預設 |
| **S3** | **誠實** 出口 IP 行為 + 可選 **PROXY protocol** 與 **proxy 層限流** 補洞 |
| **S4** | 身份替代：ws `remoteAddress` 稽核、per-token／per-account 限連（不依賴 mud 見真人 IP） |
| **S5** | 架構：對照 **Thin proxy + fat web** vs **TinTin 式 daemon + thin display**；產出 ADR 草案與分期 |
| **S6** | 明確「何時值得上 Rust core」的門檻（perf／站方嵌入／本地 daemon） |

### Non-goals

| 不做 | 原因 |
|------|------|
| 保證 E2E 密碼對站方不可見 | 站方＝mud 營運者；無意義且不可能（plain telnet hop） |
| 在無 mud 支援下偽造任意 src IP | TCP 不允許 |
| 立刻把現有 Node proxy 全改 Rust | 風險大；先契約與可選 shim |
| 公共 proxy 目錄 | 密碼農場（既有禁止） |
| Web 直接 raw TCP | 瀏覽器做不到 |

---

## 2. T1-site 產品定義

### 2.1 信任表新增列

| 等級 | 模式 | 出口 IP（mud 預設） | 誰見密碼 | UX |
|------|------|---------------------|----------|-----|
| **T1-site** | **MUD 站方自架 proxy** | proxy 機（常 localhost／內網） | **站方**（與 mud 同營運） | 「連線經本站安全閘道」；**不**用 T3 地獄警告 |

與 T2 差異：營運者 = 遊戲站，不是 assmud 官方。  
與 T1a 差異：玩家不必自己有 VPS；站方提供 `wss://mud.example/ws`。

### 2.2 部署拓撲（建議預設）

```text
                    ┌─ static web (optional, same origin)
Internet ─ wss ──► │  assmud-proxy (site)
                    └─ tcp 127.0.0.1:4000 ─► mud
```

| 旋鈕 | 預設 |
|------|------|
| `ASSMUD_PROXY_MODE` | `remote-prod`（**底層模式**；fail-closed auth/origin 仍適用） |
| `ASSMUD_SITE_MODE` | `0`；**`1` = T1-site 疊加**（見 S1.1）— **不是** `remote-prod` 別名 |
| bind | **建議 `127.0.0.1`**（僅本機 reverse-proxy／caddy 可連）；禁止文件暗示裸 `0.0.0.0` 無防火牆 |
| allowlist | **僅** 本站 mud host:port（`ASSMUD_ALLOWLIST`） |
| auth S1 | **shared site token**（閘道密）；**不**宣稱 per-player 身份 |
| Origin | 站方 web origin fail-closed |
| payload log | off |

**`SITE_MODE` vs `PROXY_MODE`（R1 fold）**

| | `PROXY_MODE=remote-prod` | `SITE_MODE=1` |
|--|--------------------------|---------------|
| 作用 | 生產 fail-closed：token、origin、limits | **額外**：hello dest **必須** ∈ allowlist；拒絕「任意 host」 |
| 可組合 | 是 | **`SITE_MODE=1` 的唯一合法 base = `remote-prod`** |
| 非法 | — | `SITE_MODE=1` + 任何非 `remote-prod` → **startup exit(1)** + log |
| 空 allowlist | — | `SITE_MODE=1` ∧ `ASSMUD_ALLOWLIST` 空 → **startup exit(1)**（防誤開 open relay） |

### 2.3 UX 文案（zh-TW 草案）

**連線本站閘道時（非 T3）：**

> 你經 **本站 Web 閘道** 連線。瀏覽器到閘道為加密傳輸（WSS）。  
> 遊戲協定多為傳統 telnet；**站方伺服器本來就能處理登入**（與桌面客端連站相同信任模型）。  

**禁止**：「端到端，站方也看不到密碼」。

### 2.4 與現有 selfhost 的關係

| 文件／模式 | 關係 |
|------------|------|
| T0 玩家本機 | 不變；多開最乾淨 |
| T1a 玩家 VPS | 不變 |
| **T1-site** | **新增**；站方 installer + 文件 |
| T2 官方 | 多開仍痛；站方模式是替代敘事 |

---

## 3. 出口 IP 與身份（S3–S4）

### 3.1 現實選項矩陣

| 方案 | mud 見 | 需 mud／shim | C0 可做？ | 建議 |
|------|--------|--------------|-----------|------|
| **A. 接受 local src + 改限連哲學** | proxy IP | 否 | **是** | **預設路徑** |
| **B. PROXY protocol v1/v2** | header 內嵌 client IP | **是**（driver 或 tcp shim） | 可選 flag | **可選進階** |
| **C. HAProxy/nginx stream + PROXY** | 同上 | 前置 + mud 支援 | 部署文件 | 站方自行加 |
| **D. IP_TRANSPARENT / 每連線 spoof** | 近似玩家 IP | root + 網路魔法 | 否 | **不做** |
| **E. proxy 稽核 log** | 仍 local | 否 | **是** | **必做配套** |
| **F. 站方 web 帳號 ↔ mud 帳號** | 不靠 IP | 站方整合 | 產品合作 | 長期 |

### 3.2 方案 A（預設）— 產品契約

1. 文件寫死：T1-site 下 mud 可能見 `127.0.0.1`。  
2. **S1 身份能力（誠實版 · R1 fold）**  
   | 能力 | S1 | 非 S1 宣稱 |
   |------|----|------------|
   | 閘道 auth | shared site token | — |
   | 限連 | **per effective-client-IP** + **全域 concurrent** + 既有 hello/ws limits | **不**寫 per-player／per-token 身份限連 |
   | 遊戲多開 | **mud 帳號** 維度 | — |
   | per-player token / SSO | **後續**（S1.x / 站方整合） | 不可用 shared token 冒充 |
3. Ban 雙向缺口（寫死）：  
   - mud `getpeername` ban **打不中** web 玩家（多為 127.0.0.1）。  
   - proxy 層 ban `effectiveClientAddr` **不會**自動寫入 mud ban list（除非 PROXY+mud 支援且站方串接）。  
   - CDN 下 effective IP = **edge** → **禁止**當唯一 ban；S1 無站方 SSO 時只能：關 shared token／降全站 concurrent／站方人工。  
4. 限流：bucket key = **`effectiveClientAddr`**（§3.3.1 解析後）；在 **HTTP upgrade 完成前** 對 transport 可先用 peer 粗限，**auth 後／dial 前** 必須用 effective。dial timeout 有上限。

### 3.3 Effective client address + PROXY（R1 fold）

#### 3.3.1 如何得到 `effectiveClientAddr`

| 條件 | 行為 |
|------|------|
| 預設 | `effectiveClientAddr = transportPeer` |
| `ASSMUD_TRUSTED_HOP` | CIDR 列表 **和／或** `unix`（UDS peer）；peer 必須命中才信 header |
| 可信 peer 是誰 | = **連到 assmud-proxy 的那一跳**（若 caddy 在同機 UDS→proxy，配 `unix`；若 caddy 以 TCP 127.0.0.1 連 proxy，trusted = `127.0.0.1/32`，**不是** caddy 對外 public IP） |
| Header | 預設序：`CF-Connecting-IP`（**僅 CF 慣例**）→ 否則 `X-Real-IP`；可 env 鎖「唯一 header 名」。**不解析 XFF**。兩者皆在且不一致 → 用 CF（若有）+ audit warn |
| trusted 已開但 header 缺／非法 | **fail-closed**：  
  - 若在 **HTTP upgrade 前**可判 → **HTTP 403**（無 WS）  
  - 若已 upgrade → **WS close 1008**  
  **不**回退 peer |

**刪除**「XFF 最左」措辭（易被讀成取最易偽造端）。

部署文件必寫：upstream（Caddy/nginx/CF）**不得**把未剝離的客戶端可控 header 原樣交給 proxy，除非 peer 已是唯一可信 hop。

#### 3.3.2 方案 B — PROXY protocol v1（S2 experimental）

```text
# 僅 v1 文字；v2 binary = deferred
PROXY TCP4 <src.ip> <dst.ip> <src.port> <dst.port>\r\n
```

| 項 | 契約 |
|----|------|
| Env | `ASSMUD_PROXY_PROTOCOL=0\|1` 預設 **0** |
| 何時寫 | **僅** allowlisted dest **且 TCP connect 成功之後**、任何 telnet 位元組之前；**每個連線一次** |
| src | `effectiveClientAddr`（§3.3.1）；非 IPv4 → 可 `PROXY UNKNOWN\r\n` 或關協議（文件二選一：**C0 實作 UNKNOWN**） |
| dst | 實際 connect 的 mud IP:port（解析後） |
| 注入防護 | header 欄位只允許合法 IP／port 字形；長度上限 |
| 未支援 mud | 連線爛 → 預設關 |
| 測試 | mock 斷言首行；**負向**：protocol=0 時 byte-for-byte 無 PROXY 前綴 |

### 3.4 方案 E — audit metadata（S1 必做）

| 事件 | 記錄 |
|------|------|
| ws open | `token_hmac`（**HMAC-SHA256** 截斷，keyed by server secret；非裸 sha）、`effectiveClientAddr`、`transportPeer`、time |
| hello | dest host:port、ok/fail |
| close | reason code、byte counters |
| **禁止** | 密碼、payload、完整 token |

| 治理 | 契約 |
|------|------|
| 預設輸出 | stderr／可選 file path env；**不**進遊戲線 |
| 保留 | 文件建議 7–30 天 rotation；實作至少 **不**無限長單檔無輪替說明 |
| 權限 | 僅站方 root／log 群組可讀（部署文件） |
| injection | 結構化 log（JSON 一行）或嚴格 escape 欄位 |

---

## 4. 架構討論：Thin proxy + fat web  vs  TinTin 式 daemon + thin display

### 4.1 今日 assmud（已落地）

```text
[Browser React]
  VT buffer · UI · scripts (declarative) · vault
       │ WSS
[Node proxy]
  auth · allowlist · bridge TCP · MCCP
       │ TCP
[MUD]
```

| 優 | 劣 |
|----|-----|
| 一開網頁就能玩（手機友善） | 熱路徑／長連在 Node；站方要 Node 執行環境 |
| 與 ADR-002 一致 | 腳本／mapper 狀態在 browser → 關分頁易丟（除非雲端） |
| 迭代快 | 「像 zMUD 常駐」體感弱 |

### 4.2 TinTin++ 心智（對照）

```text
[tt++ daemon]
  TCP · #action · #map · session 常駐
       │
  可接：console / GUI /  theoretically remote UI
```

| 優 | 劣 |
|----|----|
| 執行與狀態在 daemon；UI 可換 | 瀏覽器不能當「零安裝 daemon」 |
| 適合桌面 power user | 手機要另裝／另跑常駐 |

### 4.3 選項（裁決用）

#### 選項 **W0** — 維持：Node proxy + fat web（現狀強化）

- T1-site = **部署／政策／可選 PROXY**，不換 core 語言  
- Web 繼續握 VT／腳本／vault  
- **最適合**：現在就 ship 站方模式  

#### 選項 **D1** — **Split：Session Daemon + Display Client**（推薦中期方向）

```text
[Display]
  Web / 未來 native UI
  渲染 cells、輸入、**本地 vault／無障礙／偏好可留 display**
       │  session protocol (WSS or local IPC)
[Session daemon]  ← Node 先驗證，Rust 後換引擎
  TCP·MCCP·telnet · （可選）腳本 · （可選）mapper
       │
[MUD]
```

**兩種 deployment role（R1 強制拆分 · 不可混談）**

| Role | 誰跑 | 可承載 | **不可**預設承載 |
|------|------|--------|-------------------|
| **G-daemon**（站方 gateway） | 站方 | TCP bridge、allowlist、auth edge、限流、audit | 玩家 vault 明文、跨租戶腳本任意執行、自動登入密 |
| **P-daemon**（玩家私有 session） | 玩家本機／玩家 VPS | 上列 + 本地自動登入 + 腳本 + mapper 狀態 | 多租戶 |

T1-site **S0–S2 = 強化 G-daemon（現 Node proxy）**，不是把 browser vault 丟上站方。  
D1 ADR 必須先定 **ownership／租戶隔離**，再談狀態下沉。

#### 選項 **R2** — **Rust core daemon 為 SSOT**（長期）

- 熱路徑、記憶、bridge 全 Rust  
- Node proxy **退役或變薄**（僅 reverse-proxy 邊緣）  
- Web 經 WSS 訂閱 **cell diff / input** 協定  

| 何時才做 | 門檻 |
|----------|------|
| Node bridge CPU／延遲成可測瓶頸 | 有 profile 數據 |
| 站方要單一二進位嵌入 mud 機 | 運維需求 |
| 桌面「無瀏覽器也能玩」 | 產品要 desktop shell |
| 腳本要強到接近 tt++/Mudlet | 引擎重寫理由 |

**禁止**：為了「Rust 比較酷」在無門檻下重寫。

### 4.4 建議裁決（plan 預設）

| 時程 | 選擇 |
|------|------|
| **現在（本 plan 實作範圍）** | **W0 + T1-site 文件／開關／可選 PROXY + 稽核** |
| **中期 ADR** | **D1 方向鎖定**：定義 **Session Protocol v0**（顯示與執行分離），daemon **先可用 Node 抽離**（從現有 proxy+部分 web 狀態下沉） |
| **長期** | 達 §4.3 R2 門檻再 **Rust 實作同一 Session Protocol** |

一句話（**角色限定**）：

> **P-daemon（玩家私有）** 路徑上，Web 應趨向 thin display＋輸入（本地 vault／a11y 可留 web）。  
> **G-daemon（站方）** 只做閘道／bridge／限流／audit——**不**把玩家 vault／自動登入／任意腳本下沉到站方。  
> 今天的 Node proxy = **G-daemon 雛形**；Rust = 同協定換引擎，達門檻才做。

### 4.5 Session Protocol v0（草案 · 非本 plan 實作）

| 方向 | 訊息（概念） |
|------|----------------|
| display ← daemon | `frame` / `cell_patch` / `bell` / `echo_mask` / `status` |
| display → daemon | `input_line` / `naws` / `ping` |
| 控制 | `hello`（profile dest）/ `auth` / `disconnect` |

與現有 JSON over WSS **可演進**，不要求 big-bang。

---

## 5. 實作分期（T1-site 工程）

### Phase S0 — 契約與文件（可先 ship 文件）

| ID | 交付 |
|----|------|
| **S0.1** | 信任表加入 T1-site；i18n 文案 |
| **S0.2** | `docs/deploy/SITE-OPERATOR.md`：站方 docker-compose 例（proxy+可選 caddy，allowlist 本機 mud） |
| **S0.3** | threat model 補「站方模式」一段 |
| **S0.4** | README 部署模式表：玩家本機／玩家 VPS／**站方**／官方 |

### Phase S1 — Proxy 行為

| ID | 交付 |
|----|------|
| **S1.1** | `ASSMUD_SITE_MODE=1` 契約（§2.2）：與 `remote-prod` 組合；非法組合 fail-fast；hello dest ∈ allowlist |
| **S1.2** | Audit（§3.4）：HMAC token、effective+transport addr、JSON 行、禁 payload |
| **S1.3** | 限流：upgrade/auth/dial **前** per-IP；concurrent 全域；**S1 不宣稱 per-player token 限連** |
| **S1.4** | 測試：allowlist 拒連；偽造 X-Real-IP 自非 trusted peer **無效**；trusted hop 缺 header **拒連**；audit 抽樣無密碼 |
| **S1.5** | 文件：CDN 下 ban-IP 失效；shared token rotation 步驟 |

### Phase S2 — 可選 PROXY protocol

| ID | 交付 |
|----|------|
| **S2.1** | `ASSMUD_PROXY_PROTOCOL=1` 時 TCP 連上後先寫 PROXY v1 |
| **S2.2** | mock server 測試；預設 0 |
| **S2.3** | 文件：僅當 mud/shim 支援；RW 未驗證則標 experimental |

### Phase S3 — Session 分離（ADR + spike，不強制換 Rust）

| ID | 交付 |
|----|------|
| **S3.1** | ADR-00x：D1；**G-daemon vs P-daemon**；TinTin 類比；Rust 門檻；**「Node 已夠則 R2 可無限擱置」** |
| **S3.2** | Session Protocol v0：版本協商、ownership、resume 目標；與現有 WS 對照；`echo_mask` TBD 標註 |
| **S3.3** | Spike（可選）：daemon 邊界圖；無大重寫 |

---

## 6. 測試 / 驗收

| 層 | 內容 |
|----|------|
| Unit | site mode allowlist；SITE+dev 非法組合；偽造 header；trusted 缺 header 拒連；PROXY=0 無前綴；PROXY=1 首行；audit 無 payload |
| Manual | compose → wss → 假 mud |
| 文件 | 出口 IP + CDN caveat 一頁講完 |

---

## 7. Risks

| 風險 | 緩解 |
|------|------|
| 站方以為 wss = 密碼對自己不可見 | 文案禁止 |
| PROXY 開了 mud 不懂 → 全站不能玩 | 預設 0；顯眼 experimental |
| XFF 偽造 | 只信單一 trusted hop；預設不信 |
| 過早 Rust 重寫 | R2 門檻；S3 只 ADR |
| 與 T3 混淆 | T1-site 明示「站方＝遊戲營運」 |

---

## 8. Open questions（Board）

1. T1-site 是否要 **強制** 站方提供「非 localhost 的 public mud IP allowlist」備援（雙機部署）？  
2. PROXY v1 是否進 S1 還是嚴格 S2 experimental？  
3. Session Protocol v0 是否與 mapd Companion 並行（display 幀從 daemon 來）？  
4. 站方模式 auth：沿用 `ASSMUD_AUTH_TOKEN` 共用密，還是要 per-player 站方 SSO（更大）？  

**預設若 Board 不回：**

| # | 預設 |
|---|------|
| 1 | 文件支援雙機；compose 預設 localhost mud |
| 2 | **S2 experimental**，不挡 S0–S1 |
| 3 | 並行文件；不耦合 companion C0 |
| 4 | S1 = **shared site token 僅閘道** + per-IP 限流；SSO／per-player = 後續 |

---

## 9. 與「Rust = TinTin daemon」的一句裁決

| 命題 | 裁決 |
|------|------|
| Web 只負責顯示？ | **方向：是**（中期 D1） |
| 現在立刻 Rust？ | **否** — 先 T1-site + 可選 PROXY + 限流／稽核 |
| Node proxy 定位 | **Session daemon 雛形**，站方可先跑 Node |
| Rust | **同一協定的未來引擎**，達門檻再換 |

---

## 10. Status

| 狀態 | 條件 |
|------|------|
| draft | now |
| approved | plan-hetero ALL_CLEAR |
| S0–S1 impl | after approved |
| S2–S3 | 可平行文件／spike |

**Hetero 請審：** T1-site 契約、IP 選項 honesty、S 分期、D1/R2 架構裁決是否可接受、false-ship 風險。
