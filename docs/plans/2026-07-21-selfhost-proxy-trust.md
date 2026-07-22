# Plan — 自架 proxy 一鍵部屬 + 連線信任／密碼 UX

> **Status**: **SHIP**（feat/selfhost-proxy-trust → develop）  
> **Owner**: cookys  
> **Why**: 台灣 MUD 多開靠 **出口 IP**；共用 hosted 易撞。自架（Oracle／任意 VPS／**家用 + Cloudflare Tunnel·Zero Trust**／本機）是 **一等公民**。明文 telnet 下 **proxy 營運者必可見密碼**——用 UX／預設／一鍵安全預設處理，不能假裝 E2E。  
> **North**: 玩家 **極簡** 起「只服務自己」的 proxy；產品 **極難** 把不知情玩家導向陌生人 proxy。  
> **連動**: [`SELF-HOSTED-PROXY.md`](../deploy/SELF-HOSTED-PROXY.md)、[`hosted-proxy-threat-model.md`](../security/hosted-proxy-threat-model.md)、proxy-abuse、profile-library、cjk-cell-width §4  
> **Hetero**: `docs/reviews/2026-07-21-selfhost-proxy-trust-hetero.md`  

---

## 0. Problem

| 痛點 | 說明 |
|------|------|
| 共用 proxy IP | 熱門站同 IP 多開／限連 |
| 自架門檻高 | 玩家不會配 Node／Caddy／token |
| 惡意／不知情代架 | 他人 proxy 可讀 **明文 MUD 密碼**；無密碼學解法 |
| 一鍵腳本供應鏈 | `curl \| bash` 被換包 → 直接偷密 |
| 家用外網 | 不想開埠；可用 **Cloudflare Tunnel + Zero Trust** |

### 硬限制（寫死，禁止產品謊言）

> 當 MUD hop 為 **cleartext telnet** 時，**任何**能執行 proxy 行程的人（root／惡意 image／惡意 fork）都能看到帳密與指令。  
> **不存在**「第三方代跑 proxy 但密碼對他不可見」的乾淨解法。  
> **`wss://` 只保護瀏覽器↔proxy 傳輸**；**不**等於密碼對 proxy 營運者不可見。  
> 對策 = **信任拓撲 + UX 誠實 + 預設安全**，不是假 E2E。

---

## 1. Goals / Non-goals

### Goals

1. **G1 — 一鍵自架**：VM／機器就緒且（對外時）域名就緒後，**釘選版 installer + digest image** 起安全預設 proxy。  
2. **G2 — 安全預設**：loopback 綁定、token、Origin fail-closed、allowlist、不 log payload。  
3. **G3 — 信任 UX**：T0–T3；T3 地獄警告；預設不連陌生人。  
4. **G4 — 供應鏈**：installer SHA-256 → image digest 完整 pin 鏈。  
5. **G5 — 文件**：Oracle Always Free；**家用 Cloudflare Tunnel / Zero Trust**；誠實邊界。  
6. **G6 — Token 不當密碼洩漏**：不進 URL／export；輪替與取回流程。  

### Non-goals

| 不做 | 原因 |
|------|------|
| 保證 E2E 藏密碼（明文 MUD） | 物理不可能 |
| 社區「公共 proxy 節點目錄」 | 密碼農場 |
| 全自動開 Oracle 帳 | OCI 合規 |
| Colab／Workers 當正式 proxy | 不穩／ToS |
| 住宅代理池 | 濫用 |
| 用 CF 改變 MUD 看到的出口 IP | Tunnel 只管入口；出口仍是家用／VPS ISP |

---

## 2. 信任分級（產品 SSOT）

| 等級 | 模式 | 出口 IP（MUD 看到） | 誰看得到密碼 | 預設 UX |
|------|------|---------------------|--------------|---------|
| **T0a** | **本機日常**（正式本機 proxy，非 dev 命名） | 家用／公司 ISP | 僅本機 | **桌面預設推薦** |
| **T0b** | 開發用 localhost-dev | 同上 | 僅本機 | 僅開發文件；**勿暗示**拿來當唯一正式路徑文案 |
| **T1a** | **我的 VPS**（Oracle／Docker 一鍵） | 該 VPS IP | 有 root 者；**共用 VPS≈T3 風險** | 進階；需 **域名 + 公開 TLS**（見 §3.4） |
| **T1b** | **我家 + Cloudflare Tunnel／Zero Trust** | **家用 ISP IP**（多開友善） | 本機 root | 外出連自己的家；**不必開埠** |
| **T2** | 官方 hosted | 官方出口 | **官方營運** | 明示信任 mudgate；多開風險；**不**說「技術上看不到密碼」 |
| **T3** | 自訂 `wss://` | 未知 | **該 URL 控制者** | 預設折疊；模態 + 勾選後才連 |

**禁止**：內建「隨機公共節點列表」。

### T3 強制流程

1. 非本機、非官方 → 模態：  
   > **此伺服器的管理員可以看到你的 MUD 帳號與密碼**（遊戲多為明文）。  
   > **WSS 只加密到 proxy，不代表 proxy 看不到密碼。**  
   > 只在你完全信任架設者時繼續。  
2. 勾選「我了解」→ 才能 Connect。  
3. v1.1（可選）：記住 **TLS 憑證／公鑰 pin**（不是 hostname 字串）；變更再警告。  

### T2 官方

- 「密碼會經過 mudgate 官方 proxy；**政策上不記錄密碼字串**（見威脅模型）。」  
- **禁止**：「端到端加密」「官方也看不到」。  

---

## 3. 一鍵部屬設計

### 3.1 產物

| 產物 | 路徑 | 說明 |
|------|------|------|
| Compose | `deploy/docker-compose.proxy.yml` | proxy **預設 `127.0.0.1:7788`** |
| Caddy 範例 | `deploy/Caddyfile.proxy.example` | 公網 **僅 443** → reverse_proxy 到 loopback |
| Installer | `scripts/deploy/install-proxy.sh` | **版本釘選**；見 §3.3 |
| cloud-init | `scripts/deploy/oracle-cloud-init.yaml` | 調用 **固定 URL + SHA-256** 的 installer |
| 文件 | `ORACLE-ALWAYS-FREE.md`、`HOME-CLOUDFLARE-TUNNEL.md`、更新 `SELF-HOSTED-PROXY.md` |

### 3.2 安全預設（強制）

| 項 | 預設 |
|----|------|
| 綁定 | **`127.0.0.1:7788` only**（compose / install **不得**預設 `0.0.0.0:7788`） |
| 對外 | **僅** Caddy／nginx／**cloudflared**  terminat TLS 後轉 loopback |
| Mode | `remote-prod`（自架對外）或本機日常模式（另名，見 T0a） |
| Token | `openssl rand -hex 24` → 檔案 **`0600` root-owned**（如 `/etc/mudgate/auth_token`） |
| Token 顯示 | **互動 install**：先 `set +o history`（**必須**）→ 終端顯示 **一次** → 提示勿複製進聊天 |
| cloud-init | **禁止**把 token echo 到 console log；只寫 0600 檔；文件寫 **SSH 後 `sudo cat` 安全取回** |
| Token 禁出現 | **URL query、cloud-init userdata 明文、CI log、install 持久 log 檔** |
| Origin | **空 → fail closed 拒啟動 prod**；cloud-init 非互動：必須用 user-data 注入 `MUDGATE_ORIGIN_ALLOWLIST`（如 `https://mud.example.com`），缺則服務 **不 start** |
| Origin 語意 | **只限制瀏覽器 Origin，不取代 token**（文件雙寫） |
| 目的地 | allowlist（種子 RW；taiwanmud 可選 draft；**文件維護者更新 seed，玩家可自填**）；與 proxy `policy.ts` 對齊或抽出檔案（D1 寫明） |
| 日誌 | metadata only |

### 3.3 供應鏈 pin 鏈（Codex MUST — 具體）

```
1. 文件／release 公佈：
   INSTALLER_VERSION=vX.Y.Z
   INSTALLER_URL=https://github.com/.../releases/download/.../install-proxy.sh
   INSTALLER_SHA256=<hex>

2. 使用者或 cloud-init：
   curl -fsSL "$INSTALLER_URL" -o install-proxy.sh
   echo "$INSTALLER_SHA256  install-proxy.sh" | sha256sum -c -
   sudo bash install-proxy.sh

3. installer 內部：
   docker pull ghcr.io/OWNER/mudgate-proxy@sha256:DEADBEEF...   # 同 release 鎖定
   # 禁止 :latest 當 prod 預設
```

- R2 cosign 可延後；**本版至少 digest + installer SHA-256**。  
- **Release checklist 必有一欄**：`digest pin verified`（人工或 CI 勾選，在 cosign 前也要）。  
- 禁止「無 pin 的 curl|bash」當唯一官方路徑。  

### 3.4 TLS／域名（T1a）

| 路徑 | 要求 |
|------|------|
| **推薦** | 域名 → Caddy/Let's Encrypt → `wss://mud.example.com/ws` |
| **不推薦當預設** | `wss://<raw-ip>/ws`（無公開信任憑證；瀏覽器報錯） |
| 若堅持 IP | 文件必須：**私有 CA／mkcert** 或「僅同網測試」；**不得**寫成一般可行公開路徑 |

### 3.5 Token 生命週期

| 事件 | 行為 |
|------|------|
| 安裝 | 生成 → 0600 檔；互動可顯示一次 |
| 輪替 | `mudgate-proxy-rotate-token` 或文件步驟：重生、重啟、更新 web |
| 遺失 | SSH 讀檔或 rotate；**無「email 找回」** |
| 撤銷 | 等同輪替；舊 token 立即失效 |

### 3.6 Oracle Always Free

1. 誠實：需帳號／可能驗證；額度與地區限制；**非全自動註冊**。  
2. 「一鍵」= **VM + 域名（若對外）就緒後** 的 deploy。  
3. cloud-init：pin installer；寫 token 0600；Origin 來自 user-data；**loopback + Caddy**。  

### 3.7 家用 + Cloudflare Tunnel / Zero Trust（T1b）

> 玩家問題：在家配合 Zero Trust 是否可行？**可以，且建議作為 T1 家用主路徑之一。**

```
手機/外網 ──WSS──► Cloudflare Edge (Access 政策)
                      │ Tunnel
                      ▼
              家裡 cloudflared ──► 127.0.0.1:7788 mudgate-proxy
                      │
                      ▼ Telnet（出口 = 家用 ISP IP）
                    台灣 MUD
```

| 層 | 誰做 | 說明 |
|----|------|------|
| **入口** | CF Tunnel + Zero Trust Access | 不開家用埠；僅允許自己的 IdP／email |
| **出口** | 家用 ISP | MUD 看到 **你家 IP**（多開友善）；**不是** CF 出口 IP |
| **密碼** | 本機 proxy | 信任自己；CF 終止 TLS 屬 Cloudflare 信任域（文件一句帶過） |
| **Origin allowlist** | `https://你的域名` | 與 Access 應用 hostname 一致 |
| **Token** | 仍要 | Access ≠ 取代 MUDGATE_AUTH_TOKEN |

**文件產物**：`docs/deploy/HOME-CLOUDFLARE-TUNNEL.md`（cloudflared 安裝、Public Hostname → `localhost:7788`、Access 政策、Web 選 T1b）。

**不要**：把 Tunnel 講成「換出口 IP 躲多開」——那是錯的。

### 3.8 密碼文案（安裝成功）

- root／docker 可看 MUD 密碼。  
- 勿分享 VPS／token；勿用朋友「免費公共 proxy」。  
- 類比：zMUD／MudClient 裝在室友電腦。  
- 共用 VPS → **當 T3 風險** 再警告。  

---

## 4. Web 連線信任 UI（U1 + U2）

### 4.1 連線設定

```
○ 本機（T0a）              預設桌面
○ 我的自架（T1）           子選：VPS 文件 | 家用 Cloudflare 文件
○ mudgate 官方（T2）        僅當 site config 有 officialProxyUrl，否則隱藏
○ 其他伺服器（T3）         警告後解鎖
```

### 4.2 i18n

`trust.mode.*`、`trust.warn.custom`（含 WSS≠E2E 句）、`trust.warn.official`、`trust.selfhost.cta`、`trust.home.cf` — zh-TW / zh-CN / en。

### 4.3 Token 儲存（U2 = **本 ship 必要**）

| 規則 | |
|------|--|
| 與連線設定分開儲存 | 如 `mudgate_proxy_token`（既有可沿用） |
| **禁止**進 profile export JSON | 與 profile-library secrets 同原則；profile-library 未完成前先 **硬排除 token 欄** |
| UI 標示 | 「視同密碼」 |

### 4.4 Acceptance（UI）

1. 新安裝：**無警告不可連 T3**。  
2. T3 未勾選 → Connect disabled。  
3. T2 僅 `officialProxyUrl` 存在時顯示。  
4. T1 連到 ORACLE + HOME-CLOUDFLARE 文件。  
5. Export profile **不含** proxy token。  

---

## 5. Phases

| ID | Work | Size | Ship |
|----|------|------|------|
| **D1** | compose **127.0.0.1**、Caddy 例、install-proxy.sh（SHA 文件位）、env 範本、allowlist 對齊 | S | **是** |
| **D2** | ORACLE-ALWAYS-FREE.md + cloud-init（pin + 0600 token + Origin fail-closed） | S | **是** |
| **D2b** | HOME-CLOUDFLARE-TUNNEL.md + SELF-HOSTED 更新（T1a/T1b） | S | **是** |
| **D3** | threat-model：自架／惡意 proxy／WSS≠E2E／CF 入口 | S | **是** |
| **U1** | 信任模式 UI + T3 模態 + i18n | M | **是** |
| **U2** | token 不進 export + 視同密碼 | S | **是（必要）** |
| **R1** | CI：`docker compose config`；installer 存在性 | S | **是（D1 附帶）** |
| **R2** | cosign／image 發布管線 | M | 下一刀 |
| **R3** | OCI Terraform | M | 下一刀 |

**本 ship**：**D1–D3 + D2b + U1 + U2 + R1**。

---

## 6. Acceptance（整體）

1. 文件齊：Oracle、Home CF Tunnel、compose、installer pin 說明。  
2. Prod：**無 token 或無 Origin → 不起服務**。  
3. 預設 **不** 監聽 `0.0.0.0:7788`。  
4. Installer／image pin 鏈寫進 release 檢查清單。  
5. UI T3 阻擋；export 無 token。  
6. threat-model 含硬限制與 CF 入口／家用出口說明。  
7. `npm test` + web build 綠。  
8. **無**公共 proxy 目錄。  
9. HOME-CF 文件明示：**Access 禁止 world Bypass**；範例政策 = 僅自己的 email／IdP。  
10. Release checklist 含 **digest pin verified**。  

---

## 7. Risks

| 風險 | 緩解 |
|------|------|
| token 貼 Discord | UI「視同密碼」+ 輪替文件 |
| 惡意 install 重打包 | SHA-256 + digest |
| 把 wss 當 E2E | 模態強制句 |
| CF Access 設 Bypass 全世界 | 文件禁止；截圖走「僅我的 email」 |
| 共用朋友 VPS | T1 文案 + 當 T3 風險 |

---

## 8. Hetero 焦點（R0）

見 review 產物；R0 Codex **BLOCK** 五條 MUST 已 fold 至 §3.2–3.5、U2、T0 命名、T1 TLS。

---

## 9. Review log

| Round | Engines | Result |
|-------|---------|--------|
| R0 | Codex / MiniMax / GLM-5.2 | Codex **BLOCK**；MM/GLM APPROVE_WITH_NITS |
| R1 fold | — | pin 鏈、loopback、token 0600、Origin fail-closed、T1 域名 TLS、T1b CF、U2 必要 |
| R2 | Codex **APPROVE**；MiniMax **APPROVE**；GLM APPROVE_WITH_NITS | MUST_FIX 空；nits → history MUST、release checklist、CF no Bypass |
| R3 | Codex / MiniMax / GLM 皆 **APPROVE** | MUST_FIX [] NITS [] **ALL_CLEAR: yes** |

## 10. References

- Session：Oracle／Colab／free PaaS egress；密碼明文；**家用 Cloudflare Zero Trust**  
- `docs/deploy/SELF-HOSTED-PROXY.md`、`docs/security/hosted-proxy-threat-model.md`  
- `apps/proxy` policy token / Origin  
