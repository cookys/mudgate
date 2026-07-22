# Plan — W05 ECHO password mask（短暫輸入遮罩）

> **Status**: SHIP  

> **Owner**: cookys  
> **Ship**: `/ship w05`  
> **SSOT semantics**: [`docs/research/zmud-feature-matrix.md`](../research/zmud-feature-matrix.md) §1.1  
> **Parent**: [`2026-07-21-rw-connect-protocols.md`](./2026-07-21-rw-connect-protocols.md) C2  

## Goal

MUD 伺服器短暫 `IAC WILL ECHO` 時，web 輸入列 **mask**（`*` / password 樣式）；`IAC WONT ECHO` 後 **立刻恢復**明文。  
平常玩仍看得到自己打的字。

## Non-goals

- Trigger / prompt 文字猜「第二行是密碼」
- 全程 `type=password`
- 指令回顯到 scrollback 的偏好（Echo commands）— 另案
- Character DB auto-login `#PW`

## Wire contract

| Server | Client reply | UI |
|--------|--------------|-----|
| `IAC WILL ECHO` | `IAC DO ECHO` | `mask=true` |
| `IAC WONT ECHO` | `IAC DONT ECHO` | `mask=false` |
| `IAC DO ECHO`（反轉 MUD） | `IAC WILL ECHO` | `mask=true`（相容） |
| `IAC DONT ECHO` | （可忽略或 DONT 已成立） | `mask=false` |

Proxy → browser JSON control（text frame）:

```json
{ "type": "echo", "mask": true }
{ "type": "echo", "mask": false }
```

**不**佔用 `StatusEvent` 連線狀態（避免覆蓋 `connected`）。

## Layers

| Layer | Change |
|-------|--------|
| `packages/protocol` `replyToNegotiation` | WILL ECHO → DO；DO ECHO → WILL（反轉） |
| `apps/proxy` `bridge.ts` | 追蹤 mask；WILL/WONT/DO/DONT ECHO → JSON `echo` |
| `apps/web` `mudSocket.ts` | parse `type:echo` → `onEchoMask(boolean)` |
| `apps/web` `TerminalHost` / `App` | **僅**當 `mask===true` 時將輸入設為 `type="password"`；`false` 恢復 `type="text"`。**禁止**永久 password type / 純 CSS 當唯一遮罩。disconnect / unmount 清 mask |

## Acceptance

1. Unit `replyToNegotiation` 四案：`will→DO`、`wont→DONT`、`do→WILL`（反轉）、`dont→WONT`。  
2. Bridge test: WILL → DO + JSON `{type:echo,mask:true}`；WONT → DONT + `mask:false`；反轉 DO ECHO → WILL + mask true。  
3. MudSocket：`type:echo` 走 `onEchoMask`，**不**改寫 `StatusEvent` 連線 code。  
4. Web：`echoMask` 控制 `input type` password↔text。  
5. `npm test` + `npm run build -w @mudgate/web` 綠。  
6. matrix W05 → `done`（RW 實機 checklist 可 residual）。  

## Residual (ok to ship)

- RW 實機是否真送 WILL/WONT：連線 checklist 另記，不擋 ship。  
- 伺服器忘記 WONT：可後加 timeout / 「顯示輸入」按鈕（P2 nit）。  

## Out of scope

Prompt-text fallback、#PW、logging redaction beyond existing security rules.
