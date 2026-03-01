## React migration parity checklist (student)

This document compares legacy `student.html` behavior to the React beta (`student_react.html` + `student-react/`).

### Legacy behaviors (student.html)

Auth/session handling and redirects:
- Supabase client initialized in-page and session checked at load.
- If no session, redirects to `/signin.html`.
- Auth state change listener redirects on sign-out.

File upload constraints:
- Early global drag/drop guard prevents browser navigation on file drop.
- Upload accepts `.docx` only (`accept=".docx"`).
- Drop zone supports drag/drop and click-to-browse; keyboard enter/space triggers browse.

“Mark my essay” request:
- POST `https://vysti-rules.onrender.com/mark` with `Authorization: Bearer <token>`.
- FormData includes `file`, `mode`, `include_summary_table`, `highlight_thesis_devices=false`,
  `student_mode=true`, `assignment_name` (if present).
- If detectedWork metadata exists, includes `author`, `title`, `text_is_minor_work`.
- Techniques header read from `X-Vysti-Techniques`.

UI states:
- Idle hides results card.
- Processing shows loading state on button, clears results.
- Success shows results + preview, enables download.
- Error shows message in `statusArea` and keeps results card visible.

Preview behavior:
- `docx-preview` renders into `#markedPreview`.
- Preview is contenteditable with live zoom.
- Fallback message when render fails.

Download behavior:
- Legacy uses `/export_docx` to download revised preview text.
- Download filename built from source file name (`*_revised.docx`).

Techniques / rubric / header display:
- Uses `X-Vysti-Techniques` header to populate techniques list.
- Metrics grid, stats panels, and charting for issues.

### React beta parity (student-react)

Auth/session handling:
- `useRequireAuth` checks session, redirects to `/signin.html` (with redirect param in App).
- Auth state change listener redirects on sign-out.

File upload:
- `.docx` only check (name + MIME).
- Drag/drop and browse supported.

Mark request:
- POST `/mark` with same headers + FormData fields.
- No detectedWork metadata (author/title) in React.
- Techniques header not parsed yet.

UI states:
- Status message + loading states present.
- Results card always rendered (not conditional).

Preview behavior:
- `docx-preview` renders and is editable.
- Zoom applied after render.

Download behavior:
- Uses `/mark_text` to export; not simple blob download.
- No assignmentName-based filename.

Techniques/rubric:
- Not implemented in React UI.

### TODO gaps to address (Phase 2)

- Add techniques header parsing and display (panel under Preview).
- Add marked blob download with assignment-based filename.
- Add "Clear / Start over" control to reset file + preview + techniques.
- Improve error messages with HTTP status and session-expired handling.
- Introduce ErrorBoundary so preview errors do not blank the UI.
- Extract preview rendering into hook (`useDocxPreview`) to avoid races.
- Modularize App into components + hooks + services for maintainability.
- Confirm build output + cache-busting for `student_react.html`.
