# Plan / Ship — UI shell + terminal UX (2026-07-21)

> **Status**: **SHIP**  
> **Branch**: `feat/ui-redesign` → merge `develop`  
> **Owner**: cookys  
> **Date**: 2026-07-21  

## Goal

把「ink terminal 殼層 + 連線穩定 + 終端可複製」收成可玩的 develop 狀態；語系／字體進階能力 **計劃凍結、下輪實作**。

## Shipped (this merge)

### A. UI shell（U0–U1 核心）

| Item | Detail |
|------|--------|
| Design tokens | `apps/web/src/styles/tokens.css` mint/blue accent |
| ConnectGate | 居中連線閘、tagline、accent、profile/token |
| PlayShell | topbar tabs、StatusPill、map 面板、⚙ drawer、command bar、thumb pad |
| Map | desktop 預設開、mobile 預設關 |
| Fonts CDN | Google Fonts + preconnect + display=swap |
| Spec | `docs/design/ui-spec.md` |

### B. 連線穩定

| Item | Detail |
|------|--------|
| MudSocket | 連線狀態機在 React 外（`lib/mudSocket.ts`） |
| Backoff | 2s 起指數放大、60s cap、jitter、最多 12 次 |
| StrictMode | dev 關閉雙掛載（WS 友善） |
| iconv-lite | stream/string_decoder/buffer polyfill（Big5 瀏覽器可用） |

### C. Session tabs

| Item | Detail |
|------|--------|
| Close × | 確認 modal（連線中警告斷線） |
| Last tab | 關完開新 idle（回 ConnectGate） |

### D. 終端顯示 / 複製

| Item | Detail |
|------|--------|
| 毛邊 | DPR 後備緩衝、移除 pixelated |
| 選取 | 拖曳選 cell、高亮 |
| 複製 | **純文字** / **含 ANSI 色碼** |
| 選單 | 浮在終端底＝指令列上方；整屏工具列；Ctrl/Shift+Ctrl+C |
| API | `snapshotText` / `snapshotAnsi` / selection export |

### E. Docs（計劃凍結、未實作）

| Plan | Status |
|------|--------|
| [i18n locale](./2026-07-21-i18n-locale.md) | Board frozen · **next** |
| [terminal-fonts](../design/terminal-fonts.md) | Spec ready · **next** |
| Hetero i18n | `docs/reviews/2026-07-21-i18n-hetero.md` |

## Explicitly NOT in this ship

- 三語 UI（zh-TW / zh-CN / en）實作  
- StatusEvent 結構化狀態（i18n 前置）  
- 終端字體切換 / 字寬字距 UI  
- 自架 Sarasa subset  
- 完整 light mode / dock 布局引擎  

## QC

| Check | Result |
|-------|--------|
| `npm test` | **30** passed |
| `npm run build -w @assmud/web` | OK |
| Proxy/WS | localhost-dev LAN 可用（環境視情況重啟） |

## Acceptance (ship gate)

1. ConnectGate → Connect → 終端可見 RW/MUD 輸出（Big5）  
2. 斷線重連有退避、不再 setState 風暴  
3. Tab × + modal 可用  
4. 選取後底部浮列可複製純文字 / 色碼  
5. develop 含以上 commit  

## Next plans (do not block ship)

1. **I1–I3** i18n + StatusEvent（`2026-07-21-i18n-locale.md`）  
2. **F1–F3** terminal dual-width fonts（`terminal-fonts.md`）  

## Review log

- 2026-07-21 — ship package cut from `feat/ui-redesign`; i18n/fonts deferred as approved plans  
