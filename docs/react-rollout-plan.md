# React rollout plan (student)

## Entry points
- Classic student: `/student.html`
- React beta: `/student_beta.html` (opt-in)
- Direct React: `/student_react.html` (opt-in)

## Safety switches
- Force classic: add `?classic=1` to `/student_react.html`
- React beta banner links back to `/student.html`

## Known gaps / TODO
- Techniques panel data only appears after a successful mark call.
- Some legacy features (examples list, most common issues) are still pending.

## Rollback steps
1. Remove or ignore `/student_beta.html`.
2. Stop linking to `/student_react.html`.
3. Keep `/student.html` as the default entrypoint.

## Configuration
- Runtime config lives in `/student-react-config.json`.
- Required keys: `apiBaseUrl`, `supabaseUrl`, `supabaseAnonKey`.
- If config is missing or invalid, React shows a configuration error screen.
