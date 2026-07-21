# Hetero — CJK cell width + taiwanmud + IP survey

**Date**: 2026-07-21  
**Plan**: [`docs/plans/2026-07-21-cjk-cell-width-taiwanmud.md`](../plans/2026-07-21-cjk-cell-width-taiwanmud.md)  
**hetero** = multi-LLM families

## Matrix

| Round | Grok | Codex | MiniMax | GLM-5.2 |
|-------|------|-------|---------|---------|
| R0 plan | (session) | **BLOCK** | APPROVE_WITH_NITS | id miss |
| R1 fold | — | — | — | — |
| R2 plan | APPROVE | **APPROVE_WITH_NITS** | **APPROVE** | **APPROVE_WITH_NITS** |

**Ship claim**: ≥2 families APPROVE*，MUST_FIX 全空 → **plan APPROVED** for expand **W1–W4 + I1**.

## R0 Codex MUST_FIX（已 fold）

1. `isWide` 不可收 `auto`；先 `resolveWidthMode`  
2. RW MOTD acceptance 改精確 golden  
3. charset 切換 clear/rebuild buffer  
4. 禁 T1 前宣稱 23 站；unknown→western + override  
5. seeds ≠ allowlist；DNS 後拒 private  

## R2 residual nits（不擋 expand）

- Fixture path：reuse 既有 rw-banner 或 W3 新建  
- `resolveWidthMode` 固定放 `packages/profiles`  
- alias 表標 non-exhaustive  

## IP survey（共識）

- 共享 hosted proxy → 多開撞 IP：**真**  
- 無客端偽造 source IP  
- **自架／本機 proxy 一等公民**；hosted 便利層 + 限流  
- 站方白名單只放寬容量，不識別真人  
- 住宅 IP pool 不當預設  

## Next

`/ship cjk-cell-width` 或 `/ship 2026-07-21-cjk-cell-width-taiwanmud` → 實作 W1–W4+I1。  
T1 台灣列表 probe 可並行、不擋字寬 ship。  
