## React Student deploy (Render Static)

Render Static does not run Vite build on deploy; it serves repo contents.
Therefore we must commit `assets/student-react`.

## How deploy works
- Local changes do nothing until you `git commit` + `git push`.
- Render auto-deploys from GitHub (or via manual deploy in Render).

## One-time setup (macOS)
Check versions:

node -v
npm -v

Install Node (Homebrew):

brew install node

## Check your machine (no build)
./deploy_student_react.sh --check

This is the fastest way to confirm Node/npm setup before deploying.

## Deploy steps
./deploy_student_react.sh

Notes on git checks:
- By default, the script warns but proceeds on dirty trees or non-main branches.
- Use `./deploy_student_react.sh --strict-git` to enforce clean tree + main.
- Use `./deploy_student_react.sh --no-git-checks` to bypass git checks.

git status
git add -A
git commit -m "Build student React Step 1 (dist)"
git push

## Verify
- Wait for Render deploy to finish.
- Open `/student_react.html`.
- Hard refresh (Cmd+Shift+R) if needed.

## Where is .gitignore?
- Dotfiles are hidden by default.
- Show in Terminal: `ls -la`
- Show in Finder: Cmd+Shift+.

Step 1 complete: React student page now includes auth guard, dropzone upload,
mark API call, and docx-preview rendering with editable preview.
