---
name: ship
description: >
  mudgate /ship overlay — after hetero, expand ready plans, implement with
  grok-4.5 medium (overridable), loop review to green, then depth-0 qc-gate
  + develop merge + LAN servers.
---

# /ship (mudgate project overlay)

Follow **user-global** `~/.grok/skills/ship/SKILL.md` with these pins.

## Hetero engines (mudgate) — owner pin 2026-07-22

**hetero = 異質 = 多家不同 LLM**，不是單引擎多角色。

| Seat | Model | CLI / harness | Forbidden |
|------|-------|---------------|-----------|
| Codex | **gpt-5.6-sol** | `codex exec -m gpt-5.6-sol` | — |
| MiniMax | **MiniMax-M3**（minimax 3） | direct / harness that hits **M3**（見 knowledge） | **禁止**用 MiniMax-M2.7 頂替 |
| GLM | **GLM-5.2** | `qoderclicn -m GLM-5.2` | — |
| Qwen | **Qwen3.8-Max**（preview id 可） | `qoderclicn -m Qwen3.8-Max-Preview` | — |
| Gemini | **gemini-3.6-flash-high** | **`agy --model gemini-3.6-flash-high`**（`-p` 在 prompt 後） | **禁止** `@google/gemini-cli` / `gemini` binary |
| Claude | **opus-4.8** | `claude -p` + opus-4.8 model | weekly limit 時記 FAIL，不拿別 seat 冒充 |

Grok（本 session）可當 orchestrator；**claim hetero** 仍要上表 **≥2 families** 在 **latest round** APPROVE*（MUST_FIX=[]），見 ALL_CLEAR。

**Forbidden:** 列表沒有就「closest」換代（user catch：minimax 3 ≠ 2.7）。缺 auth / 模型 → 該 seat **FAIL/skip**，寫進 hetero.md，不靜默降級。

Ship / expand claims require **≥2 families** APPROVE* (no BLOCK) **on the latest round**, with **ALL_CLEAR**.

### ALL_CLEAR + fold loop (mudgate pin — do not skip)

```
hetero → MUST_FIX or BLOCK? → fold into plan/code → hetero again
       → adopted NITS? → fold → hetero again
直到 ALL_CLEAR
```

| ALL_CLEAR | |
|-----------|--|
| ≥2 families APPROVE* | required |
| MUST_FIX | **[]** every family, **latest** round only |
| NITS | **[]** or each remaining nit **deferred** in hetero.md |
| After any fold | **must re-run hetero** — fold alone ≠ APPROVED |

**Forbidden:** fold MUST_FIX/nits then mark plan `APPROVED` / expand / ship without another multi-family round (user catch 2026-07-21 selfhost-proxy-trust).

## Implementer default

| Key | Value |
|-----|--------|
| Model | **`grok-4.5`** |
| Tier | **medium** (override: `/ship model=…` or `/ship tier=high`) |
| Branch target | **`develop`** |

## Plans inventory (expand policy)

| Plan | Ship stance |
|------|-------------|
| `docs/plans/2026-07-21-web-zmud-rw.md` | done/SHIP — smoke only |
| `docs/plans/2026-07-21-ui-shell-ship.md` | SHIP — smoke only |
| `docs/plans/2026-07-21-ui-redesign.md` | shell SHIP; residual U2+ optional |
| `docs/plans/2026-07-21-i18n-locale.md` | **expand when /ship** if Board frozen (is) → I1–I3 |
| `docs/design/terminal-fonts.md` | **expand when /ship** after or with i18n → F1–F3 |

On full `/ship` (no `only-qc` / `no-expand`):

1. Hetero open plans (i18n + fonts + any draft).  
2. **Expand** i18n (and fonts if capacity) into `implementing` + feature branch.  
3. Impl **grok-4.5 medium** (or session model if dispatch cannot set).  
4. Loop review until StatusEvent + locales / font acceptance green.  
5. **depth-0** `npm test` + `npm run build -w @mudgate/web`.  
6. Merge develop + LAN servers.

Do **not** depth-0-qc-only and call i18n/fonts shipped.

## QC (depth-0 only, post-loop)

```bash
npm test
npm run build -w @mudgate/web
```

## Pre-smoke self-check (mandatory before “請你驗證”)

**User pin 2026-07-22:** 作完叫使用者驗證之前，agent **必須先自己檢查確認沒問題**。

Do **not** say “硬重新整理 / 請試” until this gate is green (or you report residual FAIL with evidence).

```bash
bash scripts/pre-smoke-check.sh
```

| Check | Why |
|-------|-----|
| `npm test` | logic regressions |
| `npm run build -w @mudgate/web` | tsc + bundle |
| web :5173 + proxy `/health` | LAN servers actually up |
| **curl Vite-served modules** | catch **stale HMR** (e.g. ConnectGate still referencing removed `ProfileEditor`) |
| key component HTTP 200 | missing files / wrong paths |

If Vite is stale: kill :5173, `rm -rf apps/web/node_modules/.vite`, restart `dev:web`, re-run script.

**Only after PASS** may you ask for optional human smoke (login feel, numpad, vault UX).

## LAN servers (after land)

```bash
MUDGATE_PROXY_MODE=localhost-dev \
MUDGATE_BIND_HOST=0.0.0.0 \
MUDGATE_ORIGIN_ALLOWLIST="http://127.0.0.1:5173,http://localhost:5173,http://192.168.101.20:5173" \
npm run dev:proxy

VITE_HOST=0.0.0.0 \
VITE_PROXY_WS="ws://192.168.101.20:17788/ws" \
npm run dev:web
```

- http://192.168.101.20:5173/  
- `ws://192.168.101.20:17788/ws`

## False-ship guards (Skeptic)

- No `i18n/` + StatusEvent → cannot SHIP i18n plan.  
- No `setTypography` / termFont storage → cannot SHIP fonts.  
- **No “請驗證” without `scripts/pre-smoke-check.sh` PASS** (or equivalent evidence).  
- Disk source green ≠ browser green — always probe **served** Vite transforms after UI refactors.
