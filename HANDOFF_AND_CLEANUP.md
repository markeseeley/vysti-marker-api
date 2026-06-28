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
  ✅ **Lexicon done** (2026-06-28): single root `./assignment-lexis.csv`, Builder repointed,
  duplicate deleted. Other `big_project/*.csv` are Builder-only (no live duplicate).
- **One consistent event-key convention** across every CSV.
  ✅ **Done** (2026-06-28): all content CSVs normalized to `<course><num>_e<n>` + `_e7`
  (overview/performances/lexis already canonical). App runtime bridging is now dead code.
- **Dead/orphaned files removed**; every served file unambiguous.
  ✅ Orphan `planner.html` deleted (2026-06-28). Remaining: dated `.bak*`/`.backup` files in
  `big_project/` kept as provenance (gitignored).

**Remaining for "clean":** the 3 LIVE-touching items in `CLEANUP_LIVE_DIFFS.md` (article-strip
fix, `mise-en-scène` dedupe, term_norm convention) await user approval; off-machine private
backup of the Builder; and the productionization items (Builder tracking/build pipeline,
deployment text store) deferred until Build ships.

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

- [x] **Consolidate the two lexicon copies → one.** **DONE 2026-06-28 (cleanup agent).**
  Canonical = root `./assignment-lexis.csv` (live app's file). Builder repointed via new
  `LEXIS_PATH` env (default `vysti-builder/../assignment-lexis.csv`) in `vysti-builder/app.py`;
  the duplicate `big_project/assignment-lexis.csv` was **deleted**. Before merging, a single
  drift cell was reconciled (`big_project` had `feminity`→ corrected to root's `femininity`).
  Both apps now read ONE file; Builder re-smoke-tested (1514 rows, `build_event` OK).
  (Dated `big_project/assignment-lexis.csv.backup`/`.pre_cleanup_backup` left as provenance.)
- [x] **`term_norm` convention — RESOLVED (user-approved), applied locally 2026-06-28, pending
  deploy.** New canonical = **transliterate accents (NFKD→ASCII) → lower → non-alphanumerics
  (incl. hyphens) → `_` → strip**. Applied BOTH sides: (1) data — recomputed `term_norm` on **17
  rows** in root lexicon (fixed accent-mangled norms the old formula broke, e.g. `criture_f_minine`
  → `ecriture_feminine`, `diff_rance`→`differance`, and hyphen-collapse `amour-propre`→`amour_propre`);
  (2) code — `vysti_api.py` `_normalize()` now transliterates so raw accented chips match (e.g.
  `Aufklärung`→`aufklarung`). Verified: 0 collisions, 0 dangling refs, all sampled raw lookups
  resolve. Backup `assignment-lexis.csv.bak_termnorm`. **Update the project directive's term_norm
  formula to this transliterating version.**
- [x] **Epigraph quotes removed from ALL events — DONE (user-approved) 2026-06-28.** Per user:
  blanked `quote`/`quote_author`/`quote_source`/`quote_source_major`/`quote_source_minor` on all
  26 rows of `big_project/assignment-event-overview.csv` (removes the unreliable/misattributed
  epigraph feature; simplifies teacher-authored events). Supersedes the "Phaedo" fix above.
  Backup `.bak_quotes`. Sandbox/Builder-only data.
- [x] **Event-key normalization. DONE 2026-06-28 (cleanup agent).** Normalized the `event`
  column of all 4 content CSVs (`primary-focus`, `further-exploration`, `key-questions`,
  `extensions` in `big_project/`) to canonical `<course><num>_e<n>` (`asal_`→`asal1_`,
  `asel_`→`asel1_`). 613 cells changed; verified collision-free; **replayed `event_keys()`:
  all 26 events resolve to identical row counts (1383→1383), 0 orphans.** Backups `*.bak_keynorm`.
  NOTE: `app.py` `content_key()`/`event_keys()` bridging is now harmless **dead code** (it
  matched a superset) — safe to simplify to `{event_id}` later, but left in place (low priority).
- [x] **`_e7`/`_e8` legacy keys. DONE 2026-06-28 (cleanup agent).** Same pass: `key-questions`
  + `primary-focus` stored the 7th events as `asal_e8`/`aswl2_e8` → normalized to `_e7`
  (`extensions`/`further` already used `_e7`). No real 8th event exists; collision-checked.
- [x] **`quote_source_major` = "Phaedo" placeholder. DONE 2026-06-28 (cleanup agent).** 19
  events (aswl2_e1→asel1_e5) had the Plato/Phaedo citation copy-pasted into `quote_source` +
  `quote_source_major` though each `quote_author` differs. Ran a 38-agent research→adversarial-
  verify Workflow on the actual quotes. **14 corrected** with web-verified source works
  (conf 0.78–0.98: e.g. Madison→*Federalist No. 51*, Wordsworth→*Preface to Lyrical Ballads*,
  Orwell→*The Art of Donald McGill*, Sapir→*The Function of an International Auxiliary Language*).
  **5 BLANKED + flagged** (wrong "Phaedo" removed, no reliable source): `aswl2_e3` Molly Ivins
  (author OK, work unpinned), `aswl2_e4` C.S. Lewis (**misattributed — not Lewis**), `aswl2_e7`
  Elizabeth Wilson (unverifiable), `asal1_e1` John Smith (concept in *Generall Historie* but not
  verbatim), `asal1_e2` Jefferson ("Every generation needs a new revolution" **refuted as exact
  phrase**). Backup `.bak_phaedo`. **The 5 flagged need a human pedagogical call** on whether to
  keep/replace the displayed quote+author (out of scope for a data-cleanup pass).
- [x] **Duplicate lexicon term** `mise-en-scène` — **DONE (user-approved), applied locally
  2026-06-28, pending deploy.** Merged the two rows into one: kept `lex_mise_en_sc_ne_general_1`
  (has application/exploration/related_events) but took the clean `definition` + `roots`
  ("French") from `lex_adv_mise-en-scene`, which was deleted. term_norm now `mise_en_scene`.
  Root lexicon 1514→1513 rows. Backup `assignment-lexis.csv.bak_termnorm`.
- [x] **Orphaned planner file. DONE 2026-06-28 (cleanup agent).** Confirmed zero references
  (`/event` → `planner-cards.html`, app.py:532); deleted `vysti-builder/static/planner.html`.
- [x] **Endpoint article-strip edge — DONE (user-approved), applied locally 2026-06-28,
  pending deploy.** Rewrote `vysti_api.py` `get_lexis_term._normalize()`: exact-match the
  un-article-stripped form first (so `the Real`→`the_real`, not `real`). Validated 13/13 + 0
  regressions. (Combined with the term_norm convention change below in the same function.)
- [ ] **Decide the PDF library's home** (`~/Desktop/Supplements` + `~/Desktop/vysti_data`):
  keep external but documented, or bring under one data root.
- [x] **`vysti-builder/seed/lexis_additions.csv`** — **KEEP as provenance** (decided
  2026-06-28). It's the only record of the 196 additions now that the lexicon is a single
  consolidated file; cheap to retain. No action.
- [~] **Builder is untracked + data CSVs gitignored → DATA-LOSS RISK (partially addressed
  2026-06-28, cleanup agent).** `vysti-builder/` still has **0 files tracked on `main`**;
  `.gitignore` blanket-ignores `big_project/` + `*.csv`, so the Builder + all its data live
  ONLY on local disk. **Interim durability taken:** (a) tarball snapshot in scratchpad; (b) a
  **local orphan git branch `build-sandbox-backup`** (65 files: Builder code + data +
  `docker-compose.yml`, backups/caches excluded) — recoverable from `.git` now.
  **STILL NEEDED (off-machine):** push `build-sandbox-backup` to a **PRIVATE** remote. The repo
  `origin` is **PUBLIC** and `vysti-builder/seed/fr_excerpts.csv` contains **copyrighted third-
  party excerpts** → MUST NOT push to origin. The stored PAT can push but **cannot create** repos
  (and `gh` is not installed), so the user must create an empty private repo (`vysti-build-data`),
  then `git remote add` + `git push build-sandbox-backup`. **A non-`main` branch push does NOT
  trigger the Render live deploy.** Longer term: decide a real tracking/build pipeline for Build.
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
- [ ] **Minor:** `/file/{idx}` serves FE downloads as `application/octet-stream`.
  **(2026-06-28: now DELIBERATE** — `media_type=application/octet-stream` + `X-Content-Type-Options:
  nosniff` set on purpose to fix a Chrome "gibberish" download. Do NOT revert to inline `application/pdf`
  — it reintroduces the mangled-download issue in some Chrome / Safe-Browsing configs.)
- [ ] **Builder home catalog not fully restyled.** `vysti-builder/static/index.html` (the `/`
  event catalog) predates the card redesign. **(2026-06-28: banner, typography (DM Sans + Source
  Serif 4), and the #A90D22 / #f5f6f8 / #111 palette are now unified across index.html +
  planner-cards.html + faq.html.)** Still pending: the landing uses its own simpler card grid, not
  the planner's card/chip/token components — full component parity remains. Design-only, no data risk.
- [ ] **Performance `x`-blanks are untyped.** In `planner-cards.html` the Performance builder
  renders each `x` in a feat as a free-text input with only an *empty-field* reminder on
  commit; there is no per-blank type (count vs. word-count vs. name). Type-aware hints +
  validation would require annotating each `x` in the `feats` data (`seed/performances.csv`).
- [ ] **Unify the FAQ across ALL modes (one FAQ for Mark/Revise/Write/Build) — user request.**
  A **Build-only** FAQ now exists: `vysti-builder/static/faq.html` (route `/faq` in
  `vysti-builder/app.py`), an accordion built from `vysti-builder/FAQ_SPEC.md` (texts/copyright
  model), linked from the ladder menu on `planner-cards.html` + `index.html` + `faq.html`. The
  product goal is **ONE shared, app-wide FAQ** surfaced from every mode's menu — NOT a Build-only
  page. On integration: fold this content into a single FAQ (broaden it beyond texts/copyright to
  cover Mark/Revise/Write), surface it from every mode's `UserMenu`, and retire the Build-only
  page. Don't ship a divergent second FAQ.
- [ ] **Build "Report an issue" uses `mailto:` — user request to unify.** Ladder menu in
  `vysti-builder/static/{planner-cards,index,faq}.html` opens `mailto:contact@vysti.org`. The live
  app's `student-react/src/components/UserMenu.jsx` uses an in-page modal posting via
  `lib/reportIssue.js submitErrorReport`. On integration, replace the Build mailto with that shared
  in-app Report modal (needs a backend endpoint the prototype lacks).
- [ ] **Build ladder-menu Profile / Sign-out are placeholders** (no session in the prototype):
  Profile → `/profile` link; Sign out → `confirm()` + redirect to `/`. Wire to the real
  auth / `UserMenu` behavior on integration.

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

### 2026-06-28 — Build: keyword/citation/perf/extension data fixes + design unification + FAQ (Claude)
All work is in the **Builder sandbox + `big_project/` data only** — the live app (`vysti_api.py`,
`marker.py`, `student-react/`, root `./assignment-lexis.csv`) was **NOT touched**. Builder stays
untracked/local per precedent; only this ledger is committed (locally). NOTE: git shows
`student-react/src/components/TeacherTopbar.jsx` modified — that is **pre-existing live WIP, not mine**;
left unstaged.

**Done in the Builder / `big_project/` (local):**
- **Key Words job COMPLETE** (DATA_GUIDE §4): AI-generated `keywords` for every empty row of
  `big_project/assignment-primary-focus.csv` (167/167) and `assignment-further-exploration.csv`
  (567/567) — 632 readings via per-event subagents, reusing exact Lexis terms (~24–35%) for the
  vocab auto-select. `.bak` backups beside each.
- **Synopsis citations reformatted** in `assignment-primary-focus.csv` (164/167; 3 have none):
  body → blank line → `Citations`/`Citation` header → one ref per line; OCR space-before-punct
  tidied. Renderer parses it: `synHtml()` + `.cith/.cite/.syn-b` CSS in `planner-cards.html`
  (popover + drawer). Backup `assignment-primary-focus.csv.cite.bak`.
- **Performances bracket corruption fixed:** one feat in aswl1_e1 ("No Lords…") had a Python
  `['followers','profits','power']` list that comma-split into 3 broken fragments → merged into one
  clean feat; "Aa parable" typo → "A parable" (only 1 of 154; scanned all). Hardened `app.py`
  `_parse_feats()` (a bad feats cell can no longer crash startup) and added guardrail tool
  `vysti-builder/ingest_performances.py` (`validate` / `add`; serializes feats via `json.dumps`,
  rejects unbalanced-bracket fragments). Backup `seed/performances.csv.bak`.
- **Extensions fix:** one malformed row in `assignment-extensions.csv` (asal_e7,
  `ext_asal_e7_5f4d5d6e_1`) had verb+topic jammed in `assignment_command_type` → split to command
  `compare and contrast` / action `capitalism, socialism, and communism.` (only 1 of 349). Backup `.bak`.
- **Export plan = real Class Plan:** the "Export plan" button (`planner-cards.html`) now opens a
  printable, Vysti-styled Class Plan (resolves selections to actual content; citations; chosen
  Performance feats with blanks filled — fixed an "[object Object]" bug via `featFilled()`), not a
  raw JSON dump. Opens in a new tab → Cmd-P to PDF.
- **PDF download "gibberish" fixed:** `app.py /file/{idx}` now serves `application/octet-stream` +
  `X-Content-Type-Options: nosniff` so the browser always downloads (matches `shared/download.js` /
  Write). File verified byte-identical & valid. (§3 octet-stream note now marks this deliberate.)
- **Design unified to the live app** across `planner-cards.html` + `index.html` (+ new `faq.html`):
  added the **standard Vysti banner** (logo + Mark/Revise/Write/**Build**(active)/Progress pills with
  the app's `1.5px` strokes, + `?` help + ladder **menu** = Profile/FAQ/Report/Sign out, matched to
  live computed styles); switched fonts to **DM Sans (body) + Source Serif 4 @800 (headings)** and
  palette to **#A90D22 / #f5f6f8 / #111** (from the prototype's Gill Sans/Century Gothic + cream).
  Event picker moved OUT of the banner into an in-page "Event" switcher. Logo → `static/logo.svg`.
- **FAQ created (Build-only):** `vysti-builder/static/faq.html` + `/faq` route, accordion from
  `FAQ_SPEC.md` (texts/copyright model), linked from the ladder menu. (User wants this unified
  app-wide later — see §3.)
- *(Also this session, OUTSIDE the repo on `~/Desktop/vysti_data/`: stripped the "Ideal" header/footer
  logo from the ASWL `.docx` materials and exported clean PDFs via LibreOffice headless; added a
  "safe Performances ingest" note to `VYSTI_BUILDER_DATA_GUIDE.md`. External — not in this repo.)*

**Files touched (all sandbox/data; untracked or gitignored):** `vysti-builder/app.py`,
`vysti-builder/static/{planner-cards.html,index.html,faq.html,logo.svg}`,
`vysti-builder/ingest_performances.py`, `vysti-builder/seed/performances.csv` (+`.bak`),
`big_project/assignment-{primary-focus,further-exploration,extensions}.csv` (+`.bak`s).
**Tracked + committed locally:** `HANDOFF_AND_CLEANUP.md`.
**Debt added:** §3 — unify FAQ across all modes; Build "Report an issue" mailto→in-app modal;
ladder Profile/Sign-out placeholders. (octet-stream + index.html items annotated.)
**Next agent MUST know:** user wants **ONE app-wide FAQ** (not the Build-only page) and the shared
**in-app Report modal** — both deferred (§3). All Build work is local/untracked; the Key Words +
citation + performances/extension fixes live in gitignored `big_project/` + `vysti-builder/seed/`.

### 2026-06-28 — Cleanup Agent pass over §3 (Claude)
Worked §3 top-to-bottom. **Live Vysti Marker app NOT touched** (`vysti_api.py`, `marker.py`,
`student-react/` unchanged; root `./assignment-lexis.csv` **content** unchanged). Per the user's
"prepare diffs, don't apply" rule, all LIVE-touching changes are documented, not applied.

**DONE & verified (sandbox — applied locally, all in gitignored/untracked files):**
- **Event-key + `_e7`/`_e8` normalization** (§3 items 3+4): 4 content CSVs → canonical
  `<course><num>_e<n>`/`_e7`. Replayed `event_keys()`: all 26 events resolve identically
  (1383→1383 rows, 0 orphans). Backups `*.bak_keynorm`.
- **Lexicon consolidated to ONE file** (item 1): canonical = root `./assignment-lexis.csv`.
  `vysti-builder/app.py` repointed via new `LEXIS_PATH` env; deleted duplicate
  `big_project/assignment-lexis.csv` (reconciled a `feminity`→`femininity` drift first).
  Builder re-smoke-tested OK (1514 rows from root, `build_event` works, `docker-compose` mounts
  `.:/app` so the container sees root).
- **Orphan `planner.html` deleted** (item 7).
- **"Phaedo" placeholder fixed** (item 5) via a 38-agent research→adversarial-verify **Workflow**:
  14 events corrected with web-verified source works; 5 blanked + flagged (incl. 2 outright
  misattributions: the C.S. Lewis and the Jefferson quotes). Backup `.bak_phaedo`. Edited
  `big_project/assignment-event-overview.csv` (Builder-only data; live app doesn't read it).

**PREPARED but NOT applied (LIVE — need your approval; see new `CLEANUP_LIVE_DIFFS.md`):**
- **Article-strip fix** (item 8): validated diff for `vysti_api.py get_lexis_term` (4 terms
  currently mis-resolve to the wrong entry; fix = 13/13 correct, 0 regressions).
- **`mise-en-scène` dedupe** (item 6): pick which of 2 entries/definitions wins.
- **term_norm convention** (REOPENED): 16 rows use transliteration, not the strict formula
  (which mangles accents). Needs a convention decision, then a one-pass re-normalize.

**DATA-SAFETY (user's escalated priority — partial):** the Builder + data were local-disk-only.
Took: tarball snapshot + **local orphan branch `build-sandbox-backup`** (65 files). **Still needs
the user:** create an empty **PRIVATE** repo and push that branch — `origin` is PUBLIC and the
data includes copyrighted excerpts (`fr_excerpts.csv`), so it must NOT go to origin. The PAT can
push but can't create repos; `gh` not installed. A non-`main` branch push does NOT deploy the live app.

**Config:** added blanket `WebFetch` to `.claude/settings.local.json` (per user request) so web-
research agents stop prompting per-domain.

**Files touched (sandbox/untracked/gitignored):** `vysti-builder/app.py`,
`big_project/assignment-{extensions,further-exploration,key-questions,primary-focus,event-overview}.csv`
(+ `.bak_keynorm`/`.bak_phaedo`/`.bak_drift`), deleted `vysti-builder/static/planner.html` +
`big_project/assignment-lexis.csv`. **Tracked + committed on `main` (local only, NOT pushed):**
`HANDOFF_AND_CLEANUP.md`, `CLEANUP_LIVE_DIFFS.md`.
**Next agent MUST know:** (1) the 3 LIVE diffs in `CLEANUP_LIVE_DIFFS.md` are ready for approval;
(2) push `build-sandbox-backup` to a private remote to get the Builder off local disk; (3) the
5 flagged Phaedo events need a human pedagogical decision on the displayed quote/author; (4) the
`app.py` event-key bridging is now dead code (safe to simplify).

### 2026-06-28 — Cleanup follow-up: user approved the 3 LIVE diffs + quote removal (Claude)
User approved A/B/C and chose to delete all epigraph quotes. **All applied to the working tree
and committed LOCALLY; NOT pushed/deployed.**
- **A — article-strip** + **C — term_norm transliteration:** both in `vysti_api.py`
  `get_lexis_term._normalize()` (now transliterates accents + exact-matches the un-stripped form).
- **C — data:** root `./assignment-lexis.csv` term_norm recomputed on 17 rows.
- **B — `mise-en-scène`:** two rows merged into one (1514→1513). 
- **Quotes:** all 26 events' quote columns blanked (`big_project/assignment-event-overview.csv`).
- Verified: `vysti_api.py` compiles; Builder loads 1513 lexis rows + builds events; 0 collisions /
  0 dangling refs; raw accented + article lookups resolve.
**⚠️ DEPLOY GATE:** `vysti_api.py` + root `./assignment-lexis.csv` are LIVE files. They are
committed on local `main` but **NOT pushed**. Pushing `main` → Render **deploys to live users** —
do that only on the user's explicit go. Suggest a quick manual check of `/api/lexis/{term}` after deploy.
**Still open:** push `build-sandbox-backup` to the private remote (token needs access granted to
`vysti-build-data`).

<!-- Next agent: add your dated entry below. -->
<!-- markdownlint-disable-file -->

