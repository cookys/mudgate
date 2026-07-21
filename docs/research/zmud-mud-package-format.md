# zMUD `.mud` / package format — feasibility notes

> Research spike R3 — no full compatibility promise.

## Observed surface

- Character / settings databases historically Access/Jet then SQLite (later zMUD).
- Exportable “settings” text with `#TRIGGER` / `#ALIAS` style commands.
- Binary `.mud` packages not a public open standard; reverse-engineering cost high.

## assmud subset recommendation

| Import | Priority | Notes |
|--------|----------|-------|
| Plain-text `#TRIGGER` / `#ALIAS` lines | P2 | Map into script-engine |
| Character host/port/name | P1 | → profile-library |
| Full binary .mud | P3 / wont | Prefer user re-export as text |

## Constraint

Do **not** market “full zMUD package import” until a maintained parser + golden fixtures exist.
