## 目標

assmud：中文優先 web MUD 客端。**Companion C0 已 SHIP**；下一棒預設 **site mode S0–S1**（T1-site plan）。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | develop tip（`git log -1`；含 companion C0 + SHIP docs） |
| Working tree | hetero `docs/reviews/*.err` **勿 commit** |
| Vite `:5173` / Proxy `:7788` | ship 後可長駐；`localhost-dev` + Vite |
| Companion C0 | **SHIP** — unit / build / pre-smoke PASS |

### DONE

1. Nav Shell P1（附近/足跡/dead-reckon）— SHIP  
2. map_d Companion plan hetero ALL_CLEAR R4 — APPROVED  
3. T1-site plan hetero ALL_CLEAR + site/player 命名鎖定  
4. **Companion C0 SHIP**  
   - `ScreenBuffer.snapshotCells()` + cup-abs/buf-mut  
   - `@assmud/nav-memory` BurstDetector v0 + Memory/IDB  
   - `MapCompanion` 城圖 tab（freeze / pin / clear / 誠實徽章）  
   - fixtures P1/P2/P3/N1/N2/N3；`scripts/pre-smoke-check.sh` PASS  

### IN-FLIGHT / 未做

- Site mode **S0–S1** 實作（`docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`）  
- Player mode daemon + Session Protocol（中期）  
- Companion **C1+**（journey / stitch / fingerprint / expedition）  

## 已決事項（不重議）

- Client automap **不是** 第二張 map_d；副駕／記憶／旅程；禁止 OCR、禁止 RW 全城 Mudlet graph 當主路徑  
- Companion C0：snapshot + freeze + pins + BurstDetector v0 + IDB；無「官方幀」文案  
- **site mode** = multi-WSS → telnet（站方 gateway）；**player mode** = VPS/本機 daemon → 任意 telnet；web 只顯示  
- Site 出口 IP：mud 常見 127.0.0.1；限流用 **effectiveClientAddr**；PROXY v1 可選 experimental  
- S1 site auth = shared token + per-IP；**不**假 per-player identity  
- 架構節奏：**W0 now（Node site gateway）→ D1 player daemon + thin web → Rust 僅達門檻**  
- agy：`agy --model X --print-timeout 5m0s -p "$PROMPT"`（flags 在前）  
- Ship gate：pre-smoke PASS 後 user smoke **optional**（非 blocking）  

## 下一步

1. **Site mode S0–S1** — `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`  
   - `ASSMUD_SITE_MODE` + allowlist fail-fast + audit  
2. Player / Rust：**只讀 plan**，不要開重寫除非 owner 明確要  
3. C1 companion：僅在 owner 要 journey/stitch 時再開  

## 驗證方式

| 線 | 驗證 |
|----|------|
| Companion C0 (SHIP) | `npm test`；`npm run build -w @assmud/web`；`bash scripts/pre-smoke-check.sh` RESULT=PASS |
| Site S1 | `SITE_MODE=1` 空 allowlist exit≠0；非白名單 hello 拒；audit 無 payload |

## Read-order

1. `/home/cookys/projects/assmud/docs/HANDOFF.md` — 本檔  
2. `/home/cookys/projects/assmud/docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md` — **下一棒 SSOT**  
3. `/home/cookys/projects/assmud/docs/plans/2026-07-22-mapd-nav-companion.md` — C0 SHIP 契約（只讀）  
4. `/home/cookys/projects/assmud/packages/nav-memory/src/` — companion store（已 SHIP）  

## 陷阱

- **agy** 參數順序：flags 在前、`-p` 在後  
- 長駐 background shell 會讓 TUI 以為 Subagents 還 Responding  
- map_d 偵測必須 settleQuietMs + buf-mut，否則半幅  
- site mode 勿把玩家 vault 丟上站方 gateway  
- CDN 下 ban `effectiveClientAddr` 可能 ban edge  
- hetero `docs/reviews/*.err` 是 harness 雜訊，**不要 commit**  

## 接續指令（paste-ready）

```text
read /home/cookys/projects/assmud/docs/HANDOFF.md 接續
```

建議下一句：`做 site mode S0-S1`。
