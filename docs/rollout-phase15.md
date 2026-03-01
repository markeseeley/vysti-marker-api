# Phase 15 Rollout Procedure

## Allowlist yourself first
- Keep `rollout.studentReact.enabled=false`.
- Add your email to `rollout.studentReact.allowEmails`.
- Confirm you redirect to React after login.

## Enable 5%
- Set `enabled=true`.
- Set `percentage=5`.
- Watch logs and feedback.

## Increase safely
- 5% → 25% → 50% → 100%.
- Increase only after confirming healthcheck + no regressions.

## Emergency rollback
- Set `killSwitch=true` (hard stop).
- Or set `percentage=0` or `enabled=false`.

## Helping a student
- Add `?classic=1` to the URL or click “Back to classic”.
- If stuck, clear `localStorage.uiMode`.

## Kill switch behavior
- Kill switch overrides all routes, including `?react=1`.
