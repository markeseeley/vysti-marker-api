# Vysti — Handoff & Cleanup Ledger

**Purpose.** This is the shared source of truth for work-in-progress and deferred
clean-up across the Vysti project. The project is large and multi-source; decisions and
tech-debt accumulate faster than any single agent (or chat session) can hold. This file
makes that state **visible, version-controlled, and durable** so any fresh agent can pick
up cleanly.

## How to use this file (the protocol)
1. **Before you start**, read this whole file + `CLAUDE.md`. Confirm which files are live
   (see "Gotchas").
2. **As you work**, if you create or discover deferred clean-up, add it to **§3 Cleanup
   Backlog** (with exact file paths + why + risk).
3. **Before you finish / hand off**, append a dated entry to **§4 Handoff Log**: what you
   did, files touched, debt added or resolved, and anything the next agent must know.
4. **The Cleanup Agent** (a dedicated pass, intended *after Build is complete*) works
   §3 top-to-bottom, checking items off, then updates §1 to reflect the new clean state.

Keep entries terse and factual. Link paths relative to the repo root
`vysti-marker-api-unified/` unless noted (some data lives on `~/Desktop/`).

---

## 1. Target end-state ("clean")
- **One canonical data root.** Today the curated data is split: code + `big_project/` +
  `vysti-builder/` live in the repo, but the live marking app and the Builder read
  *different copies* of some files, and the raw text library + originals live on
  `~/Desktop/` (`vysti_data/`, `Supplements/`). Goal: a single documented data root with
  no silent duplicates. (The ~11k-file PDF library may stay external — decide in cleanup.)
- **One copy of each dataset**, read by both apps (no drift-prone duplicates).
- **One consistent event-key convention** across every CSV.
- **Dead/orphaned files removed**; every served file unambiguous.

## 2. Repo / data map (current reality)
- **Live marking app** (Render, app.vysti.org): `vysti_api.py` + `marker.py` + `student-react/`.
  Reads the lexicon from **`./assignment-lexis.csv` (repo root)** via
  `marker.load_lexis_database()`.
- **Vysti Builder** (prototype, Docker port 8200): `vysti-builder/` (FastAPI `app.py` +
  `static/`). Reads cleaned CSVs from **`big_project/assignment-*.csv`**; seeds in
  `vysti-builder/seed/`.
- **External data** (`~/Desktop/`): `vysti_data/` (original `Complete*.xlsx`, course
  folders, `VYSTI_BUILDER_DATA_GUIDE.md`), `Supplements/` (reading PDFs).

## 3. Cleanup Backlog (the Cleanup Agent's worklist)
Ordered roughly by value/risk. Check off as done.

- [ ] **Consolidate the two lexicon copies → one.** `./assignment-lexis.csv` (live app)
  and `big_project/assignment-lexis.csv` (Builder) are kept in sync **by hand** — drift
  risk. Pick one canonical file and point the other app at it (e.g. Builder `DATA_DIR`
  lexis → root file, or vice-versa). Both are currently identical at **1514 rows**.
- [ ] **`term_norm` convention.** Canonical = underscore-joined, non-alphanumerics → `_`,
  e.g. `free_indirect_discourse`. Any new lexis row must follow this (raw spaces/accents
  break the live `/api/lexis/{term_norm}` lookup). Verified clean as of 2026-06-28.
- [ ] **Event-key normalization.** Overview keys American/European as `asal1_e1`/`asel1_e1`
  (WITH the "1"); content CSVs (primary/further/kq/ext) use `asal_e1`/`asel_e1` (NO "1");
  lexis uses the "1" form. App bridges both at runtime. **Canonical going forward =
  `<course><num>_e<n>`** (`asal1_e1`). Normalize the content CSV `event` columns.
- [ ] **`_e7`/`_e8` legacy keys.** Content CSVs store aswl2's & asal's 7th event under
  `_e8`; overview calls it `_e7`. App bridges (`build_event` adds the `_e8` variant).
  Normalize content to `_e7`. (Performances already use canonical `_e7`.)
- [ ] **`quote_source_major` = "Phaedo" placeholder** for most events aswl2 onward
  (data-entry error) in `assignment-event-overview.csv` — the event-header byline shows a
  wrong source title until fixed.
- [ ] **Duplicate lexicon term** `mise-en-scène` (pre-existing, appears twice) — dedupe.
- [ ] **Orphaned planner file.** `vysti-builder/static/planner.html` is the OLD planner;
  the live one is `planner-cards.html` (the `/event` route points there). Delete the
  orphan once confirmed unused.
- [ ] **(Optional) Endpoint article-strip edge.** `vysti_api.py` `get_lexis_term`
  `_normalize()` strips leading "the/a/an " from raw queries, so a linked-term chip
  passing a raw "the X" term (~9 terms, e.g. "the Real") can mis-resolve. The A-Z browse
  path (passes `term_norm`) is unaffected. Fix = check exact match *before* article-strip.
- [ ] **Decide the PDF library's home** (`~/Desktop/Supplements` + `~/Desktop/vysti_data`):
  keep external but documented, or bring under one data root.
- [ ] **`vysti-builder/seed/lexis_additions.csv`** is a tracking record of the 196 new
  lexis entries (already merged into both lexicon files). Keep as provenance or remove.

## 4. Handoff Log (append-only; newest at bottom)

### 2026-06-28 — Lexicon build-out + Build-mode data/feature work (Claude)
**Done & deployed to production (commits `2b83d45`, `8059225` on `main`):**
- **Lexicon build-out:** 1318 → **1514 terms**. Added 196 Language-Arts entries (critical
  theory, prosody, rhetoric, narratology, drama, linguistics, genre) to the teacher's-
  dictionary model (definition · etymology · roots · derivations · application · Socratic
  exploration · cross-links; global/untied; quotes blank). Authored via a 14-agent
  workflow; audited clean. Synced into BOTH lexicon files; live in Revise/Write Exploration.
**Done in the Builder (prototype, not yet a production deploy):**
- **Performances** seeded for all 26 events (`vysti-builder/seed/performances.csv`).
- **Further-Exploration excerpts** extracted from PDFs for all events
  (`vysti-builder/seed/fr_excerpts.csv`, 546 rows).
- **Copyright gating** (PD-only PDF downloads; `seed/pub_years.csv`, `author_dates.csv`).
- **Keyword connector + Lexis search + cross-event import + add-any-lexis + missing-term
  tracker** in `static/planner-cards.html` / `app.py`.
- **`_e7`/`_e8` and `asal_`/`asel_` key bridging** added to `app.py` `build_event`.
**Debt added/confirmed:** all of §3 above (the two-file lexicon split, key conventions,
"Phaedo" placeholders, the planner orphan, mise-en-scène dup).
**Next:** finish Build, then run the Cleanup Agent over §3. Builder changes are local/
untracked (Builder is WIP); only the two lexicon commits are on `main`.

<!-- Next agent: add your dated entry below. -->
