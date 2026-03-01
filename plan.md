# Sign-in Page + Google OAuth + Course Enrollment Plan

## 1. Supabase SQL (you run in SQL Editor)

Create two tables:

**`course_codes`** — Teacher creates these to give students access
- `id` (uuid PK)
- `teacher_id` (uuid, references auth.users)
- `code` (text, unique) — e.g. "VYSTI-ENG101-2026"
- `name` (text) — "English 101 — Spring 2026"
- `max_students` (int, default 50)
- `expires_at` (timestamptz) — when the code stops working
- `created_at` (timestamptz)

**`enrollments`** — Created when a student redeems a code
- `id` (uuid PK)
- `user_id` (uuid, references auth.users)
- `course_code_id` (uuid, references course_codes)
- `enrolled_at` (timestamptz)
- Unique constraint on (user_id, course_code_id) — can't enroll twice

Row Level Security on both tables.

## 2. Supabase Dashboard — Enable Google OAuth

Manual step (cannot be automated):
1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Enable it
3. Set OAuth redirect URL, Google Client ID, and Client Secret
4. (I'll provide instructions with the SQL)

## 3. Update signin.html

Changes to the sign-in page:

- **Google Sign-in button** at top of form — calls `supa.auth.signInWithOAuth({ provider: 'google' })`
- **Divider** — "or sign in with email" separator
- **Existing email/password form** stays
- **"Forgot password?" link** below password field — calls `supa.auth.resetPasswordForEmail()`
- **Course code step** — After first-time sign-in (Google or email), if user has no enrollment, show a "Enter your course code" prompt. This uses Supabase's `/rest/v1/enrollments` to check and insert.

The flow:
```
Sign in (Google or email/password)
  → Check enrollments table for this user
  → If enrolled → redirect to app
  → If not enrolled → show course code input
    → Validate code against course_codes table
    → Create enrollment row
    → Redirect to app
```

## 4. Update auth.css

Add styles for:
- Google sign-in button (white bg, Google colors, Google "G" icon)
- "or" divider line
- Forgot password link
- Course code step (input + submit, shown/hidden)

## Files Modified
- `signin.html` — Google button, forgot password, course code flow
- `assets/auth.css` — New styles for above elements

## File Created
- None (SQL provided as output for user to run in Supabase)

## Not in Scope
- Teacher dashboard for creating course codes (future work — for now codes are created via SQL or Supabase table editor)
- Enrollment checks in the React app or API (future — just the infrastructure + signin flow for now)
- Sign-up page (Google handles account creation; email users can be added via Supabase dashboard for now)