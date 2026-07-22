# Mobile viewport surfaces

## Goal

Make phone-portrait shell controls compact and guarantee that every full-screen entry/modal surface remains operable inside the visual viewport, with vertical scrolling whenever content is taller than the available screen.

## Scope

1. Extract the session navigator so desktop keeps it in the header while phone portrait renders the same state as a content tab strip.
2. Present phone-portrait locale selection as one button opening a bounded dialog.
3. Present connection status as an accessible color indicator on phone portrait.
4. Introduce one visual-viewport positioning primitive for the play shell, ConnectGate, and fixed dialogs.
5. Give modal panels a shared `max-height: 100%` plus vertical-overflow contract.
6. Add deterministic component/contract tests, then run the full web and repository quality gates.

## Explicit exclusions

- Terminal grid/canvas geometry and NAWS behavior.
- MapCompanion's small absolute popups that are already bounded by their containing panel.
- A desktop visual redesign.

## Verification

```bash
npm test -- --run apps/web/tests/shellControls.test.ts
npm test
npm run typecheck
npm run build -w @mudgate/web
```

LAN smoke test at 320–767px portrait: reach the Connect CTA by vertical scroll, open/select/close the locale modal, observe a compact status indicator, switch/add/manage/close content session tabs, and repeat after keyboard open/close.
