# Plan hetero review brief — map_d Nav Companion

You are a **plan reviewer** (not implementer). Review **only** this plan text for ship-readiness of the **plan document** (not code).

## Plan under review

Path: `/home/cookys/projects/assmud/docs/plans/2026-07-22-mapd-nav-companion.md`

Related (context only, do not re-litigate shipped Nav Shell unless plan contradicts it):

- `/home/cookys/projects/assmud/docs/plans/2026-07-22-automap-nav-shell.md` (SHIP P1)
- `/home/cookys/projects/assmud/docs/reviews/2026-07-22-mapd-automap-hetero-brainstorm.md`

## Product facts (do not invent opposite)

- assmud: browser MUD client; VT `ScreenBuffer` already renders RW **map_d** correctly.
- Stance locked: client = **nav co-pilot**, not second world map; no Mudlet full-city graph for RW cities.
- Phase C0 = Companion (snapshot, freeze, pins); C1 = journey + stitch proto; C2 = expedition gates.
- ANTI: OCR, default auto-speedwalk, GMCP-as-backbone, regressing map_d.

## What to check

1. **False ship risk** — any C0 deliverable underspecified so implementers would guess wrong?
2. **map_d detection** — is P0 “manual pin + CUP burst” honest enough, or BLOCK until SAVEC state machine is specified?
3. **Storage** — IndexedDB choice, quota/LRU, multi-tab isolation complete enough?
4. **Boundary** — terminal vs nav-memory vs web dependencies correct?
5. **C0 acceptance** — testable? missing fixtures?
6. **Scope creep** — stitch/journey in C0 by accident?
7. **Security/privacy** — frames/pins are not secrets but still PII-ish location memory?

## Output format (required — plain text, no tools required if plan text is inlined)

```text
ENGINE: <model>
VERDICT: APPROVE | APPROVE_WITH_NITS | BLOCK

MUST_FIX:
- ...

NITS:
- ...

C0_SHIP_OK: yes|no — <one line>
FALSE_SHIP_RISKS:
- ...

ONE_LINE_SUMMARY: ...
```

Be strict. Empty MUST_FIX only if truly ready to implement C0 from plan alone.
