# RW login / captcha flow — research outline

> Spike R1 — **user-gated**. No credentials. No live password captures.

## Allowed

- Anonymized banner fixtures already in `tests/fixtures/streams/rw-banner-4000.*`
- Public docs on captcha UX if published by RW

## Forbidden

- Commit passwords, session cookies, solved captcha answers
- Full post-login dumps

## Next when Board approves

1. Redacted capture of captcha prompt **bytes** (no answers)
2. Document manual solve path in web UI
3. No auto-solve in assmud core
