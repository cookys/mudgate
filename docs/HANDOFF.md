## 目標

assmud：中文優先 web MUD 客端；本 session 收斂 **nav/map 產品**、**site/player 雙模式架構**、多份 plan hetero ALL_CLEAR；clear ctx 後可接 **impl** 或續架構。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | `95beed9` — `docs: lock site mode vs player mode naming in T1-site plan` |
| Working tree | **dirty**：`M docs/plans/2026-07-22-mapd-nav-companion.md`（可能未 commit 的小改）；若干 `?? docs/reviews/*-r1-*.err` 等 err 檔 |
| Vite `:5173` / Proxy `:7788` | **未在聽**（session 末尾 kill 了長駐 smoke shell） |
| Subagents | survey 三隻 **已完成**；UI 曾幽靈 Responding；勿再當 running |

### DONE（本 session）

1. **密碼欄跳掉** → commit `28b326f`（更早）；dirty/modal/autofill 修過  
2. **ClientMap `oooo@oooo`** → 改 Nav Shell；dead-reckon trail（`e3c4a58` 等）  
3. **map_d Companion plan** — `docs/plans/2026-07-22-mapd-nav-companion.md`  
   - hetero **ALL_CLEAR R4**（gpt/GLM/Qwen/MiniMax）  
   - `docs/reviews/2026-07-22-mapd-companion-plan-hetero-all-clear.md`  
   - Status: **APPROVED**，C0 可 impl  
4. **agy flash 全 FAIL** 根因：`agy -p --model …` 把 `--model` 當 prompt  
   - 診斷：`docs/reviews/2026-07-22-agy-flash-fail-diagnosis.md`  
   - 正確：`agy --model gemini-3.6-flash-high --print-timeout 5m0s -p "$PROMPT"`  
5. **T1-site + daemon 架構 plan** — `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`  
   - hetero R1→R2 fold → **ALL_CLEAR**  
   - `docs/reviews/2026-07-22-t1-site-plan-hetero-all-clear.md`  
6. **Owner 命名鎖定（不重議）**  
   - **site mode** = multi-WSS → telnet（站方 gateway）  
   - **player mode** = VPS/本機 daemon → 任意 telnet；**web 只顯示**  
   - commit `95beed9`

### IN-FLIGHT / 未做

- Companion **C0 實作**（尚未寫 code）  
- Site mode **S0–S1 實作**（尚未）  
- Player mode daemon + Session Protocol（中期，僅 plan/ADR 方向）  
- dev server 未重起  

## 已決事項（不重議）

- Client automap **不是** 第二張 map_d；副駕／記憶／旅程；禁止 OCR、禁止 RW 全城 Mudlet graph 當主路徑  
- Companion C0：snapshot + freeze + pins + BurstDetector v0 + IDB；無「官方幀」文案  
- **site mode** vs **player mode** 產品二分（見上）  
- Site 出口 IP：mud 常見 127.0.0.1；限流用 **effectiveClientAddr**；PROXY v1 **可選 experimental**  
- S1 site auth = shared token + per-IP；**不**假 per-player identity  
- G/P 舊稱 = site/player；站方 gateway **不**扛玩家 vault／亂腳本  
- 架構節奏：**W0 now（Node site gateway）→ D1 player daemon + thin web → Rust 僅達門檻**  
- agy 呼叫順序永遠 flags 在前、`-p "$PROMPT"` 在後  

## 下一步

1. **選開工線（二選一，owner 若沒指定預設 Companion C0）：**  
   - **A. Companion C0** — 依 `docs/plans/2026-07-22-mapd-nav-companion.md` §C0.1 起：`ScreenBuffer.snapshotCells()`  
   - **B. Site mode S0–S1** — 依 T1-site plan：`ASSMUD_SITE_MODE` + allowlist fail-fast + audit  
2. 開工前：`git status`；若 `mapd-nav-companion.md` dirty 先看 diff 決定 commit 或 discard  
3. 需要 smoke：`ASSMUD_PROXY_MODE=localhost-dev … npm run dev:proxy` + `apps/web` vite `:5173`（**一組**即可，勿 background 堆 subagent）  
4. Player mode / Rust：**只讀 plan §0/§4**，不要開重寫除非 owner 明確要  

## 驗證方式

| 線 | 驗證 |
|----|------|
| Companion C0 | plan C0.1–C0.10 acceptance；`npm test`；`bash scripts/pre-smoke-check.sh`；手動釘幀／freeze／pin |
| Site S1 | `SITE_MODE=1` 空 allowlist exit≠0；非白名單 hello 拒；audit 無 payload；`npm test` proxy |
| Hetero 文件 | ALL_CLEAR md 存在且 plan Status 含 APPROVED |

## Read-order

1. `/home/cookys/projects/assmud/docs/HANDOFF.md` — 本檔  
2. `/home/cookys/projects/assmud/docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md` — **site/player mode SSOT** + IP + 架構  
3. `/home/cookys/projects/assmud/docs/plans/2026-07-22-mapd-nav-companion.md` — Companion C0 契約（若做 map）  
4. `/home/cookys/projects/assmud/docs/reviews/2026-07-22-agy-flash-fail-diagnosis.md` — 勿再 agy 參數踩雷  
5. `/home/cookys/projects/assmud/docs/plans/2026-07-22-automap-nav-shell.md` — Nav Shell 已 SHIP 背景  
6. `/home/cookys/projects/assmud/packages/mapper/src/graph.ts` — trail dead-reckon 現況  

## 陷阱

- **agy**：`agy -p --model X "prompt"` 會把 prompt 變成字串 `--model` → 假 FAIL；用 `agy --model X --print-timeout 5m0s -p "$PROMPT"`  
- **長駐 background shell** 會讓 TUI 以為 Subagents/Tasks 還在 Responding；smoke 用一組 server，做完可 kill  
- **survey subagent 三隻** 早已 completed；UI 幽靈勿重派  
- map_d **偵測** 必須 settleQuietMs + buf-mut，否則半幅截圖  
- site mode **勿** 把玩家 vault 丟上站方 gateway  
- CDN 下 ban `effectiveClientAddr` 可能 ban edge；勿當唯一 ban  
- dirty `mapd-nav-companion.md` 接手時先查  
- 今日日期 user_info 曾寫 2026-07-22；檔名日期以 repo 為準  

## 接續指令（paste-ready）

```text
read /home/cookys/projects/assmud/docs/HANDOFF.md 接續
```

建議下一句指定線：`做 Companion C0` 或 `做 site mode S0-S1`。
