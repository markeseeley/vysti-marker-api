# Phase 18 Parity Checklist — student.html → student_react.html

## Chosen slice
Most Common Issues chart parity (bar chart + tooltip + click-to-revise).

## Classic module checklist
- Upload (.docx) + clear file — **done**
  - React: `student-react/src/components/DropZone.jsx`, `student-react/src/App.jsx`
- Mark my essay → results/status → download marked/revised — **done**
  - React: `student-react/src/services/markEssay.js`, `student-react/src/App.jsx`, `student-react/src/components/PreviewPanel.jsx`
- Most Common Issues chart (bar chart + tooltip + click-to-revise) — **done**
  - React: `student-react/src/components/MostCommonIssuesChart.jsx`, `student-react/src/App.jsx`
  - Uses global Chart.js like Classic (loaded in `student_react.html`)
- Revision practice (issue buttons, examples, navigation, apply-to-preview, revision notes) — **partial**
  - React: `student-react/src/components/RevisionPracticePanel.jsx`
  - Missing: issue section grouping, approved rewrites flow, apply-to-preview, revision notes download
- Preview (metrics, zoom, power verbs, recheck, hint dock, highlight navigation) — **partial**
  - React: `student-react/src/components/PreviewPanel.jsx`
  - Missing: preview header stats panel, power verbs popover/tools, hint dock behaviors
- Dismiss issue modal — **missing**
  - Classic uses dismiss modal + persistence; React has no equivalent yet
- MLA header modal — **done**
  - React: `student-react/src/components/MlaModal.jsx`
- Topbar actions + tutorial helpers — **partial**
  - React: `student-react/src/components/Topbar.jsx`, `student-react/src/components/StudentTour.jsx`
  - Missing: full helper parity with classic tooltips and badges

## Known behavior differences
- Most Common Issues uses Chart.js bars with tooltip text, but currently uses a single color palette (classic colors by bucket).
- Revision practice is functional for label selection + examples, but does not yet support approved rewrites/apply-to-preview.
- Preview metrics and power verbs tools are not yet available in React.

## Verification steps (manual)
1. Open `student_react.html?practice=1`.
2. Upload and mark a `.docx` essay.
3. Confirm “Most Common Issues” chart renders with bars.
4. Hover bars → tooltip shows label + count (+ explanation if available).
5. Click a bar → revision practice opens and focuses that issue label.
6. Recheck and repeat to ensure chart updates with latest mark event.
