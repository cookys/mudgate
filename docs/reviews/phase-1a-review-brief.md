# Code review brief — Phase 1a (mudgate)

You are reviewing a **git unified diff** implementing Phase 1a of the approved plan for mudgate (web multi-MUD client).

## Implementer
grok-4.5 medium on branch feat/phase-1a-connect

## Phase 1a acceptance (check against diff)

- Monorepo packages: protocol, codec-big5, vt, terminal, apps/proxy, apps/web
- Proxy: auth token, Origin check, allowlist, SSRF private IP deny, DONT MCCP2
- Big5-HKSCS banner path; XSS sanitize helpers; SGR terminal buffer
- React+Vite+Tailwind TerminalHost (no per-cell React nodes)
- Unit tests present

## Output format

```
VERDICT: SHIP-AS-IS | FIX-THEN-SHIP | REVISE

## Findings
### Critical
### Major
### Minor

## Must-fix before merge
1. ...
```

Cite paths. Focus security (proxy open-relay/SSRF/Origin/auth) and RW Big5 correctness.
