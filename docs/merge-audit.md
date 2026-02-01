# React Beta merge audit

- Only in original (A): **2401**
- Only in clean (B): **37**
- In both but different: **19**

## Parity complete (React vs Classic)
- Upload + clear file, mark, recheck, download marked/revised
- Preview editing + zoom
- Preview tools: stats header, metrics grid, power verbs, hint dock, pill hints
- Most Common Issues chart (bar chart + tooltip + click-to-revise)
- MLA header modal (export revised)
- Dismiss issue modal + persistence

## Still missing
- Revision practice parity: issue grouping, approved rewrites/apply-to-preview, notes download

## Known behavior differences
- Most Common Issues chart uses a single color palette (Classic uses per-bucket colors)

## Access overrides
- Force Classic (`?classic=1`) is always allowed.
- Force React (`?react=1`) only works for allowlisted users or when `?rolloutDebug=1` is present.

## How to QA React Beta
1. Open `student_react.html?preflight=1` and verify audit + bundle status is green.
2. Upload a valid `.docx` and confirm mark + preview render.
3. Edit preview text → recheck → ensure new mark renders.
4. Download marked + revised files (with/without MLA header).
5. Enable hardening flags → verify cancel, toasts, validation, and timeouts.
6. In Diagnostics → “Copy debug info” and confirm secrets are redacted.
