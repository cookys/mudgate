# zMUD 輸入 / Focus / 送指令 — 操作模型（vs mudgate）

> **目的**：手邊沒 zMUD 時，用這份當「案件與操作行為」SSOT，決定要不要 1:1 port。  
> **來源**：既有 matrix §1.1 ECHO survey、UI redesign plan、Zugg 產品慣例、Mudlet/line-mode 對照、mudgate 現況 code。  
> **不是**完整 zScript 手冊；只涵蓋 **怎麼 focus、怎麼走路、怎麼送指令**。

---

## 0. 一句話

zMUD（與多數桌面 MUD 客）是：

> **輸出窗（可回捲） + 底部獨立指令列（line editor）+ 應用層熱鍵（numpad 方向）**  
> 不是「終端機 TTY 鍵盤直通」。

mudgate 也走同一架構，但 **熱鍵／focus 規則還沒對齊手感**，所以會覺得怪。

---

## 1. zMUD 經典操作模型（玩家預期）

### 1.1 兩個面

| 面 | 角色 |
|----|------|
| **Output / 文字窗** | 只顯示伺服器輸出 + 可選「自己送出的指令回顯」；可 scrollback |
| **Command line / 指令列** | 打字、編輯、Enter 送出；alias 在這裡展開 |

### 1.2 Focus（焦點）

| 行為 | zMUD 慣例 |
|------|-----------|
| 平常打字 | Focus 在 **指令列** |
| 點一下輸出窗選字／捲動 | 選完後多數人仍會 **回到指令列**（或下一個鍵直接進指令列） |
| 開 Preferences / 對話框 | Focus 離開主窗 → 熱鍵暫停或僅對話框用 |
| **重要** | **Numpad 方向是主窗熱鍵**，不是「只有輸出窗 focus 才走路」 |

也就是你記得的：

> **Focus 在指令列（command line / textarea）時按 numpad → 立刻送 `n`/`s`/…**  
> 不必先把 focus 移出輸入框。

（密碼 mask 期間例外：不要把 numpad 當方向，以免密碼被送成指令。）

### 1.3 送出指令

| 鍵 / 動作 | 行為 |
|-----------|------|
| **Enter** | 送出整行 → 清空（或依選項保留）→ 可選 echo 到輸出窗 |
| **一般字母數字** | 進指令列 buffer，**不**立刻送 |
| **Numpad 1–9**（方向表） | **立刻送完整指令**（等同打完 `n` 再 Enter），**不**把數字塞進指令列 |
| **↑ / ↓**（主鍵盤） | 通常是 **指令歷史**，不是走路 |
| **主鍵盤方向鍵** | 編輯游標 或 歷史；**走路預設靠 numpad** |

### 1.4 Numpad 對照（zMUD keypad 預設語意）

```
7 nw   8 n    9 ne
4 w    5 look 6 e
1 sw   2 s    3 se
```

- NumLock **開**：`Numpad8` → `n` …  
- NumLock **關**：同位置變成 Arrow/Home/Pg*（location=numpad）→ 仍應走路  
- 可在 zMUD 裡改成自訂字串（speedwalk 等）；預設就是方向指令

### 1.5 三層 echo（已 survey，勿混）

見 [`zmud-feature-matrix.md` §1.1](./zmud-feature-matrix.md)：

| 層 | 平常 | 密碼 |
|----|------|------|
| A 指令列顯示正在打的字 | 明文 | WILL ECHO → mask |
| B Enter 後回顯到輸出窗 | 可開關 | 不可洩密 |
| C 伺服器 remote echo 每鍵 | 多數 MUD 不做 | 不做 |

---

## 2. mudgate 現況（2026-07-22 · input UX ship）

| 項目 | mudgate | 跟 zMUD 比 |
|------|--------|------------|
| 獨立 command bar + 輸出 canvas | ✅ | 同架構 |
| Enter 送出 | ✅ `submitCmd` | 同 |
| Numpad → n/s/…/look | ✅ `numpadDirs` + `onUserCommand` | 對照表一致 |
| Focus 在 **command input** 時 numpad 仍走路 | ✅ | 對齊 |
| Focus 在 **設定 drawer 的其他 input** 時不搶 numpad | ✅ | 合理 |
| 密碼 mask 時不搶 numpad / 不進歷史 / 不 echo | ✅ | 對齊 |
| 點終端 → **自動 focus 指令列** | ✅ | 對齊 |
| 連線後 focus 指令列 | ✅ | 對齊 |
| 在輸出區打字 → 路由到指令列 | ✅ printable keys | 對齊 |
| 主鍵盤 ↑↓ 指令歷史 | ✅ `CommandHistory` | 對齊 |
| Enter / numpad 後 **Echo commands**（› 行） | ✅ 預設開；drawer 可關 | 對齊 |
| 指令列多行 textarea | ❌ 單行 `input` | 仍不同（P2） |
| scrollback 滾輪 / PageUp | ✅ | 有了 |
| NAWS = 真實可視格數 | ✅ | 有了 |

### 實作對照（code）

| 行為 | 檔案 |
|------|------|
| 指令歷史 | `apps/web/src/lib/commandHistory.ts` |
| Echo 偏好 | `loadEchoCommands` / `saveEchoCommands` → `localStorage mudgate.echoCommands` |
| 送出 + history + echo | `App.tsx` `submitCmd` |
| Numpad → submitCmd | `TerminalHost` `onUserCommand` |
| 點 canvas focus | `TerminalHost` `onRequestFocusCmd`（click without drag） |
| Local › 行 | `TerminalHost` `localEcho` → dim cyan `› line` |
| 指令列 ↑↓ | `App.tsx` command `input` `onKeyDown` |

---

## 3. 要不要「照著 port」？

### 建議：**port 操作模型，不 port 整個 zMUD UI**

| 優先 | 行為 | 狀態 |
|------|------|------|
| **P0** | Focus 在 command 時 numpad 走路 | **done** |
| **P0** | 點終端 / 連上後 **自動 focus 指令列** | **done** |
| **P1** | ↑↓ 指令歷史 | **done** |
| **P1** | 可選「Echo commands」（密碼永不 echo） | **done**（預設開） |
| **P2** | 指令列改 textarea（Shift+Enter 換行 / Enter 送） | todo |
| **P2** | Numpad 可設定（關閉 / 自訂字串） | todo |
| **—** | 完整 zScript keypad 編輯器 | wont / 過大 |

### 明確 **不要** 1:1 的

- 桌面 modal 對話框全套  
- 鍵盤「字元模式直通 NVT」（我們是 line-mode + proxy）  
- 預設把主鍵盤方向鍵改成走路（會跟編輯／無障礙衝突；zMUD 也是 numpad 為主）

---

## 4. 驗收清單（有 zMUD 手感就過）

連上 RW 後：

1. [x] 游標在指令列 → 按 Numpad8 → 立刻走 `n`，指令列不必先有字  
2. [x] 點一下輸出區 → focus 指令列；再打字進指令列  
3. [x] ↑ 取出上一句指令，Enter 再送  
4. [x] 密碼提示時 numpad **不要**走路；不進歷史、不 echo  
5. [x] 送出後終端出現淡色 `› n`（Echo commands 開時）  
6. [x] 右上角 `cols×rows` 接近視窗；下半 prompt 看得到  
7. [ ] （人工）NumLock 關時 numpad 箭嘴仍走路  
8. [ ] （人工）drawer 關掉 Echo commands 後不再出現 `›` 行 

---

## 5. 與其他文件的關係

| 文件 | 內容 |
|------|------|
| [`zmud-feature-matrix.md`](./zmud-feature-matrix.md) | 功能有無 + ECHO 協定 |
| [`client-matrix-mudlet-beip-web.md`](./client-matrix-mudlet-beip-web.md) | 跨客戶端能力 |
| 本檔 | **操作手感 / focus / 送指令 / numpad** |
| UI redesign plan | 「點終端 → 聚焦 input」曾列為目標 |

---

## 6. 實作備註（mudgate code）

| 行為 | 位置 |
|------|------|
| Numpad map | `apps/web/src/lib/numpadDirs.ts` |
| 指令歷史 | `apps/web/src/lib/commandHistory.ts` |
| 熱鍵 + focus 過濾 | `TerminalHost.tsx` keydown |
| Numpad → 統一送出 | `onUserCommand={submitCmd}` |
| Command bar + ↑↓ | `App.tsx` footer `input` |
| ECHO mask | `App.tsx` `echoMask` → `type=password` |
| Echo commands 偏好 | drawer checkbox · `mudgate.echoCommands` |
| 送出 | `fireInject` → `{ id, line }`（**id 必變**，同指令可連送）→ `MudSocket.send` |
| 點終端 focus | `onRequestFocusCmd` on click-without-drag |
| 自動登入 | **vault 解鎖後** account + password + autoLogin；ECHO mask 送密；見 `profile-secrets-vault` plan |
| 密碼 at-rest | WebCrypto AES-GCM vault + 主密碼（`mudgate.vault.v1`）；非明文 |

### Enter 送不出去的 bug（已修）

舊實作：`setCmd("n")` 當 state 已是 `"n"` 時 React **不重跑** effect → 第二次 Enter 靜默失敗。  
新實作：每次送出 `injectPayload = { id: ++n, line }`，effect 依 `id` 觸發。

### 自動密碼：不要用 Password trigger

| 做法 | 評價 |
|------|------|
| 抓畫面「Password:」文字 | 多語系/改提示就炸；RW 未必英文字串 |
| **Telnet WILL ECHO → mask → 送密** | 協定級，zMUD/Mudlet 同語意；**mudgate 採用** |
| 連線後延遲送 account | 對齊「login 提示後打帳號」的實務 |

Profile 編輯：Account + Password + Enable auto-login + plaintext opt-in。
