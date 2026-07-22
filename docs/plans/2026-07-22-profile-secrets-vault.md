# Plan — Profile manager UX + secrets vault (encrypt at rest)

> **Status**: **SHIP** (impl on develop) · plan hetero ALL_CLEAR R6  
> **Owner**: cookys  
> **Date**: 2026-07-22  
> **Supersedes / extends**: `2026-07-21-profile-library.md` (SHIP skeleton; secrets were **plaintext opt-in**)  
> **Related**: `docs/research/zmud-input-ux.md` auto-login; trust modes T0–T3  

## 0. Problem (user report)

1. **「沒看到 profile」** — CRUD / 帳密 UI **只掛在 ConnectGate**（未連線畫面）。連上後 ⚙ drawer 只有 **profile 下拉**，沒有 Edit / New / 密碼欄 → 功能「像沒做」。  
2. **密碼存哪** — 今日：`localStorage` key `mudgate.profileSecrets`，**明文 JSON**（有 opt-in 勾選，**無** AES / WebCrypto）。  
3. 需要把 **可見的 profile 管理 + 加密 vault + auto-login** 合成一案，hetero 過再 impl。

### 0.1 已落地（勿重做）

| 能力 | 狀態 | 位置 |
|------|------|------|
| Profile schema + validate + RW seeds | done | `@mudgate/profiles` |
| Export 不含 secrets | done | `sanitizeProfileForExport` |
| 明文 secrets + opt-in | done（**將被 vault 取代**） | `secrets.ts` |
| ConnectGate `ProfileEditor` | done 但 **僅 pre-connect** | `ConnectGate.tsx` |
| Auto-login：account 延遲 + password on WILL ECHO | done | `App.tsx`（依 secret 旗標） |
| 指令 inject `{id,line}` | done | Enter 可靠送出 |

### 0.2 本 plan 交付

| ID | 交付 | 驗收 |
|----|------|------|
| **U1** | **連線中也可開 Profile 管理**（drawer 或 modal） | 連上後不需斷線即可 New/Edit/Delete、改帳密、auto-login |
| **U2** | ConnectGate 與 in-session 共用同一 `ProfileEditor` | 單一路徑、無雙份 UI 漂移 |
| **U3** | i18n 標籤（中/英）「設定檔 / Profiles」入口明確 | 不靠英文藏在連線頁 |
| **V1** | **Vault 加密 at rest**（WebCrypto AES-GCM） | localStorage 只見 ciphertext / salt / iv；明文不落盤 |
| **V2** | **主密碼** 解鎖 session | 重載後需 unlock 才可讀密 / auto-login |
| **V3** | **原子遷移** 舊明文 → vault（見 §3.6） | 失敗保留明文；成功後刪明文 |
| **V4** | Export 永不含密 | 單元測試 |
| **V5** | **Corruption / multi-tab** 語意（見 §3.7） | 測試 + 文件 |
| **A1** | Auto-login 僅 vault unlocked + autoLogin | 鎖上不送 |
| **D1** | Threat model 誠實（含 unlock 當下攔截） | plan + deploy 短註 |

---

## 1. Threat model（誠實版 · R1 fold）

| 威脅 | Vault 能擋？ | 說明 |
|------|-------------|------|
| 離線 / 靜態讀 localStorage **無**主密碼 | **擋**（密文） | dump 檔案看不到密碼 |
| 同 origin **XSS / 惡意擴充** 在使用者**輸入主密碼當下** | **不擋** | 可攔截 master password 或之後記憶體 key |
| XSS / 擴充 在 **已 unlock** session | **不擋** | 記憶體已有 plaintext secrets |
| 本機攻擊者 + 已登入瀏覽器 profile | **不擋** | 同左 |
| Proxy / MUD 看 cleartext telnet | **不擋** | WSS≠E2E；線上永遠可能被看 |
| 匯出 JSON | **擋**（設計） | export 永不帶 vault 內密碼 |
| 忘記主密碼 | 不可恢復 | UI「清除 vault 重來」 |

**一句話**：vault 是 **at-rest 防護**（比明文 localStorage 好），**不是** anti-XSS password manager，也**不是** wire E2E。

**不是目標**：Argon2id 硬體綁定、雲同步、WebAuthn（可列 P3）。

---

## 2. UX

### 2.1 入口（解決「看不到」）

| 畫面 | 入口 |
|------|------|
| ConnectGate | profile 區 + 明確 **「管理設定檔…」** |
| Play shell（已連線） | ⚙ drawer · profile 下拉下方 **「管理設定檔…」** → `ProfileManager` modal |
| 可選 P2 | 頂欄快捷 |

### 2.2 欄位

| 欄位 | 必填 | 存哪 |
|------|------|------|
| id, name, host, port, charset, widthMode | 是 | `mudgate.profiles.v1` 明文 |
| account | 否 | **vault ciphertext only** |
| password | 否 | **vault** |
| autoLogin | 否 | **vault 內**（R1 決議：不放明文 profiles，避免洩漏「哪些會自動登」） |
| 同意文案 | 首次存密 | 「at-rest 加密 ≠ E2E；XSS/擴充仍可能在解鎖時偷密」 |

**Locked 時 UI**：profile 列可顯示 🔒；**不**顯示 autoLogin 開關真實狀態（改顯示「解鎖後可管理自動登入」）。避免為了 drawer 美觀把 autoLogin 放到明文。

### 2.3 Vault unlock UX

1. **首次存任何 secret**（account/password/autoLogin）：強制 **建立 vault**（主密碼 ×2）。僅改 host/port **不**逼建 vault。  
2. 之後啟動：vault 存在且 locked → unlock modal（可略過 → 本 session 無密、無 auto-login）。  
3. 錯密：可重試；**無**硬 lockout；任何時刻可「清除 vault」（不可恢復）。  
4. 手動鎖定；tab 隱藏 auto-lock = P2。  
5. 變更主密碼 = P2。

### 2.4 遷移 UX（明文 → vault）

若偵測到 `mudgate.profileSecrets`：

1. 一次性 dialog：**「發現舊版明文密碼庫。建立主密碼並匯入？ / 稍後 / 丟棄明文」**  
2. **匯入** = 走 §3.6 原子遷移（先寫 vault 並驗證，再刪明文）。  
3. **稍後**：每次開 Profile 管理再提示；**不**在背景默默刪。  
4. **丟棄**：確認後刪明文 key（不可恢復）。

### 2.5 Auto-login

- **禁止** 畫面 `Password:` 文字 trigger 當主路徑。  
- account：connected 後短延遲送一次；password：WILL ECHO / echoMask 送一次。  
- 前置：`vault.isUnlocked()` 否則 skip + toast。

---

## 3. 加密設計（V1）

### 3.1 演算法（WebCrypto）

| 步驟 | 選擇（R1 決議） |
|------|----------------|
| KDF | **PBKDF2-HMAC-SHA-256** |
| Iterations | **預設 600_000** 寫入 envelope；之後以 envelope `iter` 為準（可升級 re-wrap） |
| 密碼編碼 | **UTF-8** 再送入 KDF |
| 對稱 | **AES-256-GCM** |
| Salt | ≥16 bytes random / vault |
| IV | 12 bytes random **每 write** |

### 3.2 Storage keys

| Key | 內容 |
|-----|------|
| `mudgate.profiles.v1` | 非密 profiles |
| `mudgate.vault.v1` | 單一 envelope JSON |
| ~~`mudgate.profileSecrets`~~ | 僅遷移來源；成功後刪 |

### 3.3 Envelope

**兩個 localStorage key（分離 generation，避免 clear→recreate ABA）：**

| Key | 內容 |
|-----|------|
| `mudgate.vault.v1` | envelope 或 **缺席**（已 clear） |
| `mudgate.vault.meta.v1` | `{ "gen": number }` — **永不因 clearVault 歸零**；只遞增 |

```json
{
  "v": 1,
  "gen": 3,
  "rev": 12,
  "kdf": "PBKDF2-SHA256",
  "iter": 600000,
  "salt_b64": "...",
  "iv_b64": "...",
  "ct_b64": "..."
}
```

- **`gen`**：來自 meta；`createVault` / 遷移建庫時 `meta.gen++` 並寫入 envelope。`clearVault` **只刪 envelope**，meta.gen **保留**。  
- **`rev`**：同一 gen 內每次成功 persist +1；新 gen 從 rev=1 起。  
- 嚴格 validate：未知 `v` / 缺欄 / 非法 base64 → fail closed。  
- **Size bounds（KDF 前）**：envelope JSON ≤ 512 KiB；ct 解碼 ≤ 384 KiB；明文 ≤ 256 KiB。  
- **`iter` cap（KDF 前）**：必須為整數；**硬上限 2_000_000**；低於 100_000 拒絕（防可笑弱參數）。預設新建 600_000。畸形/過大 iter → **不呼叫 PBKDF2**，直接 throw。  

明文 payload（僅記憶體）：

```json
{
  "profiles": {
    "rw-4000": { "account": "...", "password": "...", "autoLogin": true }
  }
}
```

### 3.4 API

| API | 行為 |
|-----|------|
| `vaultExists()` | boolean |
| `createVault(masterPassword)` | 建空 vault；已存在 → error（勿默默覆蓋） |
| `unlock(masterPassword)` | 失敗 **throw**；成功 memory 持有 CryptoKey |
| `lock()` | 清 key + plaintext cache |
| `isUnlocked()` | boolean |
| `getSecret` / `setSecret` | **locked → throw**（禁止回傳模糊 empty） |
| `migratePlaintextSecrets(masterPassword)` | §3.6 |
| `clearVault()` | 使用者確認後刪 envelope |

**禁止**：master password 或 raw key 寫入 localStorage / sessionStorage。

### 3.5 測試

| 測試 |
|------|
| encrypt/decrypt round-trip（node webcrypto） |
| wrong password fails closed |
| export 永不含 password 字串 |
| migrate 原子性（失敗保留明文；成功刪明文） |
| locked getSecret throws |
| corrupt envelope fails closed |
| 不覆寫既有 vault（createVault 若已存在） |

### 3.6 原子遷移 + migration receipt（R3 MUST_FIX）

遷移成功寫入 vault 後、刪 legacy **前**，payload 內必須有 **authenticated receipt**（與 secrets 同在 GCM 密文內）：

```json
{
  "profiles": { "...": {} },
  "migration": {
    "from": "mudgate.profileSecrets",
    "at": 1720000000000,
    "entries": {
      "rw-4000": { "account": "hero", "password": "…", "autoLogin": true }
    }
  }
}
```

```
1. 讀 legacy；無 → no-op
2. exclusive lock（§3.7）
3. createVault 或 unlock
4. merge secrets；寫 migration.entries = **實際寫入/採用的精確值**（非僅 id 列表）
5. persist envelope；decrypt 驗證
6. **逐欄比對** vault 內 values === migration.entries（account/password/autoLogin）
7. 比對通過才 delete legacy
8. 失敗 → 保留 legacy
```

**刪 legacy 的充分條件（R5 MUST_FIX：含 key set 全等）：**

```
deleteLegacyOnlyIf:
  (0) receipt 存在且非空
  (1) keySet(vault.profiles ∩ migrated) 與 keySet(migration.entries) 全等
      （不得只遍歷 receipt id 而忽略 legacy 多出來的新 key）
  (2) keySet(currentLegacy) === keySet(migration.entries)
      （legacy 多了新 profileId 或少了 id → 不刪）
  (3) ∀ id ∈ migration.entries:
        deepEqual(vault[id], migration.entries[id]) AND
        deepEqual(currentLegacy[id], migration.entries[id])
```

若遷移後使用者又往 legacy 加了新 id → (2) 失敗 → **保留整份 legacy**（安全偏好；UI 可提示手動清理）。

**Crash 雙份 finish-delete：** 同上；缺 receipt → 不自動刪。

### 3.7 Corruption & multi-tab（R4 — snap + gen tombstone + locks）

#### Snapshot（必含 meta.gen，含 absent）

```ts
type VaultSnap =
  | { kind: 'absent'; metaGen: number }              // envelope 不存在；metaGen 仍讀自 meta key
  | { kind: 'present'; metaGen: number; gen: number; rev: number; raw: string };
// raw = envelope 的完整 JSON 字串（強制比對，非 optional）
```

`snapEqual(a,b)`：**全欄嚴格相等**（含 `raw` 字串全等）。  
`metaGen` 在 absent/present 都必填，來自 `mudgate.vault.meta.v1.gen`（無 meta 檔視為 0）。

#### clearVault tombstone（R4）

```
clearVault:
  meta.gen = meta.gen + 1     // 持久 tombstone；禁止歸零
  removeItem(mudgate.vault.v1) // envelope 刪除
```

之後 `createVault` 使用 **新** `meta.gen` 寫入 envelope.gen，rev=1。  
absent→create→clear→create 的 ABA 可透過 metaGen 變化偵測。

#### 寫入協議（修正 TOCTOU 錨點 · R4 MiniMax）

**錯誤**：mutate 後要求 `snapEqual(before, after)` — setSecret 後 rev 必變，恒 conflict。  

**正確**：

```
await withVaultLock(async () => {
  const before = readSnap();           // 預期進入狀態

  // 1) 依操作計算 intended 下一狀態（不寫盤）
  //    createVault: require before.kind==='absent';
  //                 nextMetaGen = before.metaGen + 1;
  //                 nextEnvelope = { gen: nextMetaGen, rev: 1, ... }
  //    setSecret:   require before.kind==='present';
  //                 nextEnvelope = { ...parsed, rev: before.rev + 1, new iv/ct }
  //                 metaGen unchanged
  //    clearVault:  require before.kind==='present' (or allow absent no-op);
  //                 next = absent with metaGen = before.metaGen + 1

  // 2) 寫前 re-read
  const still = readSnap();
  if (!snapEqual(before, still)) throw VaultConflictError;  // 他 tab 已改

  // 3) 原子寫盤（meta 若變先寫 meta，再寫/刪 envelope）
  persist(intended);

  // 4) 寫後驗證：readSnap() 必須等於 intendedSnap（含 raw 全等或 absent+metaGen）
  const after = readSnap();
  if (!snapEqual(intendedSnap, after)) throw VaultPersistError; // 不留半狀態盡力 clear 或報錯
});
```

| 情況 | 行為 |
|------|------|
| Web Locks 可用 | exclusive lock 包住 1–4 |
| Web Locks 不可用 | 同協議無 lock；degraded |
| GCM / 損壞 | throw；「清除 vault」 |
| storage event | 他 tab memory `lock()` + toast |

---

## 4. 非目標

- 雲端同步 vault  
- WebAuthn / 硬體 key（P3）  
- 加密整份 profiles（host 明文 OK）  
- 宣稱 E2E 到 MUD  
- 長期 **明文 compat 模式**（R1：禁止新增；legacy 僅遷移來源）  
- 完整 zMUD character DB 檔  

---

## 5. Phases & ship gate

| Phase | 工作 | Gate |
|-------|------|------|
| **A** | U1–U3 可見 Profile manager + i18n | 連線中可編輯 |
| **B** | V1–V5 + D1 vault + 遷移 + multi-tab 文件 | 單元測試；migrate 後無明文 key |
| **C** | A1 auto-login ∩ unlock | lock 不送 |
| **D** | docs | input-ux + profile-library 狀態 |

**Ship claim**：A+B+C + **hetero ALL_CLEAR 最新一輪** + `npm test` + web build。

### 手動 checklist

1. 未連線 / 已連線都看得到「管理設定檔」  
2. 僅改 host 不逼主密碼；首次存 password 才建 vault  
3. 重載未解鎖 → auto-login 不送  
4. 解鎖 → 連線 → account + password 自動  
5. Export 無 password  
6. 舊明文遷移成功後 key 消失；遷移失敗明文仍在  
7. 損毀 vault → 可清除重來  

---

## 6. Risks

| 風險 | 緩解 |
|------|------|
| 600k PBKDF2 慢 | UI「解鎖中…」；envelope 可升 iter |
| 忘主密碼 | 清除 vault |
| multi-tab clobber | §3.7 |
| 威脅模型被過度行銷 | §1 固定文案 |

---

## 7. Review log

| Round | Engines | Result |
|-------|---------|--------|
| R0 | — | draft |
| R1 | Codex **BLOCK**（3 MUST_FIX）；MiniMax **APPROVE_WITH_NITS** | fold → R1 body |
| R2 | Codex **BLOCK**（TOCTOU）；MiniMax **ALL_CLEAR yes** | Web Locks+rev |
| R3 | Codex **BLOCK**（4 MUST_FIX）；MiniMax **ALL_CLEAR yes** | gen / snap / receipt / iter |
| R4 | Codex **BLOCK**（3）；MiniMax **BLOCK**（偽代碼） | snap/tombstone/raw/寫入錨點 |
| R5 | Codex **BLOCK**（legacy key set）；MiniMax **ALL_CLEAR yes** | keySet 全等 |
| **R6** | Codex **APPROVE** ALL_CLEAR；MiniMax **APPROVE** ALL_CLEAR | **ship plan gate** |

Artifacts: `docs/reviews/2026-07-22-profile-vault-{codex,minimax}-r{1..6}.out`

### R2–R3 MUST_FIX → fold

| MUST_FIX | Fold |
|----------|------|
| Web Locks + rev | §3.7 |
| null absent/present races | §3.7 `VaultSnap` / snapEqual |
| clearVault ABA | `mudgate.vault.meta.v1` gen 持久 + envelope.gen |
| migration id-only 不夠 | §3.6 authenticated `migration.entries` 精確比對 |
| pathological iter | §3.3 iter cap 2e6 於 KDF 前 |

### R1 MUST_FIX → fold map

| MUST_FIX (Codex) | Fold |
|------------------|------|
| Threat model 誇大（僅 unlocked XSS） | §1 加「輸入主密碼當下可被同 origin 攔截」 |
| 原子遷移 | §3.6 |
| corruption / multi-tab | §3.7 |

### R1 NITS adopted

- iter **600_000** + envelope 版本化  
- autoLogin **僅 vault 內**  
- 禁止長期明文 compat；legacy 僅遷移  
- UTF-8 / strict validate / locked throw  
- MiniMax：locked UI 🔒；遷移 dialog；無 hard lockout  

---

## 8. Decisions (closed after R1)

| # | 決議 |
|---|------|
| 1 | PBKDF2 iter **default 600_000**，存 envelope，以 envelope 為準 |
| 2 | **autoLogin 在 vault 密文內** |
| 3 | **強制 vault** 於首次存 secret；無新明文模式；舊明文僅遷移 |

---

## 9. Hetero re-review request (R2)

Please re-read **this full plan** after R1 fold.

Return:
```
VERDICT: APPROVE | APPROVE_WITH_NITS | BLOCK
MUST_FIX: []
NITS: []
ALL_CLEAR: yes|no
```
