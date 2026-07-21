## 目標

assmud：中文優先 web MUD 客端。**Companion C0 已實作**；下一棒可做 manual map_d smoke → SHIP C0，或開 **site mode S0–S1**。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | develop tip: `feat: map_d nav companion C0`（`git log -1`） |
| Working tree | 接手時 `git status`；hetero `*.err` **勿 commit** |
| Vite `:5173` / Proxy `:7788` | 可能已起（session 若 smoke）；否則一組 `dev:proxy`+`dev:web` |
| Companion C0 | **code done** · unit/e2e/build green · **manual map_d smoke 未完成** |

### DONE

1. Nav Shell P1（附近/足跡/dead-reckon）— 更早 SHIP  
2. map_d Companion **plan** hetero ALL_CLEAR R4 — APPROVED  
3. T1-site plan hetero ALL_CLEAR + site/player 命名鎖定  
4. **Companion C0 實作**  
   - `ScreenBuffer.snapshotCells()` + cup-abs/buf-mut hooks  
   - `@assmud/nav-memory`：BurstDetector v0、Memory+IDB、MAX 30/protected LRU、evict toast  
   - `MapCompanion`：城圖 tab canvas、freeze/live、manual pin、pin CRUD、clear profile  
   - i18n 徽章誠實（自動擷取·推測 / 終端快照；禁「官方」）  
   - fixtures P1/P2/P3/N1/N2/N3  

### IN-FLIGHT / 未做

- Companion **manual map_d smoke** → mark **SHIP C0**  
- Site mode **S0–S1** 實作  
- Player mode daemon + Session Protocol（中期）  
- C1 journey / stitch / fingerprint  

## 已決事項（不重議）

- Client automap **不是** 第二張 map_d；副駕／記憶／旅程；禁止 OCR、禁止 RW 全城 Mudlet graph 當主路徑  
- Companion C0：snapshot + freeze + pins + BurstDetector v0 + IDB；無「官方幀」文案  
- **site mode** = multi-WSS → telnet（站方 gateway）；**player mode** = VPS/本機 daemon → 任意 telnet；web 只顯示  
- Site 出口 IP：mud 常見 127.0.0.1；限流用 **effectiveClientAddr**；PROXY v1 可選 experimental  
- S1 site auth = shared token + per-IP；**不**假 per-player identity  
- 架構節奏：**W0 now（Node site gateway）→ D1 player daemon + thin web → Rust 僅達門檻**  
- agy：`agy --model X --print-timeout 5m0s -p "$PROMPT"`（flags 在前）  

## 下一步

1. **優先 A — SHIP C0 smoke（若未做）：**  
   ```bash
   ASSMUD_PROXY_MODE=localhost-dev npm run dev:proxy
   npm run dev:web
   ```  
   連 RW → 開 map_d → 城圖 tab 見 auto 或「釘住終端」；freeze；pin；清除本檔；關 auto 不自動更新  
2. **優先 B — Site mode S0–S1：** `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`  
   - `ASSMUD_SITE_MODE` + allowlist fail-fast + audit  
3. Player / Rust：**只讀 plan**，不要開重寫除非 owner 明確要  
4. 勿 background 堆 subagent；smoke 一組 server 做完可 kill  

## 驗證方式

| 線 | 驗證 |
|----|------|
| Companion C0 unit | `npm test`（含 `packages/nav-memory`、terminal snapshot、burst P1–N3） |
| Companion C0 build | `npm run build -w @assmud/web` |
| Companion C0 ship | pre-smoke + manual map_d（上表 smoke 步驟） |
| Site S1 | `SITE_MODE=1` 空 allowlist exit≠0；非白名單 hello 拒；audit 無 payload |

## Read-order

1. `/home/cookys/projects/assmud/docs/HANDOFF.md` — 本檔  
2. `/home/cookys/projects/assmud/docs/plans/2026-07-22-mapd-nav-companion.md` — C0 契約 / SHIP gate  
3. `/home/cookys/projects/assmud/docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md` — site/player SSOT  
4. `/home/cookys/projects/assmud/packages/nav-memory/src/` — BurstDetector + store  
5. `/home/cookys/projects/assmud/apps/web/src/components/MapCompanion.tsx` — 城圖 UI  

## 陷阱

- **agy** 參數順序：flags 在前、`-p` 在後  
- 長駐 background shell 會讓 TUI 以為 Subagents 還 Responding  
- map_d 偵測必須 settleQuietMs + buf-mut，否則半幅  
- site mode 勿把玩家 vault 丟上站方 gateway  
- CDN 下 ban `effectiveClientAddr` 可能 ban edge  
- hetero `docs/reviews/*.err` 是 harness 雜訊，**不要 commit**  
- IDB 在 Node 測試走 MemoryNavStore；browser 走 `assmud-nav`  

## 接續指令（paste-ready）

```text
read /home/cookys/projects/assmud/docs/HANDOFF.md 接續
```

建議下一句：`做 map_d smoke` 或 `做 site mode S0-S1`。
