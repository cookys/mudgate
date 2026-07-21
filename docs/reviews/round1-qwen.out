Let me review the plan pack against the six axes.

```text
VERDICT: FIX-THEN-SHIP

## Findings
### Critical
- (none — no finding that guarantees a security incident or certain ship failure if unaddressed)

### Major
- **Auth mechanism unspecified (Phase 1a / threat model).** Plan §4 Phase 1a says "login/session" and the threat model says "short-lived tokens, HTTPS-only cookies," but no document pins the mechanism (session cookie + httpOnly? JWT in WS subprotocol? OAuth2 upstream?). This affects WebSocket handshake design, token refresh during 30+ min KR0 sessions, and the CSRF-via-WebSocket surface. Without a decision, Phase 1a implementers will guess.
- **RWlib-derived fixture licensing gray zone.** Phase 1b acceptance requires "synthetic city map frame golden from RWlib sequence templates." OPEN-SOURCE.md says "do not vendor full trees without license pass" and "short quotes + links." A golden fixture built by transcribing `city_d_main.c` control-flow into byte sequences is arguably a derivative work of RWlib source. The plan should state whether fixtures are (a) clean-room from observed wire behavior, or (b) explicitly short-excerpt fair-use, and record that determination before the fixture lands in `tests/fixtures/`.
- **Big5 vs Big5-HKSCS scope unresolved.** Probe notes "decode as Big5 / Big5-HKSCS succeeds" but Global Constraints say "Default session charset for RW: Big5." If RW emits HKSCS-extended codepoints (common in HK/Traditional-Chinese muds for rare characters), a strict Big5 codec will produce U+FFFD mid-glyph. The codec-big5 package spec should state which table is authoritative (recommend: Big5-HKSCS superset, test both).
- **MCCP2 negotiation response not specified for Phase 1a.** Server sends `WILL MCCP2` in the first packet. If the Phase 1a client neither accepts (`DO`) nor refuses (`DONT`), some servers stall or assume acceptance. Plan should state: Phase 1a client MUST send `DONT MCCP2` immediately; Phase 3 adds `DO` + inflate. Currently the plan says "Optional MCCP2" (Phase 3) without pinning the Phase 1a refusal behavior.
- **Dual-color verification gap between Phase 1b and Phase 3.** Phase 1b golden is synthetic (from RWlib templates); live dual-color capture is Phase 3. Research explicitly says "Full dual-color verification needs a captured in-game fixture." Risk: Phase 1b passes its synthetic golden while the real `ansi_part` mid-DBCS-SGR path is untested until Phase 3. Add a risk row or a "synthetic dual-color cell" sub-fixture to 1b so the byte-first pipeline is exercised before live capture.
- **Reconnection / session resume has no phase owner.** `packages/protocol` lists "reconnect" in architecture.md, and KR0 requires "30+ min session," but no phase acceptance criteria test WSS drop → reconnect → VT state recovery. A 30-min mobile session WILL drop. Assign explicit acceptance (e.g., Phase 1a: "WSS reconnect replays IAC negotiation; screen buffer preserved client-side").
- **WebSocket Origin / CSRF control missing from threat model.** The threat model lists auth, allowlist, SSRF, quotas — but not Origin-header validation on the WSS upgrade. A malicious page could open `wss://proxy.assmud.example` with a stolen cookie if SameSite isn't set or if the proxy doesn't check Origin. Add a row: "Cross-site WS hijack → validate Origin allowlist + SameSite=Strict on session cookie."

### Minor
- **File-structure table wording.** `apps/proxy/` description says "localhost default; allowlist/auth hooks" — reads as if localhost is the product default, contradicting ADR-002 ("remote authenticated proxy is product path"). Suggest: "WSS↔TCP bridge (config: remote-prod | localhost-dev); allowlist/auth hooks."
- **Tablet surface unmentioned.** Docs say "desktop + phone." A 10" tablet is neither; it likely gets desktop layout. One sentence in architecture.md "Surface honesty" table would close the gap.
- **No latency budget.** KR0 says "30+ min session" but no target round-trip (e.g., proxy overhead < 50 ms p95). MUD combat feel is latency-sensitive. Not a blocker, but a measurable KR would help Phase 4 mobile polish.
- **Global capacity / concurrency not addressed.** Threat model has per-user quotas but no mention of total connection cap or back-pressure when the proxy host is saturated. Fine for v1 with few users; worth a sentence in the deploy runbook (Phase 4).
- **NAWS ↔ renderer coupling unspecified.** City map is 25×9, area 31×9. If the browser canvas is 80×24 but the phone is 40×20, NAWS tells the server different sizes. The plan doesn't state whether the renderer forces a minimum col/row or lets the server clip. A one-line rule in architecture.md would prevent surprises.
- **`docs/projects/INDEX.md` referenced but not in pack.** Can't verify consistency of the index with the bootstrap README. Low risk; include in next pack.

## Must-fix before approve (ordered)
1. Pin the auth/session mechanism (one paragraph in ADR-002 or threat model): cookie vs token, WS handshake flow, refresh strategy for ≥30 min sessions, SameSite/Secure attributes.
2. Add Origin-validation + CSRF-via-WS row to the threat model's "Threats → controls" table.
3. State Phase 1a MCCP2 behavior explicitly: client sends `DONT MCCP2` (and `WONT` for any DO options it won't support yet).
4. Resolve Big5 vs Big5-HKSCS in Global Constraints and codec-big5 spec (recommend HKSCS superset).
5. Add a "synthetic dual-color cell" fixture requirement to Phase 1b acceptance (mid-DBCS SGR byte sequence, even if hand-built) so the byte-first pipeline is proven before Phase 3 live capture.
6. Assign reconnection acceptance to a phase (recommend Phase 1a: "WSS drop → auto-reconnect → re-negotiate IAC → screen buffer intact").
7. Clarify RWlib-fixture licensing determination in OPEN-SOURCE.md (clean-room vs excerpt; record rationale).

## Optional improvements
- Add a one-line latency SLO (proxy overhead p95) to KR0 or Phase 4 acceptance.
- Mention tablet explicitly in the surface-honesty table.
- Fix `apps/proxy/` description wording to match ADR-002 product-default language.
- Add NAWS ↔ minimum viewport rule to architecture.md (what happens when phone cols < map width).
- Consider a "global max connections" note in the Phase 4 deploy runbook scope.
- Include `docs/projects/INDEX.md` in future review packs for cross-check.

## What is already strong
- **Surface honesty is rare and well-executed.** KR6 + ADR-002 "phone UX honesty" + architecture "don't over-claim" language avoid the classic trap of promising mobile parity. The framing "desktop is the natural power-user home; phone is connect+play" is credible and board-aligned.
- **Byte-first pipeline is correctly elevated to a hard constraint.** The Global Constraints + research doc make "never `bytes.toString('utf8')`" and "strip-non-color CSI is a ship blocker" unfalsifiable rules — this is exactly how you prevent the #1 RW fidelity failure.
- **Threat model is concrete and fail-closed.** The "Minimum ship checklist (official)" with six testable items (unauth denied, private-IP denied, concurrency cap, metadata-only audit, TLS-only, kill-switch) gives Phase 1a clear red/green gates.
- **Phase ordering is sound.** 1a (connect + banner) before 1b (full VT buffer) before 2 (automation) respects the dependency chain; you can't test map_d without a working Big5 banner path.
- **WASM/WebGPU are correctly deferred with interfaces.** The `Renderer` / `CharsetCodec` interface sketches in architecture.md let backends swap without app rewrite, while ADR-001's "Forbidden" list prevents premature GPU-in-React mistakes.
- **Open-source hygiene is thorough.** OPEN-SOURCE.md's fixture rules, gitignored dump grounds, and pre-publish gate script are production-grade for a pre-1.0 repo.
- **Research docs are falsifiable.** The RW probe and ANSI/map-controls docs cite specific source files (`city_d_main.c`, `title_screen.c`, `ansi.h`), specific escape sequences, and specific fixture plans — a reviewer or implementer can verify each claim independently.
```
