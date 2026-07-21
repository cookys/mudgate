# Phase 0 — Onboard and tracking

## Goal

Calibrate autopilot to this repo and stand up plan/project tracking so later L-size work has a durable home.

## Design

- Mechanical onboard via `project-detect.js` + `scaffold-config.js`
- Judgment enrichment for web zMUD + Revival World domain
- Manual bootstrap of `docs/plans`, `docs/projects`, INDEX, BACKLOG (no app code yet)

## Tasks

- [x] `git init -b main` with noreply identity
- [x] Detect + scaffold `.claude/*-config.md`
- [x] Enrich skill-routing, doc-drift, quality-gate security surfaces, dev-flow target MUD
- [x] Create docs tree + INDEX + seed plan + project README
- [x] Root README describing product intent

## Verification

- `ls .claude/` shows configs; `*-config.md` not gitignored
- INDEX lists this project under In Progress
- Plan open questions visible for Board
