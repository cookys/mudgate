## 目標

assmud：中文優先 web MUD 客端。**Companion C0** 與 **site mode S0–S2** 已 SHIP。下一棒：**player mode ADR / S3**（可選）。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | `git log -1`（含 site mode S0–S1） |
| Working tree | hetero `docs/reviews/*.err` **勿 commit** |
| Vite / Proxy | 可長駐 `localhost-dev`；site mode 需 `remote-prod`+`SITE_MODE=1` |
| Companion C0 | **SHIP** |
| Site mode S0–S2 | **SHIP** — S1 + `ASSMUD_PROXY_PROTOCOL` experimental |

### DONE

1. Nav Shell P1 — SHIP  
2. map_d Companion C0 — SHIP  
3. T1-site plan hetero ALL_CLEAR + naming site/player  
4. **Site mode S0–S1** — SITE_MODE、effectiveClientAddr、audit、docs  
5. **Site S2** — PROXY v1（`ASSMUD_PROXY_PROTOCOL=0\|1`，預設 0；連上後寫首行）  

### IN-FLIGHT / 未做

- **S3 / Player mode** daemon + Session Protocol ADR  
- Companion **C1+**  

## 已決事項（不重議）

- site vs player 產品二分  
- S1 auth = shared token + per effective-IP；不假 per-player  
- 限流 key = effectiveClientAddr；CDN edge 勿當唯一 ban  
- Companion 不是第二張 map_d  
- agy flags 在前  

## 下一步

1. **S3 / Player mode** ADR + Session Protocol spike（見 T1-site plan §5 Phase S3）  
2. Companion C1（僅 owner 要 journey/stitch 時）  
3. 或 idle  

## 驗證方式

| 線 | 驗證 |
|----|------|
| Site S1 unit | `npm test` 含 `apps/proxy/tests/site-mode.test.ts` |
| Site fail-fast | `SITE_MODE=1` 空 allowlist / +localhost-dev → exit≠0 |
| Companion C0 | pre-smoke PASS（既有） |

## Read-order

1. `docs/HANDOFF.md`  
2. `docs/deploy/SITE-OPERATOR.md`  
3. `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`  
4. `apps/proxy/src/{policy,clientAddr,audit,server}.ts`  

## 陷阱

- SITE_MODE ≠ PROXY_MODE 別名  
- 勿 commit `docs/reviews/*.err`  
- trusted hop 缺 header **fail-closed**（不是回退 peer）  

## 接續指令

```text
read /home/cookys/projects/assmud/docs/HANDOFF.md 接續
```
