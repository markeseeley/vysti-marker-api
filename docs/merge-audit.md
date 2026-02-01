# React Beta merge audit

- Only in original (A): **2401**
- Only in clean (B): **37**
- In both but different: **19**

## Parity complete (React vs Classic)
- Upload + clear file, mark, recheck, download marked/revised
- Preview editing + zoom
- Preview tools: stats header, metrics grid, power verbs, hint dock, pill hints
- Most Common Issues chart (bar chart + tooltip + click-to-revise)
- Revision practice visible + Most Common Issues chart works in React
- MLA header modal (export revised)
- Dismiss issue modal + persistence
- Cache-busting/build-id stamping fixed for `student_react.html`
- Layout/styling parity pass for results, MCI, revision, preview cards

## Still missing
- (None in this slice)

## Known behavior differences
- Most Common Issues chart uses a single color palette (Classic uses per-bucket colors)

## Access overrides
- Force Classic (`?classic=1`) is always allowed.
- Force React (`?react=1`) only works for allowlisted users or when `?rolloutDebug=1` is present.

## How to QA React Beta
1. Open `student_react.html?preflight=1` and verify audit + bundle status is green.
2. Confirm `app-build-id` changes after build/deploy and cache-busting query params update.
3. Upload a valid `.docx` and confirm mark + preview render.
4. Edit preview text → recheck → ensure new mark renders.
5. Download marked + revised files (with/without MLA header).
6. Verify results/MCI/revision/preview cards match Classic spacing/structure.
7. Ensure hardening flags are on → cancel, toasts, validation, timeouts.
8. In Diagnostics → “Copy debug info” and confirm secrets are redacted.
