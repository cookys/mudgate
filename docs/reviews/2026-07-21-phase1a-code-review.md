# Phase 1a code review (multi-family)

**Branch**: `feat/phase-1a-connect` @ implementer grok-4.5 medium  
**Diff**: `docs/reviews/phase-1a-diff.patch` (pre-fix snapshot; see follow-up commit for SSRF pin)

| Engine | Status | Verdict |
|--------|--------|---------|
| MiniMax-M3 | reviewed | **FIX-THEN-SHIP** |
| GLM-5.2 | no_verdict | transport wrapper fail (not treated as pass) |
| Qwen3.8-Max-Preview | incomplete | tool-call noise; not treated as pass |

## MiniMax Critical (addressed)

1. **DNS rebinding TOCTOU** — `assertDestinationAllowed` resolved IP but `net.connect` used hostname again.  
   **Fix**: `server.ts` connects to `dest.address` (pinned).
2. **Origin prefix bypass** — `startsWith("http://127.0.0.1")` allowed `http://127.0.0.1.evil.com`.  
   **Fix**: parse URL; hostname must be exactly `127.0.0.1` or `localhost`.
3. **IPv6 / CGNAT gaps** — expanded `isPrivateOrBlockedIp`.

## Major (deferred / noted)

- Token in query string may hit access logs — prefer cookie/header in Phase 4 harden; document for now.
- Client→mud rate limits / IAC injection from browser — Phase 1a medium defer; track in BACKLOG.
- Auto reconnect UI — partial (manual re-connect works).

## Depth-0 aggregate after fix

**FIX-THEN-SHIP → fixed Critical → eligible for Board merge review** once tests green (16/16).
