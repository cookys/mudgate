## 目標

assmud：中文優先 web MUD 客端。**Companion C0** 與 **site mode S0–S1** 已 SHIP。下一棒可選 S2 PROXY experimental 或 player mode ADR。

## 現況

| 項 | 值 |
|----|-----|
| Branch | `develop` |
| HEAD | `git log -1`（含 site mode S0–S1） |
| Working tree | hetero `docs/reviews/*.err` **勿 commit** |
| Vite / Proxy | 可長駐 `localhost-dev`；site mode 需 `remote-prod`+`SITE_MODE=1` |
| Companion C0 | **SHIP** |
| Site mode S0–S1 | **SHIP** — SITE_MODE fail-fast、effectiveClientAddr、audit、SITE-OPERATOR |

### DONE

1. Nav Shell P1 — SHIP  
2. map_d Companion C0 — SHIP  
3. T1-site plan hetero ALL_CLEAR + naming site/player  
4. **Site mode S0–S1**  
   - `ASSMUD_SITE_MODE=1` 僅配 `remote-prod`；空 allowlist exit≠0  
   - hello dest ∈ allowlist；site 允許 allowlisted loopback mud  
   - `effectiveClientAddr`：trusted hop + CF/X-Real-IP（**無 XFF**）；缺 header 403  
   - audit JSON 行（token HMAC 截斷、無 payload）  
   - docs: `SITE-OPERATOR.md`、threat model、deploy README、i18n site 文案  

### IN-FLIGHT / 未做

- Site **S2** PROXY protocol v1 experimental（預設關）  
- **Player mode** daemon + Session Protocol ADR  
- Companion **C1+**  

## 已決事項（不重議）

- site vs player 產品二分  
- S1 auth = shared token + per effective-IP；不假 per-player  
- 限流 key = effectiveClientAddr；CDN edge 勿當唯一 ban  
- Companion 不是第二張 map_d  
- agy flags 在前  

## 下一步

1. **S2**（可選）：`ASSMUD_PROXY_PROTOCOL=1` 寫 PROXY v1 首行  
2. **Player mode** ADR / Session Protocol spike  
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
