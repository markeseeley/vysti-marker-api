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
- [ ] **Builder is untracked + data CSVs gitignored → not version-controlled / not shippable.**
  `vysti-builder/` has **0 git-tracked files**; `.gitignore` has a blanket `*.csv` (only
  `!assignment-lexis.csv`), so all Builder data (`big_project/assignment-*.csv`,
  `vysti-builder/seed/*.csv`) is ignored. A real deploy can't ship the Builder or its data.
  Decide a tracking/build strategy (force-add the Builder code + seed/big_project CSVs, or a
  data pipeline) when Build is productionized.
- [ ] **Deployment text store.** Downloads are now served ONLY from `OWN_DIRS`
  (`vysti-builder/texts_own/` + the four `~/Desktop/vysti_data/<COURSE> Materials/` folders;
  set in `docker-compose.yml`). ~166 curated FE public-domain PDFs are served from those
  Materials folders. For production, bundle those served files (+ `texts_own/`) into an owned
  store and host via object storage / a disk; point `OWN_DIRS` at it. Primary Focus is never
  served (publisher editions only). `~/Desktop/Supplements/` is NO LONGER mounted by the app.
- [ ] **3 Further-Exploration rows removed** (no curated PD file existed), 2026-06-28, from
  `big_project/assignment-further-exploration.csv` (backup `.bak_prefe_remove`): *The Necklace*
  (Maupassant, aswl1_e4); *Holy Sonnet IX…* (Donne, aswl2_e2); *The neglected Lover…* (Wyatt,
  aswl2_e4). Re-add if curated PDFs are later created.
- [ ] **Minor:** `/file/{idx}` serves FE downloads as `application/octet-stream` (downloads
  fine; could set `media_type` from the extension for inline-PDF behavior).
- [ ] **Builder home catalog not restyled.** `vysti-builder/static/index.html` (the `/`
  event catalog) predates the card redesign and doesn't share the planner's card styling/
  components — landing and planner look like two apps. Restyle `index.html` to match
  `planner-cards.html` (same card/chip/token system). Design-only, no data risk.
- [ ] **Performance `x`-blanks are untyped.** In `planner-cards.html` the Performance builder
  renders each `x` in a feat as a free-text input with only an *empty-field* reminder on
  commit; there is no per-blank type (count vs. word-count vs. name). Type-aware hints +
  validation would require annotating each `x` in the `feats` data (`seed/performances.csv`).

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

### 2026-06-28 — Build: Key-Question answers, copyright DISTRIBUTION rework, PD text additions (Claude)
All work below is in the **Builder sandbox + `big_project/` data only** — the live app
(`vysti_api.py`, `marker.py`, `student-react/`, root `./assignment-lexis.csv`) was **NOT touched**.
Builder remains untracked/local (per precedent); these changes are committed **locally only**
(ledger + `.gitignore`); the Builder files themselves stay untracked.

**Done in the Builder (local):**
- **Key-Question answers:** authored canonical answers for all 270 KQs →
  `vysti-builder/seed/kq_answers.csv` (generator `scripts/gen_kq_answers.py`); app shows them in
  the drawer on click. Voice = plain definition + highest-level theory (named theorists),
  calibrated to the Lexicon's depth.
- **Copyright DISTRIBUTION model rework — "own the apparatus, point to the texts":** realized the
  held PDFs are modern **publisher editions** (copyrighted apparatus even for PD works), so we
  no longer serve them. (1) **Primary Focus is never downloadable** (`download=None`, both build
  paths) — shows descriptor + copyright badge + **"Find online"** (plain Google search of
  title+author; no stored links → no rot) + Buy. (2) **Downloads served ONLY from `OWN_DIRS`**
  (env): `texts_own/` + the four `vysti_data/<COURSE> Materials/` folders (our curated FE docs).
  `docker-compose.yml` updated (dropped `/supplements` mount; `OWN_DIRS` set). Needs
  `docker compose up -d` (recreate) not just restart.
- **FE curated downloads:** the curated per-poem PDFs (poem + exploratory questions) live in
  `vysti_data/<COURSE> Materials/`; filenames concat title+author w/ no spaces and start with a
  year. Rewrote `app.py match_file` to a substring matcher (+ Shakespeare-sonnet rule via the
  title's leading number, "from "-prefix strip, and a fuzzy fallback pass for typos like
  "Pysche"/missing-author files). Result: **166/166 FE public-domain readings now download**.
  Fixed a latent bug: keyword-cross-ref build path used `status = copyright_status(...)` (tuple)
  → now unpacked.
- **PD texts ADDED:** 33 public-domain works from the library survey →
  `big_project/assignment-primary-focus.csv` (`scripts/gen_additions.py`); pub-years/translation
  in `scripts/gen_pub_years.py` (212 rows); `author_dates.csv` expanded to 116 (survey classified
  ~89 candidate authors). Survey + suggested-Event map: `vysti-builder/CANDIDATE_PD_TEXTS.md`.
- **Removed** 3 FE rows with no curated PD file (see §3).
- **Docs created:** `vysti-builder/COPYRIGHT_AND_TEXTS.md` (full model + how-to-add-a-text),
  `CANDIDATE_PD_TEXTS.md`, `FAQ_SPEC.md` (brief for a future agent to build a `/faq`; no FAQ exists yet).
- **Criticism note:** the `/Supplements` academic-journal PDFs are copyrighted → engine input
  (read to write our apparatus), not distributable.

**Files touched (all sandbox/data; untracked or gitignored):** `vysti-builder/app.py`,
`static/planner-cards.html`, `docker-compose.yml`, `texts_own/README.md`, `seed/{kq_answers,
pub_years,author_dates}.csv`, `scripts/gen_*.py`, `COPYRIGHT_AND_TEXTS.md`, `CANDIDATE_PD_TEXTS.md`,
`FAQ_SPEC.md`; `big_project/assignment-{primary-focus,further-exploration}.csv` (+ `.bak_*`).
**Tracked + committed locally:** `HANDOFF_AND_CLEANUP.md`, `.gitignore`.
**Debt added:** §3 — Builder/data not version-controlled; deployment text store; 3 removed FE rows; octet-stream.
**Next agent MUST know:** distribution model is now **no Primary downloads; FE PD downloads only,
served from `OWN_DIRS`**. Before any deploy, resolve §3 "Builder is untracked + data CSVs gitignored"
and "Deployment text store" — the Builder and its data currently live only on local disk.

### 2026-06-28 — Build: card-redesign of the Builder event planner (Claude)
All work is in the **Builder sandbox only** — the live app (`vysti_api.py`, `marker.py`,
`student-react/`, root `./assignment-lexis.csv`) was **NOT touched**. Builder stays
untracked/local per precedent; only this ledger is committed (locally).

**Context:** session began as a design pass — compared the old designer's app
(`~/Desktop/PublicLearningApp-master`, a 2021 Vue/Quasar build: useful IA/step-flow, but
generic visuals + "Ideal" branding, not Vysti's) against the prototype. Conclusion: keep the
prototype's maroon/cream identity; the planner needed to become a **card system**.

**Done in the Builder (local):**
- **Created the card-based event planner** `vysti-builder/static/planner-cards.html` — the
  origin of the current card UI (other agents have since layered copyright/KQ/lexis-search
  features onto the same file; it is now co-edited).
- **Two-zone interaction model** (the core design): clicking a **card body** opens a shared
  right-hand **detail drawer** (full synopsis / FE excerpt / lexis entry / extension linked-
  lexis / goal sub-goals); a separate **checkbox** is the *only* add-to-plan control. Lexis
  keeps the pill model (term opens entry · `+` adds) — that split is now applied everywhere.
- **Performance builder:** clicking a Performance opens a builder — each feat is a checkbox
  row, and `x` placeholders render as **inline fill-in inputs**; "Add to plan" gives a gentle
  reminder (highlights rows) if a chosen feat has an empty blank; stores chosen feats + values.
- **Sticky Class Plan rail:** per-section counts, section nav w/ completion dots, Export JSON, Clear.
- **`/event` route → `planner-cards.html`** in `app.py` (redesign is the live Builder planner
  via normal navigation from the `/` catalog). Old `planner.html` left as the §3 orphan.
- **Review fixes:** removed the dead "Source" (Squarespace) button; FE/poetry excerpts now keep
  line breaks (`white-space:pre-wrap` + indent tidy); PDF links carry a real `download` attr
  (avoids inline-render "gibberish"); `esc()` coerces non-strings (a bad field no longer blanks
  the page); added a `?open=<itemKey>` deep-link for any card's detail.

**Files touched (all sandbox; untracked):** `vysti-builder/static/planner-cards.html` (created),
`vysti-builder/app.py` (`/event` route line only — file is concurrently edited by other agents).
**Tracked + committed locally:** `HANDOFF_AND_CLEANUP.md`.
**Debt added:** §3 — Builder home catalog (`index.html`) not restyled to match; Performance
`x`-blanks are untyped.
**Next agent MUST know:** `planner-cards.html` and `app.py` are being **co-edited by multiple
agents today** — pull/diff before large edits. The card interaction contract is **body = reveal
(drawer), checkbox = add**; preserve that split when adding sections. Builder remains untracked/
local; nothing here is deployed.

<!-- Next agent: add your dated entry below. -->
<!-- markdownlint-disable-file -->

