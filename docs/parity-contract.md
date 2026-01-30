# Parity Contract: Student Marking

This document defines the shared request/response contract used by both the
classic `student.html` flow and the React student app.

## `/mark` (multipart form-data)

Fields (exact names and values):
- `file`
- `mode`
- `include_summary_table`: `"true"` or `"false"`
- `highlight_thesis_devices`: `"false"`
- `student_mode`: `"true"`
- `assignment_name`: optional string
- `author`, `title`, `text_is_minor_work`: only when `detectedWork.confidence === "high"`

## `/mark_text` (JSON)

Shape:
- `file_name`: string
- `text`: string
- `mode`: string
- `highlight_thesis_devices`: `false`
- `student_mode`: `true`
- `titles`: optional array of `{ author, title, is_minor }`

## Response handling

- `X-Vysti-Techniques` header: parse as JSON when possible; otherwise keep raw string
- Treat `401` and `403` as `SESSION_EXPIRED`
