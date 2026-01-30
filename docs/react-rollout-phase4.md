## React Rollout Phase 4

### Overview
This phase introduces a controlled, reversible rollout from `student.html` to `student_react.html`.
Default is always classic unless explicitly enabled in `student-react-config.json`.

### Configuration
Edit `student-react-config.json`:

- `rollout.studentReact.enabled`: master rollout switch (default `false`)
- `rollout.studentReact.killSwitch`: emergency stop (forces classic)
- `rollout.studentReact.percentage`: 0..100 percentage bucket
- `rollout.studentReact.allowEmails` / `allowUserIds`: allowlist overrides
- `rollout.studentReact.denyEmails`: denylist override
- `rollout.studentReact.minBuildHealthcheck`: verify React build exists

### Rollout Procedure
1) Allowlist-only (safe start)
   - `enabled: false`
   - `percentage: 0`
   - Add emails/user IDs to `allowEmails` / `allowUserIds`

2) Percentage rollout
   - `enabled: true`
   - `percentage: 5` (then 25 -> 50 -> 100)

3) Full migration
   - `enabled: true`
   - `percentage: 100`

### Emergency Rollback
Any of these immediately stop redirects to React:
- `rollout.studentReact.killSwitch: true` (strongest)
- `rollout.studentReact.enabled: false`
- `rollout.studentReact.percentage: 0`

Kill switch always wins, including over `?react=1` or localStorage overrides.

### Overrides
- `?react=1`: attempt React (still respects kill switch and healthcheck)
- `?classic=1`: force classic (no redirect)
- `localStorage.uiMode = "react"`: attempt React (still respects kill switch)
- `localStorage.uiMode = "classic"`: force classic

Hidden UI mode shortcut in classic:
- Press `Alt+Shift+U` to set `uiMode` (`react`, `classic`, or `clear`)

### Healthcheck
If `minBuildHealthcheck` is true, the router checks:
- `/assets/student-react/main.js`
If missing or non-200, the user stays in classic.

### Troubleshooting
- If React assets are missing, keep users on classic until a rebuild is deployed.
- If config fetch fails, no redirect occurs (classic remains).
- Console logs show decisions:
  - `[rollout] decision=react reason=allowlist user=... bucket=... percentage=...`
  - `[rollout] decision=classic reason=killswitch|denied|bucket|no-session|healthcheck-failed`

## Phase 5 (Student React)

### What changed
- Student React reads `/student-react-config.json` for API + Supabase config.
- Auth redirects to `/signin.html?redirect=/student_react.html` when logged out.
- React adds Beta banner, Techniques panel, download button, and diagnostics panel.

### Build steps
1) `./deploy_student_react.sh`
2) Or run: `APP_BUILD_ID=YYYYMMDD-HHMM node student-react/scripts/build-student-react.mjs`

The build script stamps `student_react.html` with the build ID and updates asset
query strings, while ensuring `assets/student-react/main.js` exists.
