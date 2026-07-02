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
- **Clean lexicon data** (no corruption in displayed fields).
  ✅ **Done & DEPLOYED (2026-06-29):** the 3 LIVE diffs from `CLEANUP_LIVE_DIFFS.md` (article-strip,
  `mise-en-scène` dedupe, transliterating term_norm) were user-approved and shipped (`6c8badc`). A
  further data-quality sweep of `./assignment-lexis.csv` then found+fixed+deployed: run-on
  `application` bullets (`a807de9`/earlier), intra-field duplicated sentences in
  `application`/`application_options`/`etymology` (`3ee35a8`), unbalanced/mismatched double-quotes
  across 48 fields (`a807de9`), and leaked Python list-repr in 9 prose cells + 131 `assign_lexis`
  cells (`0aa5e2f`). **Non-lexicon Builder CSVs audited 2026-06-29 and confirmed clean** (the
  performances `feats` list-reprs are the intended JSON format; `fr_excerpts` "dup sentences" are
  poetic refrains; `etymology-review.csv` is an unused orphan). One known blemish left: a single
  truncated `extensions.action` (asel1_e2, Locke) cut mid-word with an unclosed quote — needs the
  source text, not a quote fix (see §3).

**Remaining for "clean":** off-machine private backup of the Builder (needs the user — see §3
DATA-LOSS item); and the productionization items (Builder tracking/build pipeline, deployment text
store) deferred until Build ships.

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
  **Off-machine backup NOW EXISTS (updated 2026-06-29):** the user created the private repo and it's
  wired as the `build-backup` remote → `github.com/markeseeley/vysti-build-data.git`; the
  `build-sandbox-backup` branch is pushed there (`remotes/build-backup/build-sandbox-backup`). The
  copyrighted `fr_excerpts.csv` lives ONLY on that private remote, never `origin` (public). **A
  non-`main` branch push does NOT trigger the Render live deploy.**
  **REMAINING:** the off-machine snapshot is the **2026-06-28** state — it does NOT yet include the
  6/29 Builder work (library search, export polish, Gold-Bug fix, + the concurrent agent's Primary
  Focus work). **Refresh once the current Build session settles** (don't snapshot mid-edit): re-add
  the Builder + data into `build-sandbox-backup` (force-add past `.gitignore`) and
  `git push build-backup build-sandbox-backup`. Confirm the remote is still PRIVATE before pushing
  (copyrighted excerpts). Longer term: decide a real tracking/build pipeline for Build.
- [ ] **Deployment text store.** Downloads are now served ONLY from `OWN_DIRS`
  (`vysti-builder/texts_own/` + the four `~/Desktop/vysti_data/<COURSE> Materials/` folders;
  set in `docker-compose.yml`). ~166 curated FE public-domain PDFs are served from those
  Materials folders. For production, bundle those served files (+ `texts_own/`) into an owned
  store and host via object storage / a disk; point `OWN_DIRS` at it. Primary Focus is never
  served (publisher editions only). `~/Desktop/Supplements/` is NO LONGER mounted by the app.
- [ ] **Amazon affiliate links for Primary Focus (PRODUCT INTENT — user, 2026-06-29).** The user
  wants Primary Focus readings (both the curated canon AND the new "Other recommendations") to carry
  **Amazon affiliate purchase links** as the monetized "Buy" path. NOTE the user's framing: PD-vs-copyright
  status is **not legally important for Primary Focus** because we never serve the PDF — we only *point*
  to the text — so the affiliate "Buy" link is the real call-to-action, not the copyright badge. To wire:
  populate `purchase_link` (curated `assignment-primary-focus.csv`) and add an affiliate link for the
  recommended canon (`assignment-primary-focus-recommended.csv` currently has `purchase=None`; see the
  `TODO(affiliate)` in `vysti-builder/app.py build_event`). The card/drawer already render a **Buy** pill
  whenever `purchase` is set (`readingCard`/`openDetail` in `planner-cards.html`) — just supply the URLs
  (with the affiliate tag). Consider a single helper that builds the tagged Amazon search/product URL from
  title+author so links don't rot.
- [ ] **"Other recommendations" canon — open follow-ups (2026-06-30).** The separate, no-synopsis recommendation
  layer is now substantial (**PF-recommended 253 rows; FE-recommended 164 rows** — see the 2026-06-30 Handoff
  entries). Remaining, by priority: **(a)** finish the contemporary/global gap — 4 named authors still absent
  (**Ishiguro, Murakami → aswl2_e7; Kincaid → aswl2_e6; Lorde → aswl1_e6/asal1_e7**); a tiny targeted top-up
  closes it (28/32 bellwethers present now). **(b)** Mine more **world-voice PROSE** from the IB Paper 1 folder
  (Forna, Vassanji, Nuruddin Farah, Anuradha Roy, Meron Hadero, Charles Yu…) — only ~11 added so far. **(c)**
  FE **short-story / drama** recommendation passes (poetry + essays done; the IB folder also has drama: David
  Hare, Nilo Cruz, J.A. Ferguson). **(d)** Extend the **apparatus-gap** mining from poems to PROSE references in
  Performances (e.g. Hemingway *Men Without Women*, Ovid *Metamorphoses*). All follow the SAME contract: separate
  file, NO AI synopsis, keywords from Lexis, Find-online, global-curated dedup. Recommendation-CSV **provenance +
  workflow JSON** are in `big_project/*_workflow_result.json`; the reusable workflow scripts are in the session
  scratchpad (`pf_recommendations`, `fe_poetry`, `fe_essays`, `ib_poetry`, `broader_poetry`, `world_prose`).
- [ ] **3 Further-Exploration rows removed** (no curated PD file existed), 2026-06-28, from
  `big_project/assignment-further-exploration.csv` (backup `.bak_prefe_remove`): *The Necklace*
  (Maupassant, aswl1_e4); *Holy Sonnet IX…* (Donne, aswl2_e2); *The neglected Lover…* (Wyatt,
  aswl2_e4). Re-add if curated PDFs are later created.
- [ ] **Truncated extension action (1 row).** `big_project/assignment-extensions.csv` row
  `ext_asel_e2_40b1424f_1` (asel1_e2): `action` is cut off mid-word — *"…John Locke "gives his
  positive account of how we acquire the materials of k…"* — with an unclosed quote. It's surfaced
  in the Extensions section. Needs the original source text restored (not a quote-balance fix), so
  left for a human/data pass. The rest of the Builder data was audited 2026-06-29 and is clean.
- [ ] **Minor:** `/file/{idx}` serves FE downloads as `application/octet-stream`.
  **(2026-06-28: now DELIBERATE** — `media_type=application/octet-stream` + `X-Content-Type-Options:
  nosniff` set on purpose to fix a Chrome "gibberish" download. Do NOT revert to inline `application/pdf`
  — it reintroduces the mangled-download issue in some Chrome / Safe-Browsing configs.)
- [x] **Builder home catalog restyled — DONE 2026-06-29.** `vysti-builder/static/index.html`.
  (2026-06-28: banner/typography/palette unified.) **2026-06-29:** card polish for parity with the
  planner — equal-height cards, 3-line clamped descriptors, hover **Open ›** affordance, per-
  collection **count pills**; plus a **client-side live filter** (title/descriptor/course; "create
  your own" hidden while filtering; no-match message). Pure static `index.html` — no `app.py`, no
  live-app touch. (The planner's chip/token components are reading-level and don't apply to an Event
  list, so the catalog is now considered at parity.)
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
- [ ] **Add "Build" to the live app nav — DEFERRED 2026-06-28 (user request, scoped but not done).**
  User wants Build accessible from the live app. Two reasons it was deferred rather than bolted on:
  (1) the Mark/Revise/Write nav is **duplicated across 7 files** (`components/{Topbar,TeacherTopbar,
  WriteTopbar}.jsx`, `ProfileApp.jsx`, `PracticeApp.jsx`, `components/{PracticeSummary,ProfilePage}.jsx`)
  — a gated pill would have to be copy-pasted into all 7 (and `TeacherTopbar.jsx` has live WIP);
  (2) the Builder isn't hosted (local Docker `:8200` only). **Product intent:** Build is a **paid
  subscription** like Mark/Revise (Write is universally free). **Do it right when productionizing:**
  (a) consolidate the 7 navs into ONE shared `<Nav>` component; (b) add a real **`has_build`**
  entitlement/product (backend `/api/profile` `products` + Stripe price) — NOT a hardcoded owner
  email; (c) point the pill at the **hosted** Builder (deploy `vysti-builder/` from the PRIVATE
  `vysti-build-data` repo as its own Render service). For now the user tests Build on local Docker.
  (Email IS available for gating if ever needed: `/api/profile` returns `email`; `supa.auth` exposes
  `user.email`.)

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
**✅ DEPLOYED + VERIFIED 2026-06-28.** User approved; `main` pushed to origin (`6c8badc`) → Render
rebuilt. Confirmed live on app.vysti.org: `/api/lexis` now serves **1513** terms (merge live),
`ecriture_feminine` replaced `criture_f_minine`, and spot-checks pass — `the_real`→"the Real" (no
longer "real"), raw "différance"→"différance", `mise_en_scene`→"mise-en-scène" w/ clean definition,
`metaphor` regression OK. No downtime (old build served until swap). (This corrective ledger note
was committed locally AFTER the deploy and intentionally NOT pushed alone, to avoid a redundant
rebuild — it will ride along with the next functional deploy.)
**Still open:** push `build-sandbox-backup` to the private remote (token needs access granted to
`vysti-build-data`).

### 2026-06-29 — Build: Export Student/Teacher guides, Lexis app/expl selection, lexicon exploration de-dup (Claude)
**Builder sandbox work (local/untracked; live app NOT touched):**
- **Flavor quotes — finished the removal.** Prior agent had blanked the quote columns but the running
  container served stale data; removed quote rendering from `static/planner-cards.html` (hero + printable
  plan) and dropped the dead `quote` (and obsolete `segue`) fields from `app.py`'s event payload. Quotes
  are gone in data AND code now.
- **Export plan → two guides.** `buildPlanHtml()` now emits ONE preview with a `[Student | Teacher]`
  toggle; Print outputs whichever is shown. Split (user-decided): KQ **answers**, reading **keywords**,
  and Lexis **Exploration** are **teacher-only**; Performances/Extensions/Continual-Goals (now with
  sub-goal **explainers**) + Lexis **Application** are shared. Segues deleted (legacy chronological cruft).
- **Lexis Application/Exploration per-term selection.** The Lexis drawer is now a builder (like the
  Performance builder): each Application line / Exploration prompt is a tickable row, plus per-group
  "Show on Student guide" toggles (Application default ON, Exploration default OFF). Selection stored as
  `{term,app,exp,appStu,expStu}` (chosen bullet **texts**, drift-proof, works for imported terms too).
  The quick `+` chip still fast-adds with section defaults. Removed dead `lexImpBtn`/`toggleLexis`.
- **Graphical fix:** picker showed empty checkboxes — root cause was corrupt lexicon data (below).
  Hardened `splitApp`/`splitExp` to drop punctuation-only tokens and de-dup.

**LIVE deploy (user-approved fix & deploy):**
- **Lexicon `exploration` corruption fixed.** 181 rows of root `./assignment-lexis.csv` had duplicated
  Socratic prompts (questions repeated with stray `". "`/`", "` prefixes; also curly-vs-straight apostrophe
  variants) in `exploration` (112) + `exploration_options` (181). Also showed up in LIVE Revise/Write
  Exploration (double-listed prompts). Cleaned via **abbreviation-aware** sentence splitting (mirrors
  `student-react/src/components/LexisModal.jsx splitExploration`, so "Plessy v. Ferguson?" stays intact —
  naive dedup would have destroyed its 5 distinct questions) + key-dedup. **Verified: 0 unique prompts lost,
  0 distinct questions merged, only those 2 columns changed, 1513 rows/23 cols intact, 0 duplicates remain.**
  Backup `assignment-lexis.csv.bak_expdedup` (gitignored). Committed + pushed to `main` → Render.

**Files touched:** `vysti-builder/static/planner-cards.html`, `vysti-builder/app.py` (sandbox, untracked);
root `./assignment-lexis.csv` (tracked, LIVE, deployed); this ledger.
**Next agent MUST know:** the bigger Lexis idea (per-particular selection) is now built for the Lexis step;
the remaining piece of the user's "multi-stage / skippable" plan-builder vision is the guided **stepper**
(Readings→Lexis→…→Export, each skippable). Builder still local/untracked (§3 data-loss risk unchanged).

### 2026-06-29 — Build: Lexis bullet rendering + keyword→Lexis auto-select + Docker lexicon fix (Claude)
Two user-requested Build improvements + one infra bug found along the way.

**LIVE deploy (user-approved):**
- **12 run-on `application` bullets split** in root `./assignment-lexis.csv`. Some entries (e.g. **myth**)
  had multiple learning objectives glued without a separating period, so the bullet splitter (both the
  Builder drawer AND the live `LexisModal` — identical regex) merged them into one bullet. Found 187
  candidate rows; a **12-agent Workflow** re-segmented them; each fix **strictly validated in Python**
  (`normalize(old)==normalize(new)` keeping only a-z0-9 → only periods/case/space changed, words
  byte-identical) and required an increased bullet count. 12 accepted, 19 rejected (those were
  capitalization-only, already handled by the renderer). Terms fixed: agrarianism, alienation,
  Catholicism, end stop, enhanced interrogation techniques, katabasis, myth, Neoclassicism, Noah and
  the Ark, Sacagawea, sphere of influence, Triangle Shirtwaist Factory Fire. Backup
  `assignment-lexis.csv.bak_runon` (gitignored); reviewed diff `LEXICON_RUNON_DIFF.md` (untracked).
  **⚠ Committed+pushed by a CONCURRENT agent's commit `0d93b6d`** (we shared the working tree; their
  `git add assignment-lexis.csv` swept in my `application`-column edits alongside their `exploration`
  de-dup). **Verified live on app.vysti.org** (`/api/lexis/myth` now has `etc. Understand…`). All 12
  confirmed exact in HEAD==origin; `application_options` untouched.
- **Note (NOT fixed, out of scope):** agrarianism + alienation have **pre-existing duplicated sentences**
  in their `application` (the dup was in the source; the period-fix just made it visible as repeated
  bullets). A future data-quality pass could de-dup `application` like the exploration de-dup did.

**Builder sandbox (local/untracked — coexist with the concurrent agent's same-file edits):**
- **Capitalization fix** (`static/planner-cards.html`): Lexis Application/Exploration bullets now
  normalize to leading-capital + no trailing period (`cap()`), matching the live `LexisModal`. (Fixes
  the user's "Understand capitalized but others lowercase" report; the concurrent agent's Lexis-builder
  rework + my `cap` now both live in the file — verified the merged result renders correctly.)
- **Keyword → Lexis auto-select** (Task 2): selecting a Primary Focus / Further Exploration reading
  auto-ticks any of the Event's Lexis terms matching that reading's `keywords` (e.g. *Tales from Ovid* /
  *Ulysses* → keyword "myth" → Lexis "myth" auto-selected), with a confirmation `toast()`. **Additive
  only** (de-selecting a reading never un-ticks Lexis). Stores a bare-string value via the existing
  `toggle()` path — compatible with the concurrent agent's object-valued Lexis builder (their render/
  export defensively treat a bare string as "term added, no curated lines yet", same as a quick `+` add).
- **Docker bug FIXED (was breaking ALL Build-in-Docker):** the lexicon consolidation repointed
  `LEXIS_PATH` to the repo root, but `docker-compose.yml` never mounted that root file into the
  container → lexicon loaded **0 rows** in Docker (myth card, all Lexis, and auto-select all dead).
  Added `../assignment-lexis.csv:/app/assignment-lexis.csv:ro` mount + `LEXIS_PATH=/app/assignment-lexis.csv`.
  Now loads 1513 terms. (Cleanup agent likely smoke-tested via native Python where `../` resolves, not Docker.)
  **Needs `docker compose up -d` (recreate), done.**

**Files touched:** root `./assignment-lexis.csv` (LIVE, deployed via `0d93b6d`); `vysti-builder/static/
planner-cards.html` + `vysti-builder/docker-compose.yml` (sandbox, untracked); this ledger;
`LEXICON_RUNON_DIFF.md` (untracked record).
**Next agent MUST know:** (1) `planner-cards.html`/`app.py`/root lexicon were **co-edited by 2+ agents
on 2026-06-29** — diff before large edits; my Builder edits are uncommitted in the shared tree;
(2) the Docker lexicon-mount fix is real — if Build shows no Lexis, check the `LEXIS_PATH` mount.

### 2026-06-29 — Lexicon: intra-field sentence de-duplication (Claude)
Follow-up to the prior `exploration`/`exploration_options` de-dup — same corruption, the
`application` side. **LIVE deploy (user-approved), committed+pushed by me as `3ee35a8`.**
- **Removed sentences repeated verbatim within a field** in root `./assignment-lexis.csv`:
  `application` **9 rows** (displayed in live Revise/Write + Builder — e.g. agrarianism,
  alienation, anagnorisis, Aesthetes, aphorism, aside, canon, hegemony, Weltanschauung),
  `etymology` **1** ("surplus labor" had a `||`-separated full duplicate), and
  `application_options` **178** (NOT read by any code — cleaned for parity/cleanliness only).
  `exploration*` already clean (commit `0d93b6d`). No row-level/term duplicates exist
  (mise-en-scène already merged).
- **Method (deterministic, no LLM):** abbreviation-aware sentence split (mirrors
  `LexisModal`) → among normalized-equal copies keep the **best-spaced** variant, *cleaned of
  leading `||`/junk*, at its first position → terminal periods restored on rejoin. Two edge
  cases found+fixed during dev: naive "keep-first" kept an OCR-mangled `acharacteris` over the
  clean copy; naive "keep-longest" kept a `|| Labor…` junk variant. Final rule (best-spaced +
  junk-strip) handles both.
- **Verified:** identical set of unique sentences before/after (**0 lost, 0 fabricated**, per-cell
  set-equality), sentence count strictly decreases, only those 3 columns changed, 1513 rows/23
  cols intact, **0 duplicates remain**. Backup `assignment-lexis.csv.bak_appdedup` (gitignored);
  reviewed diff `LEXICON_DEDUP_DIFF.md` (untracked). Local Builder restarted to load the clean CSV.
- **Process note:** unlike the run-on fix (which got swept into another agent's commit), this one
  was applied→committed→pushed in one controlled motion (staged `assignment-lexis.csv` only).

### 2026-06-29 — Lexicon: dedupe singular/plural terms + Apollonian/Dionysian article (Claude)
User flagged `stanza`/`stanzas` (and on review, more) as redundant, and inconsistent articles on
the Nietzschean pair. Edited LIVE root `./assignment-lexis.csv` (user-approved, deployed).
- **Deleted 5 duplicate rows** (1513→1508): `stanzas`→`stanza`, `stock characters`→`stock character`,
  `unions`→`union` (merged events `aswl1_e5,asal1_e5` + took its richer linked_lexis), `aporias`→`aporia`,
  `maieutic`→`maieutics` (kept the noun/event entry; user call). **Kept `value` vs `values` distinct**
  (different concepts — worth vs moral principles).
- **Article consistency:** renamed `Dionysian`→**the Dionysian** (term + term_norm `the_dionysian`) to
  match existing **the Apollonian** (user chose "both the …").
- **linked_lexis remapped** in 14 surviving rows so deleted terms + bare `Apollonian`/`Dionysian`
  point to the canonical forms (no dangling chips). Did NOT touch the ~253 pre-existing self-references
  (out of scope).
- **Verified:** only `term`/`term_norm`/`related_events`/`linked_lexis` changed; 0 dangling linked_lexis
  tokens; value/values both present; 1508 rows/23 cols; Builder reloads 1508. Backup
  `assignment-lexis.csv.bak_dedup_terms` (gitignored). Committed + pushed → Render.

### 2026-06-29 — Lexicon: balance unclosed/mismatched double-quotes (Claude)
User reported myth's Application "…as “a type of speech" had no closing quote. Scanned the
whole lexicon — widespread (like the run-on issue). **LIVE deploy (user-approved), pushed as
`a807de9`** (myth's own fix rode in the concurrent agent's `b58cd6e` earlier).
- **48 fields balanced** across `application`/`application_options`/`application_default`,
  `definition`, `etymology`, `exploration`/`_options`, `quote`, `source_major`. Defect types:
  dangling open (myth, ACLU, Schlüsselroman, Ludlow, moralism, anadiplosis, kakistocracy…),
  stray close (Yahoo `disgust"`), and mismatched curly/straight pairs (`“hero"`, `“in medias res"`,
  tu quoque). Fixed via a **4-agent Workflow** (quote chars only) + 9 hand-fixed cells the agents
  skipped (batch-index drift).
- **Strict validation:** ONLY the double-quote chars (`"` `“` `”`) added/removed/swapped — proven by
  `strip_doublequotes(origin)==strip_doublequotes(working)` byte-identical across **all 48 fields**
  (0 non-quote diffs), and each result quote-balanced. 1508 rows/23 cols intact.
  Backup `assignment-lexis.csv.bak_quotefix` (gitignored).
- **⚠ FLAGGED (NOT fixed — separate corruption, out of scope):** `Space Race` **application_default**
  holds a leaked **Python list-repr** (`"['situate…','…failures` — truncated, escaped quotes). Needs
  reconstruction into a plain string, not a quote fix. Only remaining quote-"defect" in the lexicon.
- **Concurrency this turn:** the lexicon went 1513→1508 mid-turn via another agent's `b58cd6e`
  (singular/plural term dedup + Apollonian/Dionysian) — NOT data loss; my fixes validated cleanly on
  top of it. `assignment-lexis.csv` is being edited by 2+ agents today — always diff vs origin first.

### 2026-06-29 — Lexicon: fix leaked list-repr corruption (140 cells) (Claude)
Followed the Space Race `application_default` flag (prev entry) — turned out to be a whole class.
**LIVE deploy (user-approved), pushed as `0aa5e2f`.**
- **9 PROSE cells:** `Space Race` application/_options/_default (pure Python `"['…']"` repr; _default
  truncated mid-list); `figuration`/`hero`/`hipsters`/`hybris` **application_options** and
  `figuration`/`Homestead Act` **exploration_options** (list-repr; the app_options ones had the clean
  text DUPLICATED after `]. ` — kept that suffix). Parsed/joined to plain prose.
- **131 `assign_lexis` cells:** stored as `"['a','b',…]"` → broke the live **Related-terms chips**
  (`assign_lexis.split(',')` yielded `['a'`, `'b'`, …). Normalized to `a, b, …` (matches the 1077
  already-plain rows). Some had a trailing suffix (`…]; blank verse`) — preserved.
- **FALSE POSITIVES correctly left untouched:** `action`/`antecedent` **quote** fields begin `"[W]here…`
  / `"[I]t is…` — those are **editorial-bracket scholarly quotations**, not list-reprs. A naive
  `startswith('"[')` scan flags them; the precise detector (`[` + quote + …+ `,`) does not.
- **Validation:** content-preserving — prose parsed alphanumeric-equal (or clean-suffix-equal);
  assign_lexis validated as a subset of original terms (only structural `[] '' ,` removed). Diffed vs
  origin: ONLY `assign_lexis`(131)/`application_options`(5)/`exploration_options`(2)/`application`(1)/
  `application_default`(1) changed; **0 list-repr cells remain** (whole row, precise); 1508 rows/23 cols
  intact. Backup `assignment-lexis.csv.bak_listrepr` (gitignored).

### 2026-06-29 — Build: library search for Primary Focus + export/data polish (Claude)
Five user-requested Build improvements. **All Builder-sandbox only** (`vysti-builder/` +
gitignored `big_project/` FE data) — live app/lexicon NOT touched, nothing deployed. Builder
stays untracked/local per precedent; only this ledger is committed.

1. **Primary Focus library search.** New `GET /api/library/search?q=` (`vysti-builder/app.py`)
   searches the whole Primary-Focus canon by **title OR author** (substring, deduped, startswith-
   ranked). New `＋ Add a Primary Focus from the library` button on the Primary section opens a
   drawer search (`openLibrarySearch`/`runLibrarySearch`/`drawLib`/`toggleLib` in
   `static/planner-cards.html`); results import via the existing `imp` mechanism (sec="primary"),
   render as native cards, and trigger the keyword→Lexis auto-select. Texts already native to the
   open Event show "in this Event" instead of a dup. (User note: canon curation/recommendation is
   a later agent's job.)
2. **Gold-Bug FE header fix (data).** 3 FE rows had title+author jammed into BOTH `title_minor`
   and `author_name` (`big_project/assignment-further-exploration.csv`): "The Gold Bug Edgar Allan
   Poe", "The Globalization of America's Colleges Laura McKenna", "A Bawdy Milton Poem… Philip
   Reeves". Split into proper title/author; re-keyed their `seed/fr_excerpts.csv` rows + stripped the
   duplicated title/author prefix from each excerpt. (The other 5 title∋author rows are legit —
   e.g. "Tecumseh's Speech…"/"Tecumseh" — left alone.)
3. **Export filename = guide name.** Export `<title>` now `"<Event> — Student Guide"` (was "Class
   Plan"); a tiny script flips it to "… — Teacher Guide" when the Student/Teacher toggle changes, so
   the saved PDF is named for the chosen guide. (Print CONTENT still depends only on the CSS toggle.)
4. **No browser print header/footer in production.** The printed export showed the browser's auto
   header (date/time) + footer (the `/plan/<token>` URL). Fixed with `@page{margin:0}` (browsers omit
   their auto chrome at margin 0) + the sheet supplies its own `15mm 16mm` print padding. This is the
   page-side mitigation; it removes them regardless of the user's print-dialog setting.
5. **Export drops FE excerpts.** Further-Exploration entries in the exported plan now show title +
   author (+ keywords on the Teacher guide) only — the excerpt paragraph was removed.

**Gotcha logged for next agent:** when emitting a nested `<script>` inside a JS template literal
(the export's title-updater), the literal `</script>` closes the OUTER page script in the HTML
parser → "Unexpected end of input". Escape it as `<\/script>` (and I split the opener as `<${""}script>`).

**Files (all untracked/sandbox):** `vysti-builder/app.py`, `vysti-builder/static/planner-cards.html`,
`big_project/assignment-further-exploration.csv`, `vysti-builder/seed/fr_excerpts.csv`. Verified in
the local Docker Builder (search by title+author, add-to-plan, Gold-Bug header, export title/toggle/
no-excerpt, `@page` margin).

### 2026-06-29 — Build: "Other recommendations" canon for Primary Focus (Claude)
All work is **Builder-sandbox / `big_project/` only** — the live app (`vysti_api.py`, `marker.py`,
`student-react/`, root `./assignment-lexis.csv`) was **NOT touched**; nothing deployed. New data lives
in a **separate file**, deliberately kept apart from the user's 200 hand-curated, PhD-authored entries.

**Goal (user):** now that Vysti is online (no finite physical library), recommend canonical texts a
teacher *could* teach per Event — sourced from authoritative canons — organized by (1) PD vs copyrighted,
(2) Event, (3) keyword. **Hard constraint:** the user does **NOT** trust AI to write the academic
descriptors (the existing synopses were written by a human PhD). So recommendations carry **NO synopsis** —
only verifiable factual metadata — and surface under an **"Other recommendations"** header, never mixed
into the curated 200.

**Done:**
- **New file `big_project/assignment-primary-focus-recommended.csv`** — **284 texts across all 26 Events**
  (~11/Event; the two previously-empty Events `aswl1_e7` + `asal1_e2` now have 11 each). Columns:
  `primary_focus_id,event,title,author_full_name,author_last_name,reading_category,level_ability(=['advanced']),
  keywords,pub_year,author_death_year,copyright_status,source_canon,fit_note,active`. **No synopsis field.**
  `keywords` were constrained to each Event's **existing Lexis vocabulary** (closed set → cannot hallucinate
  new terms; feeds the planner's keyword→Lexis auto-select). `fit_note` is a short INTERNAL curation note,
  NOT a student-facing descriptor.
- **Method — 52-agent Workflow** (`scratchpad/pf_recommendations.workflow.js`): per-Event **discover**
  (8–12 advanced canonical picks, web-researched, from the AP-Lit Q3 bank + Pulitzer/Nobel + NCTE/Common-Core
  exemplars + college-prep lists) → per-Event **adversarial verify** (independent skeptic re-checks each text's
  existence/attribution, pub-year, author death-year, **PD-vs-copyright** under the 2026 US rule pub≤1930,
  and Event-fit/level). 289 proposed → 284 accepted, **5 rejected** (good catches: *The Sound and the Fury*
  = American author in the European course; a Thoreau/Paine *Civil Disobedience*/*Common Sense* title
  conflation; *Heart of Darkness*/*Tom Sawyer*/*Self-Reliance* weak Event-fit). Confidence median 0.96.
- **Copyright split:** 215 public-domain / 65 in-copyright / **4 uncertain**. The 4 uncertain + 6 discover↔verify
  disagreements are all **translation/edition nuance** (e.g. *Siddhartha*, *The Birth of Tragedy*, *Hyperion*,
  *Gilgamesh*: ancient/foreign original is PD but the standard **English translation** is in-copyright) — stored
  with the verifier's **conservative** status. (Low stakes anyway: Primary Focus is never downloadable — status
  only drives the badge + "Find online"/Buy.) Full list in the review doc.
- **Dedup-checked:** 0 collisions with the curated 200; the lone internal "dup" (*Essays*) is Montaigne vs Bacon
  (distinct), not a real duplicate.
- **Docs/provenance:** `vysti-builder/RECOMMENDED_TEXTS_REVIEW.md` (per-Event counts, the 10 flags, the 5
  rejects) + raw workflow output `big_project/recommended_texts_workflow_result.json`.

**UI WIRED + LIVE ON LOCAL BUILD (same session, user-requested):** the planner now renders the recommendations.
- `vysti-builder/app.py`: loads `assignment-primary-focus-recommended.csv` into `DB["primary-focus-recommended"]`;
  `build_event` emits `recommended_readings` (factual fields only, `synopsis:""`, `download:None`, `purchase:None`,
  `recommended:True`, `source_canon`); statuses mapped to the frontend convention (`_REC_CR_MAP`: public-domain→
  public_domain, in-copyright→in_copyright, uncertain→unknown).
- `vysti-builder/static/planner-cards.html`: a new **"Other recommendations"** sub-section renders INSIDE the
  Primary Focus section (so selections count toward Primary Focus + reuse keyword→Lexis auto-select). Cards get a
  dashed-border `rec` treatment + **"Suggested"** tag + **"Listed on: <canons>"** line; the detail drawer shows a
  *"Vysti hasn't authored an academic descriptor for this suggestion"* note INSTEAD of a synopsis. `cflag()` gains a
  neutral **"Check edition"** badge for the 4 `unknown`/uncertain rows. CSS: `.card.rec`, `.rectag`, `.recsrc`, `.subnote`.
- **Verified live** (Docker `vysti-builder:8200`, restarted to load the new CSV — `--reload` missed it, a known
  macOS bind-mount mtime quirk): `/api/event/<ev>` returns 11±1 recs/Event (284 total, 0 carry a synopsis); the
  two formerly-empty Events now show 11 each; add-to-plan on a rec adds it + auto-selects matching Lexis (0→6).
  Screenshot `scratchpad/recommended-section.png`.
- **Buy/affiliate:** cards/drawer already render a **Buy** pill when `purchase` is set; recommendations leave it
  null for now (Find-online only) pending the **Amazon affiliate** work — see §3 "Amazon affiliate links" + the
  `TODO(affiliate)` in `app.py`.

**Files touched (all sandbox/untracked/gitignored):** `big_project/assignment-primary-focus-recommended.csv`
(new), `big_project/recommended_texts_workflow_result.json` (new), `vysti-builder/RECOMMENDED_TEXTS_REVIEW.md`
(new), `vysti-builder/app.py`, `vysti-builder/static/planner-cards.html`. **Tracked + committed locally:** this ledger.
**Next agent MUST know:** recommendations are a **separate, no-synopsis** layer by design — do NOT backfill
AI synopses or merge them into `assignment-primary-focus.csv`. Remaining product step is the **Amazon affiliate
purchase links** (§3).

### 2026-06-30 — Build: cross-library dedup of the recommendations canon (Claude)
Follow-up to the entry above (user spotted *Medea* recommended under aswl1_e1 while it's curated under
aswl1_e2). **Sandbox/`big_project/` only**; live app untouched.
- **Removed 77 recommendations that duplicate a CURATED Primary Focus text** (in ANY Event): a first pass
  on exact (normalized title + author-lastname) caught **70**; a second pass on **title-variants** (same
  author, significant-token containment) caught **7** more the exact match missed (*Hamlet* = curated "The
  Tragedy of Hamlet…"; *The Tragical History of Doctor Faustus* = "Doctor Faustus"; *Frankenstein; or, The
  Modern Prometheus* ×2 = "Frankenstein"; *Moby-Dick; or, The Whale* = "Moby-Dick"; *Narrative of the Life of
  Frederick Douglass…* ×2). The rule a future agent should keep: **a recommendation must never duplicate a
  text already in the hand-curated `assignment-primary-focus.csv` (any Event)** — the curated card (with its
  PhD synopsis) is the canonical one.
- **Backfilled the 9 Events** that fell below 8 after the first removal — a 2nd 18-agent Workflow
  (`scratchpad/pf_backfill.workflow.js`) where each discover agent excluded the **whole 200-title curated
  library + the surviving recs**, verifier flagged near-dupes; merge re-applied the dedup as a safety net
  (caught 18 more proposed dupes). Net **+35**.
- **Final: 242 recommendations across all 26 Events, range 7–11** (only aswl2_e4 at 7), **0 residual
  duplicates** vs the curated library (exact or title-variant), 0 within-Event dupes. Verified live in the
  local Docker Build. Backup `big_project/assignment-primary-focus-recommended.csv.bak_xdedup`.
- **FYI (left as-is, not a defect):** 30 texts are recommended in MORE THAN ONE Event (a text can fit several
  units, e.g. *The Souls of Black Folk* fits 4). That's cross-Event *recommendation* overlap, NOT curated-
  library duplication. Flagged to the user; only act if they want each text to recommend in a single Event.

### 2026-06-29 — Cleanup-Agent ledger pass + Builder catalog polish (Claude)
A backlog-clearing pass while the Primary Focus agent held `app.py`/`planner-cards.html`/
`assignment-primary-focus.csv` — so I deliberately stayed in **isolated files only**. LIVE app
(`vysti_api.py`/`marker.py`/`student-react/`/root lexicon) NOT touched.

**Audited all non-lexicon Builder data → confirmed CLEAN** (`big_project/*` + `seed/*`): the
`performances.feats` list-reprs are the intended JSON; `fr_excerpts` "dup sentences" are poetic
refrains; `etymology-review.csv` is an unused orphan; the 54 `extensions.explanation` "unbalanced
quotes" are in a field `build_event` never surfaces. Logged the one genuine blemish (truncated
`extensions.action`, asel1_e2 Locke) to §3.

**Ledger accuracy pass** (committed+pushed `42c777c`, docs-only): corrected stale §1 ("3 LIVE diffs
await approval" → they're DEPLOYED) + added the "clean lexicon data" milestone; corrected the §3
DATA-LOSS item (the private `build-backup`→`vysti-build-data` remote EXISTS and the branch is pushed;
remaining = refresh the 6/28 snapshot once Build settles).

**Builder catalog polish (`vysti-builder/static/index.html`, §3 item → DONE):** equal-height cards,
clamped descriptors, hover **Open ›**, per-collection **count pills**, and a **client-side live
filter** (title/descriptor/course). Pure static file — verified in local Docker (26 events, counts
7/7/7/5, filter "myth"→1, no-match message, clear→26). Untracked/sandbox; nothing deployed.

**Files (sandbox/untracked):** `vysti-builder/static/index.html`. **Tracked+committed:** this ledger.
**Next agent:** the off-machine Builder backup is still the 6/28 state — refresh `build-sandbox-backup`
+ `git push build-backup` once this Build session settles (confirm the remote is private first).

### 2026-06-29 — Build: Safari export fix, branding→Vysti Build, Request-addition, "Create your own Event" Step 1 (Claude)
All Build sandbox (untracked/local); live Marker app NOT touched. Container restarted after each app.py change.

- **Export PDF blank — root-caused + fixed.** Was `window.open("")`+`document.write`/blob (Chrome printed blank;
  Safari worse). Now: planner POSTs the built HTML to `POST /api/plan/{token}`, opens it SYNCHRONOUSLY (Safari
  severs popups navigated after `await`) at a real URL `GET /plan/{token}` (server-waits ~6s for the POST, single
  clean load, no meta-refresh). Print page is **system-font (no web fonts — Safari prints web-font text invisible),
  pure-CSS Student/Teacher toggle (no JS), no `hidden` attr**. Verified in Chromium + WebKit (Playwright; WebKit
  can't `page.pdf()`, so Safari's actual PDF is unverifiable in tooling — **user: Chrome works; Safari still blanked**,
  likely a Safari-print quirk we can't repro; server-side PDF is the guaranteed cross-browser fallback if needed).
- **Branding: "Vysti Builder" → "Vysti Build"** everywhere user-facing (index/faq/planner titles+footer, app.py
  title, docs). Infra names (dir `vysti-builder/`, docker service/container) left as-is.
- **Lexis pill checkmark** corner-gap fixed (rounded the toggle's right edge + `align-items:stretch`).
- **"Request addition" for missing Lexis terms** (optional note): drawer button on the not-in-lexicon view →
  `POST /api/request-term` → appends `seed/term_requests.csv` (term·note·event·date) + bumps the missing tracker;
  `GET /api/term-requests` is the review queue. Model: teachers REQUEST, Vysti fulfils with curated in-house entries.
- **AUTHOR-YOUR-OWN-EVENT — design agreed + Step 1 built.** Model: an authored Event = the SAME skeleton as a
  pre-made one. Teachers **author** readings/KQ/performances/extensions (+ "Import from another Event" to remix) and
  **select** Lexis + Continual Goals from the curated pools (+ Request-addition for gaps). **No AI in the product**
  (Vysti = deterministic Mark/Revise + curated Build); AI only INTERNAL to author the canon, human-reviewed before
  ship (user-confirmed). **Step 1 DONE:** `/create` (`static/create.html`) = name + descriptor (guidance + example +
  validation); drafts persisted to `localStorage` via `static/myevents.js` (`VBMyEvents`, key `vb_my_events`; shape
  mirrors the event payload). Catalog (`index.html`) lists drafts under "Your Events" + real create card; cards →
  `/create?id=` (edit). Routes `/create` added in `app.py`. Verified end-to-end (create/validate/list/edit, no dup).
  **NEXT: Step 2/3 — the authoring canvas** (empty section editor: +Add forms, Import-from-Event, Lexis/Goals select,
  export), then decide reuse `planner-cards.html` (same skeleton) vs a dedicated canvas. Drafts are localStorage-only
  → real save/share needs accounts (productionization).

### 2026-06-30 — Build: save/reopen Event Plans ("Your Plans") (Claude)
User request: let teachers **save the selections** they made on a pre-made Event, return later, then
export/modify. Built entirely in `vysti-builder/static/planner-cards.html` (sandbox, untracked, NOT
deployed; LIVE app untouched). No backend → **localStorage only** (right for the prototype, which has
no auth); also avoided `app.py`.

- **Model:** `localStorage["vbc_plans"] = { [id]: {id,name,event,eventTitle,collection,savedAt,sel,imp} }`
  — a named snapshot of the existing per-event `sel`+`imp` working state.
- **UI:** a **"Save plan" / "Update plan"** button in the Class-Plan rail actions, and a collapsible
  **"Your Plans"** panel in the left rail under *Find by Lexis* — lists every saved plan (name · event ·
  item count), newest first, current one marked "· editing", each with an open link + × delete.
- **Reopen:** plan rows link to `/event?id=<event>&plan=<id>`; `boot()` loads that plan's snapshot into
  the event's working keys, so the planner shows it and **Export plan** works as usual. Editing + **Update
  plan** overwrites that plan; **Save plan** with no `?plan` prompts for a name and creates a new one.
- Verified in local Docker: save→list→reopen restores the saved snapshot (not a dirtied draft),
  update-in-place (no dup), delete, collapse, multi-plan + cross-event list. Syntax-checked.

**⚠ Disambiguation for other agents:** this is **distinct** from the catalog's **"Your Events"**
(another agent's feature — teacher-*authored* NEW events via `VBMyEvents`/`/create`/`/myevent`). Mine
saves **selection-plans on pre-made Events** ("Your Plans", in the planner rail). Different concept,
different storage key (`vbc_plans` vs `VBMyEvents`), different place. I did **not** touch `index.html`
(now co-owned by the authored-events work) or `app.py`.
**Coordination:** `planner-cards.html` is co-edited — my additions are localized (rail CSS near
`.lexsearch`; the actions + new panel in the `<aside class="rail">`; a `saved plans` JS block before
`boot()`; `CURRENTPLAN` by the sel model; `?plan` load in `boot()`). Diff before large edits.
**Productionization:** plans are per-browser localStorage — real cross-device save/share needs the
account/auth work (same dependency as the authored-events drafts).

### 2026-06-30 — Build: Author-your-own-Event Step 2 — the authoring canvas (Claude)
Build sandbox (untracked); live Marker app NOT touched. Container restarted (app.py changed).
- **New canvas** `static/myevent.html` (route `/myevent?id=`): reads the localStorage draft (`VBMyEvents`),
  renders hero (name/descriptor + "Edit" → `/create?id=`) + all **7 section panels** + sticky summary/Export bar +
  a right **drawer** for forms/pickers. DEDICATED page (planner-cards.html untouched), reuses the Vysti palette.
- **Two section patterns fully wired + persisted:** (1) **Key Questions** = *author-your-own* — `+ Add` → drawer form
  (question + optional model answer) → card w/ Edit/Delete; (2) **Continual Goals** = *select-from-curated-pool* —
  drawer picker over the catalogue via new `GET /api/continual-goals` (`CG_CATALOG`), tick to add/remove → chips.
  Other 5 sections show their panel with a "coming next" `+ Add`. Export button stubbed until sections are wired.
- **Flow repointed:** `/create` now lands on `/myevent?id=` after save; catalog "Your Events" cards → `/myevent?id=`.
  Routes `/create` + `/myevent` + `/api/continual-goals` added in `app.py`.
- **Verified e2e (Chromium):** create→canvas, 7 panels, author a question (count updates), select goals (chips),
  summary, and **persistence across reload**.
- **NEXT — Step 3+:** wire remaining sections via the two patterns: **author** = Primary/Further readings
  (title·author·dates·category·synopsis·keywords; copyright auto), Performances (title·overview·task·`x`-feats),
  Extensions (command·action·linked-lexis); **select/import** = Lexis (reuse lexicon search + Request-addition) and
  "Import from another Event" per section. Then wire **Export** (adapt the planner's `buildPlanHtml` to read the draft).

### 2026-06-30 — Build: Lexis-driven DISCOVERY ("Build from a concept") + canvas renders all section types (Claude)
Build sandbox (untracked); live Marker app NOT touched. Container restarted (app.py changed). User insight: Lexis is
the index into the canon — most teachers author something we already have material for, so authoring starts from a concept.
- **New endpoint `GET /api/discover/{term}`** (app.py): given a concept, returns everything connected to it across the
  canon — related **lexis** (term + linked_lexis family), **key questions** (text match), **extensions** (linked_lexis
  tag OR text), **readings** (keyword tag, primary+further, deduped), **performances** (text). **Matching is EXACT-term
  only** (concept-expansion via linked_lexis was too broad — feminism pulled in Enlightenment/philosophy → noise); the
  `linked_lexis` family is returned as one-click **pivot chips** + related-lexis to add. Each hit carries `via` + source
  event. (`EVENT_TITLE` map added.)
- **Canvas `myevent.html`:** added a prominent **"Build from a concept"** search (lexicon autocomplete via `/api/lexicon`)
  → drawer shows grouped results (Key Questions / Readings / Extensions / Performances / Related Lexis) each with **+ Add**
  (dedup → "✓ Added"), plus related-concept pivot chips. Import maps each type into the draft's section shape; **all 7
  sections now RENDER their items** (readings/extensions/performances as cards, lexis/goals as chips, questions as before),
  with Remove. Per-section "+Add": questions=form, goals=picker, lexis=focus the concept search, others=note ("manual form
  next"). Manual authoring forms for readings/performances/extensions still pending.
- **Verified e2e (Chromium):** feminism → KQ 1 / Readings 16 (A Doll's House, A Vindication…, A Room of One's Own) /
  Extensions 1 / Lexis 9 + family chips; +Add imports into the right section, persists across reload, re-search shows
  "✓ Added". tragedy → 20 readings / 5 KQ / 6 ext (feature shines where the canon is tagged).
- **DATA REALITY (drives the tagging pass — approved, parallel):** readings are richly keyword-tagged so discovery is
  strong; **key-questions have NO lexis link** and extensions' linked_lexis is sparse → thin for some concepts until the
  in-house pass tags KQs/Extensions/Performances to lexis (AI-assisted draft → human review, internal only). That pass is
  the foundation that makes discovery comprehensive.
- **NEXT:** (a) run/scope the tagging pass; (b) manual authoring forms for readings/performances/extensions; (c) wire
  **Export** for authored events (adapt the planner's Student/Teacher `buildPlanHtml` to read the draft).

### 2026-06-30 — Build: Continual Goals show full category names in Export (Claude)
Small branding fix (user request): the exported plan's Continual Goals listed goals by acronym only
(CT 1, IK 1…). Now grouped under their **full category name** header so the codes are self-explanatory
— e.g. a **Critical Thinking** header (with a small `CT` pill) over the CT-coded goals, then
**Interdisciplinary Knowledge** (IK), **Reading and Writing** (RW), **Speech and Citizenship** (SC).
Built client-side in `buildPlanHtml`/`planSections` (`vysti-builder/static/planner-cards.html`) by
mapping each selected goal's `id` → its category `{code,label}` from `DATA.continual_goals`; preserves
category order, keeps per-goal codes + subgoals. New `.goalcat`/`.goalcode` styles. No `app.py`, no
live touch; sandbox/untracked. Verified in local Docker (CT + IK headers render in the export).

### 2026-06-30 — Build: Further-Exploration POETRY recommendations (Claude)
Extended the "Other recommendations" model from Primary Focus to **Further Exploration**, poetry first
(user request; the *Bleeding* gap). **Sandbox/`big_project/` + `vysti-builder/` only; live app untouched.**
- **New file `big_project/assignment-further-exploration-recommended.csv`** — **34 recommended poems**.
  Same separate, **no-synopsis** model: factual fields + `keywords` from each Event's Lexis vocab, statuses
  precomputed; pointers only (Find-online, never hosted). Columns: `minor_reading_id,event,title,
  author_full_name,author_last_name,reading_category(=Poetry),keywords,pub_year,author_death_year,
  copyright_status,source,fit_note,active`.
- **Two tracks, one 14-agent discover→verify Workflow** (`scratchpad/fe_poetry.workflow.js`):
  (A) **Thin-Event top-up** — FE was already poetry-rich (564 FE rows, 334 poems); only Events with **<5 FE
  poems** were topped up (~5 each): `aswl1_e7, aswl2_e6, aswl2_e3, asal1_e2, asal1_e4, asel1_e2`. Picks are
  strongly period-matched (Wheatley/Freneau→Revolution; Pope/Dryden/Byron→satire; Li Bai/Tagore/Soyinka/
  Walcott→World Voices; Owen/Lazarus/Kipling→rhetoric).
  (B) **Apparatus-gap track** — poems our **Performances reference but we don't stock**. All 8 such refs are in
  `aswl1_e1`'s dialectical-comparison Performance (Swenson *Bleeding*, Blake *Ah! Sun-flower/The Lamb/The Tyger*,
  Ginsberg *Sunflower Sutra*, Tennyson *Ulysses*, Glück *Vespers/Celestial Music*). Global-curated dedup left
  only the **2 genuine gaps**: *Bleeding* (Swenson, in-copyright) + *Ah! Sun-flower* (Blake, PD). The other 6 are
  already in the library (e.g. Tennyson's *Ulysses* is curated FE in aswl1_e1 — correctly matched by lastname,
  NOT confused with Joyce's *Ulysses* novel).
- **Verify/merge:** 0 rejected, 0 flagged (all high-confidence); **13 skipped because already curated**
  (global FE+PF dedup, per the confirmed rule — a recommendation never duplicates a curated text). Cross-Event
  *recommendation* overlap left intact (user: overlap is fine; e.g. Dunbar *We Wear the Mask* in asal1_e4 +
  aswl1_e7). Per-event: aswl1_e1=2, aswl1_e7=4, aswl2_e3=4, asal1_e2=6, asal1_e4=6, asel1_e2=6, aswl2_e6=6.
- **Builder WIRED + verified live** (Docker `:8200`, restarted to load CSV): `app.py` loads
  `DB["further-recommended"]` and `build_event` emits `recommended_further`; `planner-cards.html` renders an
  **"Other recommendations"** sub-section UNDER Further Exploration (sec="further", same `rec` card treatment,
  no excerpt, Find-online). Confirmed *Bleeding* card + drawer ("© In Copyright", no descriptor).
  Screenshot `scratchpad/fe-recommendations.png`.
- **NEXT for FE recs (deferred):** only **poetry** done this pass (user: "start with poetry"). Other FE genres
  (essays/speeches/short stories) for thin Events could follow the same process later. Same Amazon-affiliate
  note applies if/when FE recs get a Buy path (§3).

**Files (all sandbox/untracked/gitignored):** `big_project/assignment-further-exploration-recommended.csv`
(new), `big_project/fe_poetry_workflow_result.json` (new), `vysti-builder/app.py`,
`vysti-builder/static/planner-cards.html`. **Tracked + committed locally:** this ledger.

### 2026-06-30 — Build: in-house concept-tagging pass (KQ/Extensions/Performances → Lexis) + wired into discovery (Claude)
Build sandbox (untracked); live Marker app NOT touched. The foundation that makes lexis-driven discovery comprehensive.
- **Tagged all 773 items** (270 key-questions, 349 extensions, 154 performances) with terms from the curated Lexicon
  used as a CONTROLLED VOCABULARY (1508 terms). Ran a 27-agent **Workflow** (`lexis-tagging-pass`, model=sonnet,
  ~822k subagent tokens, ~4.5 min): each agent read the vocab + a 30-item batch, assigned 1–5 conceptual tags, wrote a
  JSON batch file. Pilot-validated first. **Every tag deterministically validated against the lexicon** (merge.py drops
  any non-term) → only **4 invalid of ~3,064** dropped; 100% of items got ≥1 valid tag.
- **Tag seeds (gitignored, Build-local):** `vysti-builder/seed/tags_key_questions.csv`, `tags_extensions.csv`,
  `tags_performances.csv` — each `id,terms` (terms = `;`-joined term_norms). Loaded at startup (`TAGS_KQ/EXT/PERF`).
- **Discovery now conceptual:** `/api/discover` matches an item if its tag set contains the searched concept's
  term_norm (UNION with the existing keyword/linked_lexis/text match). Big lift for well-covered concepts:
  KQ modernism 6→21, identity 2→13, mimesis 1→14, colonialism 3→10. feminism KQs stay 1 (the curriculum's KQs are
  genuinely not feminism-focused — that teaching is in readings), but feminism now also yields ext 1→6, perf 0→2.
- **Honest caveat / remaining "review":** tags are an AI-drafted layer, deterministically valid (real lexicon terms)
  and pilot-checked, but NOT exhaustively human-reviewed for relevance — they live in editable seed CSVs; a human
  spot-review/curation pass is the final step per the agreed model. Re-run: scratchpad `tagpass/` (batches, vocab,
  merge.py); workflow script saved under the session's workflows/scripts.
- **NEXT:** (a) optional human spot-review of tags; (b) manual authoring forms for readings/performances/extensions;
  (c) wire **Export** for authored events.

### 2026-06-30 — Build: move "Your Plans" to the Build home page (Claude)
User: surface saved selection-plans on the main page (next to "Your Events") to save clicks.
Sandbox only (`vysti-builder/static/`), localStorage, no `app.py`, no live touch.
- **`index.html` (catalog):** new **"Your Plans"** section (reads `localStorage["vbc_plans"]`, the same key
  the planner writes) rendered above "Your Events" when not filtering — one card per saved plan (name ·
  event · item count, "SAVED PLAN" kicker) linking to `/event?id=<event>&plan=<id>`, with a hover **×**
  delete (`delPlan`). Section is omitted when there are no saved plans. Added `.cardx` styles.
  **Kept distinct from the other agent's "Your Events"** (authored events / `VBMyEvents`) — separate
  function (`yourPlansHtml`), separate storage key, only touched their `render()` injection line.
- **`planner-cards.html`:** **removed** the "Your Plans" rail panel (+ its toggle wiring) — the list
  now lives on the home page. **Kept** the **Save plan / Update plan** button and the save/restore logic
  (`savePlan`, `?plan=` load in `boot()`). `renderPlans()` remains a guarded no-op (harmless; could be
  pruned later along with the now-unused `.planrow` CSS).
- Verified in local Docker: save in planner → card appears on home → click reopens & restores the
  snapshot (button reads "Update plan") → delete from home removes it; "Your Events" unaffected.
**Both files are co-edited — diff before large edits.**

### 2026-06-30 — Build: Further-Exploration ESSAY recommendations + quality review (Claude)
Extended the FE "Other recommendations" layer to **essays/non-fiction** (after the poetry pass). Same
separate, no-synopsis, Find-online model. **Sandbox only; live app untouched.**
- **+30 essays appended** to `big_project/assignment-further-exploration-recommended.csv` (now **64 rows**:
  34 Poetry + 30 non-fiction = Essay 17 / Treatise 8 / Speech 3 / Manifesto 1 / Non-Fiction 1; 60 PD / 4 in-copyright).
- **Scope:** the 5 World-Lit-I Events with <4 FE essays (essays were concentrated in aswl1_e7 Rhetoric): aswl1_e2
  (Drama), e3 (Reformation), e4 (19thC Prose), e5 (Modernism), e6 (Harlem Renaissance) — +6 each. 10-agent
  discover→verify Workflow (`scratchpad/fe_essays.workflow.js`). 0 rejected, 0 flagged, 2 skipped as already curated.
- **Picks are the canonical scholarly set:** Aristotle *Poetics* / Dryden / Johnson *Preface to Shakespeare* /
  Sidney / Bradley / Miller *Tragedy and the Common Man* (the only in-copyright one, correctly flagged) for Drama;
  Luther *95 Theses* / Milton *Areopagitica* / Tyndale / Edwards for the Reformation; Eliot *Tradition and the
  Individual Talent* / Woolf / Marinetti *Futurist Manifesto* / Keynes / Veblen for Modernism; Du Bois / Hughes /
  Hurston / Locke / Booker T. Washington for the Harlem Renaissance.
- No code changes — the Builder already renders `recommended_further` (poems + essays share one "Other
  recommendations" sub-section under Further Exploration). Verified live in Docker (`aswl1_e6` shows the 6 essays).
  Provenance `big_project/fe_essays_workflow_result.json`.

**QUALITY REVIEW (asked by user, 2026-06-30):** verdict = quality is high. Per-Event balance is now strong
(every PF Event offers 9–33 works curated+recommended; previously-starved Events filled); recommendations are
adversarially verified (real errors were caught). **One substantive gap flagged for a future pass:**
**contemporary & global/diverse voices** — a bellwether scan finds *Neruda, Adichie, Coetzee, Ishiguro,
Murakami, Kincaid, Lorde* absent from the ENTIRE library (PF+FE, curated+recommended). They're in-copyright
(why the finite physical library skipped them) and ideal for the point-don't-host model. Most relevant Events:
aswl2_e6 (Voices of the World), aswl2_e7 (Postmodernism), asal1_e7 (WWII→today). Also worth: extend the
apparatus-gap mining from poems to **prose** references (Performances also cite e.g. Hemingway's *Men Without
Women*, Ovid's *Metamorphoses*). Neither blocks anything; recommended as the next recommendation pass.

**Files (sandbox/untracked/gitignored):** `big_project/assignment-further-exploration-recommended.csv` (now incl.
essays), `big_project/fe_essays_workflow_result.json` (new). **Tracked + committed locally:** this ledger.

### 2026-06-30 — Build: "Your Plans" restored to the planner rail (now in BOTH places) (Claude)
Per user, re-added the **"Your Plans"** collapsible panel to the planner left rail (under *Find by
Lexis*) — it had been moved home-only in the prior entry. Now saved plans show in **both** the rail
(quick switching while building) and the Build home page. Just re-added the panel HTML + toggle wiring
in `vysti-builder/static/planner-cards.html`; `renderPlans()`/`deletePlan()` and the `.planrow` CSS
were still present, so they're live again (no longer the "dead code" the prior entry flagged). Both
surfaces read the same `localStorage["vbc_plans"]`. Verified in local Docker (rail panel renders saved
plans + collapses; home page unchanged). Sandbox/untracked, no live touch.

### 2026-06-30 — Build: Performance Feat Generator (deterministic assignment builder) in the canvas (Claude)
Build sandbox (untracked); live Marker app NOT touched. Container restarted (app.py changed). Uses the purpose-built
`big_project/assignment-{category,type,audience}.csv` data + the "Performance Feat Generator Diagram.png" flow.
(NOTE: `big_project/teacher_mode/` is the LIVE Marker app's teacher React code — unrelated to this generator.)
- **Backend `GET /api/assignment-options`** (app.py): serves the curated dropdowns — 9 categories (each w/ default_verb
  + 127 types grouped under them, each type carrying its teaching `description` + `requires_topic`/`allows_audience`
  flags) + 20 audiences. Loaded from the 3 CSVs at startup.
- **Canvas (`myevent.html`):** Performances "+ Add a performance" → `openFeatGen()` — a single-panel, live-preview,
  **deterministic, no-AI** builder: Category (sets verb) → Type (+ description helper) → Topic → Audience. Topic modes:
  free text, single term, or the diagram's relationship templates ("the relationship between A and B", "the importance
  of A for B", "the use of A in B", "the influence of A on B") where **A/B dropdowns are populated from the event's own
  added Lexis + readings** (the payoff of discovery/tagging). Conditional fields honor the flags (audience hidden when
  not allowed; topic hidden when not required). Live-assembled sentence; Add stores a performance item
  `{title:sentence, feats:[sentence], gen:{category,type,topic,audience}}`.
- **Verified e2e (Chromium):** built "Compose a comparison and contrast essay on the relationship between tragedy and
  Romeo and Juliet for an audience of your peers" from curated dropdowns + event content; live preview, conditional
  audience row, Add, and persistence across reload all work.
- **NEXT:** (a) use case #2 done (canvas); **use case #1** = surface the SAME generator in the curated planner's
  performance builder (add a feat to a pre-made Performance); (b) v2 enrichments per diagram steps 4–6 — Lesson-Goal
  ties (to a Lexis term / Key Question), Continual-Goal ties, and Review (due date + notes); (c) wire Export.

### 2026-06-30 — Build: contemporary/world POETRY pass (IB Paper 1 corpus) (Claude)
User asked to extend poetry beyond the classical canon toward **world & contemporary voices** (IB/AP common
choices), pointing to `~/Desktop/Further Exploration Possibilities/Paper 1/`. **Sandbox only; live app untouched.**
- **Folder reality:** 60 individual poem PDFs (`Poetry <Title>.pdf`) + ~19 full IB past-exam papers labeled by
  literary MODE (`romanticism.pdf`, `postmodern.pdf`, `realism.pdf`, …) + Norton/Oxford anthologies. The user's
  "organized by topic" = those movement filenames (the per-file Finder tags decode EMPTY / no color labels, so
  the grouping isn't on the filesystem). **Scans have no text layer — `pdftotext` is empty — but the Read tool
  OCRs them cleanly** (title, poet, year, full text + attribution line). That unblocked ingestion.
- **+55 IB poems appended** to `assignment-further-exploration-recommended.csv` (now **119 rows**: 89 Poetry +
  30 non-fiction; 60 PD / 58 in-copyright / 1 uncertain — the in-copyright share rose ON PURPOSE: contemporary
  voices, Find-online/never-hosted). 34-agent Workflow (`scratchpad/ib_poetry.workflow.js`): batch agents OCR-read
  the 60 PDFs, identify poet/year, map each to the best-fit of 10 modern/global Events, then adversarial verify.
  **4 rejected** (good catches: *Aubade for the Patient…*/Paré + *Call* — couldn't confirm the poem EXISTS;
  *The Bat*/Pitter + *Watching for Dolphins*/Constantine — year/fit). Year corrections applied (Hayden *Astronauts*
  1985→1978 +death 1980; Berry *A Music*→1994; Grennan→1989). 1 dedup-skip.
- **Distribution:** aswl2_e6 (Voices of the World) +21 → 27 total, aswl2_e7 (Postmodernism) +16, asal1_e6 +11,
  asel1_e5 +4, aswl1_e5 +2, aswl2_e5 +1. The aswl2_e6 concentration is **theme-justified** (genuinely world poets:
  Dharker/Pakistan, Morris/Jamaica, Baxter+Kemp/NZ, Chua/Singapore, Szirtes/Hungary, Hope/Australia, Nye/
  Palestinian-American, Montague/Ireland, Dewdney/Canada), not a catch-all dump. Verified live in Docker.
- **DEFERRED (session limit hit mid-run — resets):** the **broader named-canon phase** (Neruda, Walcott,
  Szymborska, Darwish, Heaney, Tracy K. Smith, Ocean Vuong, Komunyakaa, Rita Dove…) — 6/10 Event-agents returned
  but that phase had **no verify stage**, and 4 failed on the limit, so NONE were merged. To finish: re-run the
  `BroaderCanon` phase + a verify pass, then merge (`scratchpad/merge_ib.py` already accepts a
  `wf_ib_broader_verdicts.json`). Backup `assignment-further-exploration-recommended.csv.bak_preib`.
- **Also available in that folder (not yet used):** the exam-paper PROSE passages are strong world-voice FICTION
  (Gurnah [Nobel], Forna, Viet Thanh Nguyen, Vassanji, Hamid, Tan Twan Eng, Ruth Ozeki) — candidate FE prose /
  Primary-Focus recommendations in a later pass.

**Files (sandbox/untracked/gitignored):** `big_project/assignment-further-exploration-recommended.csv` (now incl.
IB poems), `big_project/ib_poetry_workflow_result.json` (new). **Tracked + committed locally:** this ledger.

### 2026-06-30 — Build: Feat-generator refinements (4 testing-driven tweaks) (Claude)
Build sandbox; live Marker app NOT touched. Container restarted (data + app.py loads).
- **#1 Expandable descriptor** (`myevent.html`): reading cards clamp the synopsis to 2 lines with a "Read more ▾ / Show
  less ▴" toggle (`toggleSyn`, `.rsyn.open`) when long.
- **#2 Word count in the Feat generator** (optional field): inserts "<count> word" after the type's article, and
  **deterministically corrects a/an** to agree with the count's leading number (`_firstNumWord`/`_articleFor`): e.g.
  "an analytic essay" + 800 → "Compose **an 800** word analytic essay…"; + 750 → "**a 750** word…". Verified across
  750-1000/500/800/8000/18/11/80/1000.
- **#3 Branding = "Feat"** (generator titled "Build a Feat", "Add Feat"; section add button "Build a Feat"; copy notes
  Performance = the assignment, Feats = its accomplishments) + **broader Topic sources**: A/B dropdowns now offer
  optgroups for the event's added **Lexis / Readings / Key Questions / Extensions** (`topicOptions()`), not just lexis+reading.
- **#4 New "academic" audience** added to `big_project/assignment-audience.csv` (curated data). NOTE: original file had no
  trailing newline → first append merged the row; repaired (21 clean rows; extraterrestrial notes restored). `/api/assignment-options` serves it.
- Verified e2e (Chromium): all four.
- **STILL OPEN (structural, per user's language):** a Performance should CONTAIN Feats; currently each generated Feat is a
  flat item under the Performances section. Next: group Feats under named Performances. Plus earlier-noted: use-case #1
  (generator in the curated planner), v2 lesson-goal/continual-goal ties + due date/notes, and Export.

### 2026-06-30 — Build: Performance → contains → Feats structure in the canvas (Claude)
Build sandbox; live app untouched. Honors the branding model: a Performance is the assignment; its Feats are the
accomplishments. (`myevent.html` only — static.)
- **Data model:** `DRAFT.performances = [{id, title, overview, feats:[{id, text, gen{category,type,topic,audience,wc}}], from?}]`.
  `normalizePerfs()` migrates older/imported shapes (string feats → `{id,text}`) on load.
- **UX:** Performances section "+ Add a Performance" → title + optional framing form (`openPerfForm`/`savePerf`). Each
  Performance card renders its title, framing, and its **Feats** (tinted rows, per-feat ×), with **+ Build a Feat** (opens
  the generator targeting that performance via `CURRENT_PERF`), **Edit**, **Remove performance**. `featAdd` pushes into the
  current performance's `feats`; `delFeat`/`delPerf` added.
- **Discovery import** of a curated performance now nests its feats as `{id,text}` under one Performance.
- **Verified e2e (Chromium):** add Performance → build 2–3 Feats inside it (verbs Compose/Create/Craft render right) →
  1 performance / N feats, persists across reload, per-feat + per-performance delete work.
- **NEXT:** use-case #1 (generator in the curated planner), v2 lesson-goal/continual-goal ties + due date/notes per the
  diagram, and **Export** for authored events (Student/Teacher guides from the draft, incl. these Performances/Feats).

### 2026-06-30 — Build: broader-canon poetry + world-voice prose (closing the contemporary/global gap) (Claude)
Two follow-ups to the IB-poetry pass; both **sandbox only, live app untouched.**
- **#1 Broader named-canon POETRY → FE-recommended (+45).** Per the 10 modern/global Events, 5 named
  contemporary/world poems each, discover→**adversarial verify** (the IB-ingest's broader phase had skipped verify
  + partially failed). Workflow `scratchpad/broader_poetry.workflow.js`; hit transient SERVER rate-limiting on 7/10
  Events, recovered via **`resumeFromRunId`** (cached the 3 done, re-ran 7). Added: Neruda, Darwish, Szymborska,
  Tranströmer, Rilke, Lorca, Akhmatova, Tsvetaeva, Miłosz, Soyinka, Heaney, Brecht, Senghor, Césaire, Tracy K.
  Smith, Rita Dove, Komunyakaa, Trethewey, Claudia Rankine, Forché, Espada, Levine, Ginsberg, Sandburg, McKay,
  Hughes — **translators cited**. 2 conservative rejects (Polish Szymborska misfiled to an American Event; a Neruda
  ode that didn't fit Romanticism). **FE-recommended now 164 rows / 19 Events** (134 Poetry + 30 non-fiction;
  66 PD / 97 in-copyright / 1 uncertain — the in-copyright majority is the point: contemporary/world reach).
- **#2 World-voice PROSE → Primary-Focus-recommended (+11).** 4 Events (Voices of the World, Postmodernism, WWII→
  today, Age of Anxiety), seeded from the IB Paper 1 prose corpus (`~/Desktop/Further Exploration Possibilities/
  Paper 1/`, 49 authors) + a named gap-list + web. Workflow `scratchpad/world_prose.workflow.js`; discover→verify,
  0 rejected, 13 skipped (cross-Event dups kept once + already-curated *Things Fall Apart* / *One Hundred Years of
  Solitude*). Added: Adichie (*Half of a Yellow Sun*, *Americanah*), Gurnah (*By the Sea*), Tan Twan Eng, Coetzee
  (*Waiting for the Barbarians*), Rushdie (*Midnight's Children*), Ozeki, Barnes, Hamid, Lahiri (*The Namesake*),
  Morrison (*Home*). **PF-recommended now 253 rows** (188 PD / 62 in-copyright / 3 uncertain).
- **Gap status:** the contemporary/global hole I flagged is largely closed — **28/32 bellwether authors now present**
  library-wide. **STILL MISSING (agents didn't pick within the per-Event cap): Kazuo Ishiguro, Haruki Murakami,
  Jamaica Kincaid, Audre Lorde.** A quick targeted top-up would finish it (Ishiguro/Murakami→aswl2_e7; Kincaid→
  aswl2_e6; Lorde→aswl1_e6/asal1_e7).
- Both verified live in Docker; deduped (incl. the title-variant fuzzy match). Backups
  `assignment-{further-exploration,primary-focus}-recommended.csv.bak_pre{ib,prose}`.

**Files (sandbox/untracked/gitignored):** `big_project/assignment-{further-exploration,primary-focus}-recommended.csv`,
`big_project/{broader_poetry,world_prose}_workflow_result.json` (new). **Tracked + committed locally:** this ledger.

### 2026-06-30 — SESSION CLOSE: "Other recommendations" library — state + comments (Claude)
Consolidated summary of this session's recommendation build-out (all the 2026-06-29/30 entries above), plus
forward comments. **Everything is Builder-sandbox / `big_project/` only — the LIVE Marker app (`vysti_api.py`,
`marker.py`, `student-react/`, root `./assignment-lexis.csv`) was NOT touched and NOTHING was deployed.**

**What now exists (two new separate, NO-synopsis canons; rendered under "Other recommendations" in the Build):**
- **Primary Focus — `big_project/assignment-primary-focus-recommended.csv` = 253 rows** (188 PD / 62 in-copyright /
  3 uncertain). ~9–11 canonical text recommendations per Event for all 26 Events (AP-Lit Q3 + Pulitzer/Nobel +
  NCTE/Common-Core + college-prep), **+11 contemporary/world novels** (Adichie, Gurnah, Coetzee, Rushdie, Tan Twan
  Eng, Hamid, Ozeki, Lahiri, Morrison). 0 duplicates of the curated 200 (exact + title-variant fuzzy dedup).
- **Further Exploration — `big_project/assignment-further-exploration-recommended.csv` = 164 rows** (134 Poetry +
  17 Essay + 8 Treatise + 3 Speech + 1 Manifesto + 1 Non-Fiction; 66 PD / 97 in-copyright / 1 uncertain). Poetry
  for thin Events + the apparatus-gap poems (Swenson *Bleeding* etc.) + 55 IB Paper 1 poems + 45 broader world/
  contemporary named-canon poems; essays for the 5 essay-thin World-Lit-I Events.

**Design contract (KEEP — do not violate):** recommendations are a SEPARATE layer with **NO AI-written academic
descriptor** (the curated synopses are human-PhD-authored; the user does not trust AI to write them). Factual
metadata only + `keywords` constrained to the Event's existing **Lexis** vocab + a short INTERNAL `fit_note`.
Pointers only — **Find-online** (rot-proof Google search; no stored URLs), never hosted; copyright status is
informational (Primary Focus is never downloadable; FE recs aren't either). **Global-curated dedup**: a
recommendation must never duplicate a curated text anywhere; cross-Event *recommendation* overlap is fine.

**Build wiring (all in `vysti-builder/`, untracked):** `app.py` loads `primary-focus-recommended` +
`further-recommended`, `build_event` emits `recommended_readings` + `recommended_further`; `planner-cards.html`
renders an **"Other recommendations"** sub-section inside Primary Focus AND inside Further Exploration (dashed
`rec` card + "Suggested" tag + "Listed on:" source + Find-online; the detail drawer shows a "no descriptor"
note instead of a synopsis). Verified live in local Docker (`:8200`). **Gotcha:** after editing a recommendation
CSV, `--reload` misses it (macOS bind-mount mtime) → `docker restart vysti-builder` to reload.

**Method (reusable):** every pass was a discover→**adversarial-verify** Workflow (scripts in session scratchpad:
`pf_recommendations`, `fe_poetry`, `fe_essays`, `ib_poetry`, `broader_poetry`, `world_prose`; raw outputs saved to
`big_project/*_workflow_result.json`). Verification earned its keep — it caught a Faulkner-in-a-European-course,
a Thoreau/Paine title conflation, translation-copyright traps, two poems that don't verifiably exist, and several
wrong publication years. Transient server rate-limiting was handled with `resumeFromRunId` (cached the done agents).

**My comments / assessment:** the curation+recommendation system is in good shape and I'm satisfied with quality:
per-Event balance is strong, picks are well-fit and verified, and the architecture protects the PhD core. The
classical→contemporary/global reach the user asked for is largely achieved (**28/32 bellwether authors present**).
The cleanest next moves are the four §3 follow-ups (finish the 4 missing names; more world-voice prose; FE short-
story/drama; prose apparatus-gap) and then the **Amazon-affiliate Buy links** (the real monetization step — see the
§3 item). None of it is blocking; the Build is in a coherent, demoable state.

**Files this session (sandbox/untracked/gitignored):** the two recommendation CSVs (+ `.bak_*`),
`big_project/*_workflow_result.json`, `vysti-builder/{app.py,static/planner-cards.html}`,
`vysti-builder/RECOMMENDED_TEXTS_REVIEW.md`. **Tracked + committed locally:** this ledger (`HANDOFF_AND_CLEANUP.md`).
**Nothing pushed; nothing deployed.**

### 2026-07-01 — Build: clickable/curatable Lexis in the canvas (parity with pre-made Events) (Claude)
Build sandbox; live app untouched. `myevent.html` only (static).
- Lexis pills in Create-your-own are now **clickable** (term → `openLexDetail(id)`): opens a drawer that **re-fetches
  `/api/lexis/{term}`** and shows definition · etymology · roots + **tickable Application** rows + **tickable Exploration**
  rows + per-group **"Show on Student guide"** toggles — mirroring the pre-made planner's lexis builder
  (`splitApp`/`splitExp`/`_dedup`/`lcap` ported). Nothing auto-ticked; Application→student default ON, Exploration→
  teacher-only default OFF.
- Selection stored on the draft lexis item: `{app:[texts], exp:[texts], appStu, expStu}`. Pill shows a maroon **count
  badge** + tinted `.curated` state when curated. Feeds the eventual Student/Teacher **Export** (same convention as the
  planner). Verified e2e: 8 app / 6 exp rows for "tragedy", tick+save → badge 3, reopen reflects selections, persists.
- **NEXT (unchanged):** curated-planner Feat generator (use-case #1); v2 Feat lesson-goal/continual-goal ties + due/notes;
  and **Export** for authored events (readings, curated lexis app/exp, KQ, performances+feats, goals → Student/Teacher guides).

### 2026-07-01 — Build: "Browse the Lexicon" A-Z browser (Find by Lexis) (Claude)
User: the *Find by Lexis* box used a native `<datalist>`, whose suggestion list caps early ("only
scrolls to E"). Added a **magnifying-glass "Browse the Lexicon" button** (search icon matching
Revise/Write) under the search input that opens a full, filterable **A-Z browser** in the drawer.
- `vysti-builder/static/planner-cards.html` (sandbox/untracked; no `app.py`, no live touch):
  new `openLexiconBrowser()` / `drawLexBrowse()` / `browseTerm()`; caches `/api/lexicon` (all term
  strings) in `LEXALL`; renders a sorted list with sticky letter headers (# + A–Z) and a filter box;
  clicking a term calls `openLex()` and sets the drawer **‹ Back** to return to the browser. New
  `.lexbrowse` / `.lexbq` / `.lexbletter` / `.lexbterm` styles.
- Verified in local Docker: 1508 terms, letters # → Z (no E cap), filter works (myth→myth,
  stichomythia), drill-in opens the entry, Back returns to the list.
- Kept the existing type-a-term input + datalist as the quick path. `planner-cards.html` is co-edited
  — additions are localized (Find-by-Lexis panel button; a browser JS block before drawer plumbing; CSS
  near `.lexsearch`).

### 2026-07-01 — Build: Export (Student/Teacher guides) for authored events (Claude)
Build sandbox; live app untouched. `myevent.html` only (reuses the existing `/api/plan/{token}` + `/plan/{token}`
served-page endpoints — no backend change).
- Ported the pre-made planner's export into the canvas: `buildAuthoredPlanHtml()` + `planSectionsAuthored(teacher)`
  + `planSheetAuthored()` + `planSyn`/`planBlock`, reading the localStorage **DRAFT** instead of the planner's `sel`.
  Same designed two-guide document (system fonts, pure-CSS Student/Teacher toggle, `@page{margin:0}`), opened the
  **Safari-safe** way (sync `window.open("/plan/<token>")` → POST the HTML).
- **Split (matches pre-made events):** Student = readings+synopsis (Citations parsed), curated **Application** (per the
  lexis-curation `app`/`appStu`), **Exploration** only if promoted (`expStu`), Key Questions (NO answers),
  **Performances → their Feats**, Extensions, Continual Goals grouped by category (`GOAL_CATS` map) with sub-goals.
  Teacher = all of the above **+ KQ answers + Exploration + reading keywords**. Export button (sticky footer) now live.
- **Verified e2e (Chromium):** full authored event (discovery readings/lexis/KQ + curated lexis app/exp + a Performance
  with a Feat + a Goal) → export popup on `/plan/<token>`; Student hides KQ answers, shows Application + (promoted)
  Exploration + the Feat; Teacher shows answers; both sheets; **273 KB PDF renders** (not blank). Screenshot reviewed.
- **CORE AUTHORING LOOP COMPLETE:** create → build (discover + author + Feat generator + lexis curation) → **export**.
- **NEXT (optional):** use-case #1 (Feat generator in the curated planner); v2 Feat lesson-goal/continual-goal ties +
  due date/notes; Performance-level framing already exists. Productionization: drafts are localStorage-only (accounts).

### 2026-07-01 — Build: canvas citation formatting, Browse-the-Lexicon, + feminism content fixes (Claude)
Build sandbox; live app untouched. `myevent.html` + FE data.
- **#1 Citation formatting** in canvas reading cards: synopsis now rendered via `planSyn()` (Citations-aware:
  `.cith` header + hanging-indent `.cite` rows) instead of plain text; clamp switched from `-webkit-line-clamp`
  (breaks with block children) to `max-height` so "Read more" reveals the formatted Citation block. Verified.
- **#2 Browse the Lexicon** ported from the pre-made planner into the canvas: Lexis section "+ Browse the Lexicon"
  → drawer A-Z filterable list of all 1508 terms (`openLexBrowser`/`drawLexBrowse`), click a term → preview
  (definition/etymology/roots/application/exploration) + "+ Add to event" → adds to `DRAFT.lexis` and opens the
  curation drawer (`openLexDetail`). Verified (1508 terms, filter, add, curate).
- **#3 Feminism content:** "The Waltz" (Dorothy Parker, aswl1_e2) was under-tagged (had "femininity" only) → added
  `feminism, gender, gender roles, the woman question`. **Added "The Catbird Seat"** (James Thurber, aswl1_e4, Short
  Story) as a NEW FE row w/ gender/feminism/power keywords. Both now surface in discovery for feminism (16→18) + gender.
  Restart picks up FE data.
- **OPEN (user pain — "building a feminism lesson isn't easy"):** discovery surfaces readings well but the teacher
  assembles one-by-one; feminism KQs/extensions are genuinely sparse in the canon. Candidate fixes discussed w/ user:
  (a) systematic keyword-enrichment pass for high-demand themes (like the Waltz fix, at scale), (b) an "Add all / add
  these" bulk-import in discovery, (c) author/curate more KQs for thin concepts, (d) a concept "starter kit" scaffold.

### 2026-07-01 — Build: declutter — remove per-section helper/hint text (Claude)
User: the small descriptive sub-labels are self-explanatory clutter; drop them. Sandbox/untracked,
no live touch.
- **`planner-cards.html`:** removed the `<span class="tip">` from `section()` — kills all 7 per-section
  helper lines at once ("click a card to read the synopsis", "…the excerpt", "term opens the entry · +
  adds it", etc.); section labels kept. Also removed the two "Other recommendations" `<span
  class="subnote">` blurbs ("— canonical texts/poems you might also teach (pointers; no Vysti
  synopsis/excerpt)"), keeping the "Other recommendations" sub-head.
- **`myevent.html`** (authored-event editor, co-owned by the other agent): removed the
  `<span class="ph-hint">` from the section header render — drops all field hints ("Core readings
  students will study", "Supplementary readings", "Vocabulary from the curated Lexicon", etc.) in one
  edit; labels + Add buttons intact. (Left the `hint:` config values in `SECTIONS` — now unused, harmless.)
- **LEFT alone (flagged):** the **printed Export guide** still shows terse section descriptors
  ("Core readings", "Supplementary readings", "Vocabulary to define and synthesize", "Assignments")
  via `planBlock()` — that's the deliverable doc, not the on-screen UI the user was decluttering. Easy
  to remove too if wanted (blank the `planBlock` tip args in both files).
- Verified in local Docker: planner shows 0 section tips / 0 subnotes, myevent shows 0 field hints;
  all section labels intact.

### 2026-07-02 — Build: "Related Lexis" cross-link chips in the Lexis drawer (Claude)
Step 1 of the "diacritical" Lexicon web (user-agreed): make each entry's curated related terms
clickable so the Lexicon reads as a network, not a flat glossary. Sandbox/untracked, no live touch.
- **`app.py` `lex_payload`** (co-owned by the Primary Focus agent): now also returns
  `assign_lexis` + `linked_lexis` (parsed lists). One-line-ish addition; `/api/lexis/{term}` already
  returns `lex_payload` and is article-tolerant.
- **`planner-cards.html` `openLex`:** new `appendRelatedLexis(l)` renders a **RELATED LEXIS** chip row
  (source: `assign_lexis` else `linked_lexis`) — drops self-refs + article/plural self-variants, dedupes;
  each chip → `openRelLex(term, from)` which opens that entry and sets the drawer **‹ Back** to the
  origin term. Placed **above** "Texts tagged …" (related concepts belong with the concept; matches the
  live app's "RELATED TERMS"). Reuses existing `.chip`/`.chips` styles.
- Data backing it: ~1237 entries have `linked_lexis`, ~1208 have `assign_lexis`, ~82% of refs resolve
  to a real term; non-resolving/variant chips fall back gracefully to openLex's "connective keyword" card.
- Verified in local Docker: abstraction → chips concreteness/figuration/literality/Modernism/metaphor
  (self dropped); click → metaphor entry with Back; Back → abstraction.
- **DEFERRED (next, user-agreed):** inline links in the prose for *distinctive* "node" terms only
  (theory/jargon, non-common) to avoid over-linking — a curated allow-list, not naïve auto-linking.

### 2026-07-02 — Build: Related-Lexis fixes, delete Your Events, back-label uniformity (Claude)
Batch of test-drive fixes. Sandbox/untracked, no live-app/lexicon touch.
- **Related Lexis chips reworked** (`planner-cards.html` `appendRelatedLexis`→`fillRelatedLexis`):
  now UNIONs `assign_lexis`+`linked_lexis` (assign is often just the term itself, so linked carries the
  real neighbours — this is why **mimesis→diegesis** wasn't showing), and shows ONLY terms that resolve
  to a real entry (via a cached `LEXSET`), so dead refs like idiom→"idiomatic expressions" no longer
  render. Chips still appended above "Texts tagged …".
- **Delete for "Your Events"** (`index.html`): added a `×` (`delEvent`→`VBMyEvents.remove`) to the
  authored-event cards, mirroring the Your-Plans `×`; made `.cardx` faintly always-visible (opacity .5)
  for discoverability. (Your Plans already had delete on home cards + rail.)
- **Back-label uniformity** (`myevent.html`): Lexicon-browser back button "‹ Back to Lexicon" → "‹ Back"
  to match the pre-made Event drawer.
**Investigated, NOT bugs / need direction:**
- **Parker "The Waltz" (aswl1_e2) + Thurber "The Catbird Seat" (aswl1_e4) are already in FE and already
  tagged** feminism/gender/"the woman question". Friction is cross-event: Taming of the Shrew is `asel1_e1`;
  those stories are in `aswl1`. The keyword connector + library search already pull cross-event texts —
  discoverability/"build-by-theme" is the real gap (design Q for the user).
- **#4 contrast "no checkboxes":** DATA is fine (`/api/lexis/contrast` → 11 application + 5 exploration).
  Likely the browse-preview (openBrowsedLex is read-only <li>, checkboxes only after Add via openLexDetail)
  vs the pre-made planner's immediate checkboxes. Awaiting user confirmation of exact view before touching
  the other agent's `myevent.html`.
- **#6b opposites/families (Wittgensteinian):** the union fix surfaces much existing linked_lexis (aside→
  drama/tragedy/comedy/dramatic-irony). Remaining gaps (contrast→"comparison" [data has "compare"], full
  dramatic-term family, guaranteed opposite-pairs) need a **curated LIVE-lexicon enrichment pass** on
  `assign_lexis`/`linked_lexis` — proposed as a workflow, pending user go-ahead (live data).

<!-- Next agent: add your dated entry below. -->

---

## 2026-07-01 — Theory-gap authoring: 25 new Lexicon entries (PUBLISHED LIVE ✓ commit f1aecb5)

Follow-through on the theory-gap audit (`vysti-builder/THEORY_GAP_AUDIT.md`). Editorial edge, per the user:
**hermeneutics of suspicion (Marx–Nietzsche–Freud, via Jameson) applied to ideology AND to the subject.**
Identity — feminism/sex/race/gender/**the body** — treated as a *theorised, constructed, embodied* object,
**NOT identity politics**. Scope: seminal & canonical, college-prep pushed past HS; single entries EXCEPT the
Frankfurt School (a group entry, like the existing Bloomsbury Group / Harlem Renaissance / Beat Generation).

- **Authored via Workflow** (`lexicon-theory-authoring`, 25 agents, Opus/high-effort, one entry each, matched to the
  `mimesis` exemplar). All 25 written; **0 duplicates** vs live lexicon; **all ~320 `linked_lexis` refs resolve** to
  real live terms (validated + dropped-none).
- **Set:** A/Suspicion — Nietzsche, Barthes, the aura (Benjamin), Althusser, society of the spectacle (Debord),
  Baudrillard, mourning and melancholia (Freud). B/Frankfurt School — the School (group) + culture industry
  (Adorno/Horkheimer) + Marcuse. C/Identity & the body — Beauvoir, the madwoman in the attic (Gilbert & Gubar),
  social reproduction (Federici), double consciousness (Du Bois), Playing in the Dark (Morrison), the repressive
  hypothesis (Foucault), embodiment (Merleau-Ponty), the carnivalesque (Bakhtin), gender performativity (Butler).
  D/Apparatus — Fanon, cybernetics (Wiener), the cyborg (Haraway), trauma theory (Caruth/Felman&Laub),
  reader-response (Iser/Jauss/Fish/Rosenblatt), the implied author (Booth).
- **Revisions before publish (per Dr. Seeley):** derivations removed from all 25; etymology (+roots) removed from
  every person entry and every coined-phrase concept, KEPT only on the 6 where the root illuminates (the aura,
  mourning and melancholia, cybernetics, the carnivalesque, trauma theory, embodiment); cybernetics application now
  prompts a search for a "dictionary of cybernetics" (no hard URL); no dedicated Gates entry (covered elsewhere).
- **PUBLISHED:** all 25 appended to root `assignment-lexis.csv` (1508 → 1533 rows), committed + pushed to `main`
  (commit **f1aecb5**) → Render auto-deploy. Drafts kept in `vysti-builder/theory_drafts.csv` +
  `THEORY_DRAFTS_REVIEW.md` for reference.
- **Deferred (audit):** "Schools to rummage later" list recorded in `THEORY_GAP_AUDIT.md` (Pre-Raphaelites, Fireside
  Poets, the Inklings, Fugitives/New Critics, Language poets, Oulipo, etc.) — candidate future group entries.

---

## 2026-07-02 — Lexicon browser: article-insensitive sort/search (LIVE deploy commit de035d6)

Problem: "the aura" / "the Apollonian" etc. filed under **T** in the A-Z browser and felt unfindable — user wants to
search/browse by the key noun ("aura", "Apollonian"). Fix = an article-stripped sort/group key (**strips only a
leading "the "**, so "a priori" keeps its letter):
- **LIVE** `student-react/src/components/LexisModal.jsx` (`AzDictionaryView`): sort + letter-group by `sortKey` =
  term with leading "the " removed. Search was already substring (matches "aura"→"the aura"). Rebuilt React
  (`assets/student-react/` + 5 stamped HTML) and pushed to `main` (**de035d6**) → Render.
- **Build sandbox:** same `_sk` key in `myevent.html` + `planner-cards.html` `drawLexBrowse`; and `app.py`
  `/api/lexis/{term}` made article-tolerant ("aura"→"the aura" and vice-versa). Container restarted; verified
  `/api/lexis/aura` and `/api/lexis/Apollonian` resolve.
- **NOTE:** display term keeps its "the" (house style — "the Apollonian"/"the Dionysian"); only sort/search ignore it.
- **VERIFY WHEN RENDER FINISHES:** new chunk `assets/student-react/chunks/isMobile-peyTvgzV.js` 200s on
  app.vysti.org (was still 404/deploying at handoff), then confirm searching "aura" surfaces it under A.
<!-- markdownlint-disable-file -->

