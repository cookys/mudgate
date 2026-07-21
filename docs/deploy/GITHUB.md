# GitHub checklist

- [ ] Default branch `develop` (or `main`) protected
- [ ] Require PR reviews for prod deploy branch
- [ ] CI workflow `.github/workflows/ci.yml` required status checks: test + test:e2e + web build
- [ ] Secret scanning: `npm run secret-scan` in CI (or gitleaks org setting)
- [ ] Do not commit `.env` with live tokens
- [ ] Release checklist: `deploy/RELEASE-CHECKLIST.md` (`digest pin verified`)
