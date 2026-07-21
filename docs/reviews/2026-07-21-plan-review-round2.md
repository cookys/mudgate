# Hetero plan review — Round 2 verify (2026-07-21)

Checked the R7 fold of Round-1 must-fix list.

| Engine | Verdict | Notes |
|--------|---------|--------|
| Qwen3.8-Max-Preview | **SHIP-AS-IS** | 12/12 FIXED |
| GLM-5.2 | **SHIP-AS-IS** | 12/12 FIXED |
| MiniMax-M3 | **FIX-THEN-SHIP** | 11 FIXED; #9 XSS PARTIAL (wanted explicit 1a gate because SGR already renders) |

**Depth-0 resolution of MiniMax #9:** bind minimal XSS sanitizer + corpus to **Phase 1a acceptance** (SGR path); expand in 1b. Applied in plan R7 follow-up commit.

**Aggregate:** **SHIP-AS-IS** after XSS 1a pin — Board may mark plan `status: approved`.
