# Plan — Terminal fonts F2+ (trial UX)

> **Status**: **fold R2 nits** · multi-LLM APPROVE_WITH_NITS  
> **Owner**: cookys  
> **Seq**: **3** on roadmap  
> **Spec**: `docs/design/terminal-fonts.md` §0–§1.1  
> **Branch**: `feat/terminal-fonts-f2`  

## Goal

在 baseline（catalog + TC chain + drawer preset）上完成 **試掘 UX**：全列、A/B、alignScore、系統字探測、自訂 primary、on-demand webfont 策略。

## Already done (baseline)

- `termFonts/catalog.ts` STATIC_CATALOG, TC/SC chain, resolveFontStack  
- Drawer preset + useDefaultTcChain  
- `Canvas2DRenderer.setTypography` / measureAlignScore  

## Phases

| ID | Work | Size | Acceptance |
|----|------|------|------------|
| F2a | Trial panel UI（modal/sheet）+ fixture sample | L | 開試掘不重連 MUD |
| F2b | A/B pin + alignScore display per face | S | 分數 ≈2.0 標綠 |
| F2c | System detect via **canvas glyph probe** (not fonts.check alone) | S | 缺字走 TC chain；對齊不崩 |
| F2d | Custom primary input + extras stack editor | S | 自填 family 進 stack |
| F3 | Optional self-host Sarasa Term TC subset doc/path | S | 無字時提示安裝/載入 |
| F4 | Size/width/line sliders wired to setTypography | S | 持久化 localStorage |

## Non-goals

- Bundle 全家族 CJK fonts in git  
- Force overwrite user preset on locale switch  

## Risks

| Risk | Mitigation |
|------|------------|
| CDN 大 | on-demand only |
| measure 不準 | 對照 fixture 人工 checklist |

## Review log

- R0 authored CEO  
