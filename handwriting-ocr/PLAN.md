# Handwriting OCR — Implementation Plan

## Overview

Teachers photograph handwritten student essays → system transcribes them → text enters the existing Vysti marking pipeline. The OCR layer is a **preprocessing step** that outputs plain text. Everything downstream (marking, feedback, docx generation) stays unchanged.

---

## Architecture

```
[Phone Camera]
      |
      v
[Frontend Upload UI]  — accepts multiple images (one per page), reorders via drag-and-drop
      |
      v
[POST /api/ocr/transcribe]  — new endpoint, isolated from main marking routes
      |
      v
[Image Preprocessing]  — OpenCV: deskew, auto-crop, contrast normalization, shadow removal
      |
      v
[LLM Transcription]  — Claude vision API (Haiku for speed/cost, Sonnet as quality fallback)
      |
      v
[Post-processing]  — join pages, clean whitespace, flag [illegible] segments
      |
      v
[Plain text string]  — returned to frontend
      |
      v
[Existing /mark_text or /check_text]  — no changes needed
```

---

## Phases

### Phase 1: Proof of Concept (isolated scripts, no app changes)

**Goal**: Validate that LLM transcription is accurate enough for student handwriting.

- [ ] Collect 10-20 sample handwritten essays (photograph with phone)
- [ ] Write a standalone Python script that sends an image to Claude vision and returns transcribed text
- [ ] Test with varying handwriting quality (neat print, average cursive, messy)
- [ ] Measure accuracy: compare LLM output to manually typed ground truth
- [ ] Test with different prompts to optimize transcription fidelity
- [ ] Estimate cost per essay (tokens used, latency)
- [ ] Document findings (accuracy %, failure modes, cost)

**Deliverables**: `poc/transcribe.py`, `poc/results.md`

**Success criteria**: >85% word-level accuracy on average student handwriting

### Phase 2: Image Preprocessing Pipeline

**Goal**: Handle real-world phone photos (skew, shadows, poor lighting).

- [ ] Build preprocessing pipeline with OpenCV:
  - Auto-detect paper edges and crop
  - Deskew (correct rotation/perspective)
  - Normalize contrast and brightness
  - Remove shadows from page folds/fingers
  - Convert to grayscale + threshold for cleaner input
- [ ] Test preprocessing impact on transcription accuracy
- [ ] Handle both portrait and landscape orientations
- [ ] Handle lined vs unlined paper

**Deliverables**: `poc/preprocess.py`

**Success criteria**: Preprocessing measurably improves accuracy on poor-quality photos

### Phase 3: Multi-Page Assembly

**Goal**: Handle essays spanning multiple pages.

- [ ] Accept multiple images as ordered pages
- [ ] Transcribe each page independently (parallelizable)
- [ ] Join pages with proper paragraph continuity
  - Handle sentences that break across page boundaries
  - Maintain paragraph structure
- [ ] Add page boundary markers (optional, for teacher reference)

**Deliverables**: `poc/multipage.py`

### Phase 4: API Endpoint

**Goal**: Create a standalone endpoint that accepts images and returns text.

- [ ] `POST /api/ocr/transcribe` endpoint
  - Accepts: multipart form with ordered image files
  - Returns: `{ "text": "...", "pages": [...], "confidence": "high|medium|low", "warnings": [...] }`
- [ ] Rate limiting (OCR is more expensive than text marking)
- [ ] File size validation (max per image, max total)
- [ ] Supported format validation (JPEG, PNG, HEIC)
- [ ] HEIC → JPEG conversion (iPhone default format)
- [ ] Auth: same Supabase session auth as other endpoints

**Deliverables**: New route module, NOT added to `vysti_api.py` until fully tested

### Phase 5: Frontend — Upload UI

**Goal**: Teacher-friendly interface for photographing/uploading handwritten essays.

- [ ] New upload flow (separate from existing text/docx upload):
  - "Upload Handwritten Essay" button
  - Multi-image upload (camera capture or file picker)
  - Drag-and-drop page reordering
  - Image preview thumbnails
  - "Transcribe" button → loading state → shows extracted text
- [ ] Teacher reviews/edits transcribed text before marking
  - Side-by-side view: original image | extracted text
  - Teacher can correct transcription errors
  - "Send to Marker" button feeds corrected text into normal flow
- [ ] Mobile-optimized (teachers will often use this on phones)

### Phase 6: Refinements

**Goal**: Production hardening.

- [ ] Fallback: if Claude is slow/down, try Azure Document Intelligence
- [ ] Caching: don't re-transcribe the same image
- [ ] Batch mode: teacher uploads 30 essays at once
- [ ] Analytics: track accuracy, cost, and usage
- [ ] HEIC handling for iPhone photos
- [ ] Compression for large images before sending to API

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary OCR engine | Claude vision (Haiku) | Cheapest, simplest, good accuracy, already integrated |
| Quality fallback | Claude Sonnet | Better accuracy for messy writing, worth the extra cost |
| Traditional OCR fallback | Azure Document Intelligence | Best traditional API if LLM approach fails for a use case |
| Image preprocessing | OpenCV (Python) | Lightweight, proven, no GPU needed |
| Frontend framework | Same React stack | Consistent with existing app |
| Where to add endpoint | Separate route file | Keep isolated from core marking routes until stable |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM hallucinates text that wasn't written | Wrong text gets marked | Teacher review step before marking; flag low-confidence segments |
| Very messy handwriting is illegible | OCR fails | Show [illegible] markers; let teacher fill in manually |
| iPhone HEIC format not handled | Upload fails silently | Convert HEIC → JPEG server-side (pillow-heif library) |
| Phone photos have shadows/skew | Lower accuracy | Preprocessing pipeline (Phase 2) |
| Cost spikes from large images | Unexpected bills | Compress/resize images before sending to LLM; set per-user limits |
| LLM API latency (3-10s/page) | Slow UX | Show progress per page; parallelize multi-page transcription |

---

## Cost Estimates

Assuming Claude Haiku for transcription:

| Volume | Pages/mo | Est. cost/mo |
|---|---|---|
| Pilot (1 school) | ~300 | ~$0.60 |
| Small launch (10 schools) | ~3,000 | ~$6 |
| Growth (100 schools) | ~30,000 | ~$60 |
| Scale (1,000 schools) | ~300,000 | ~$600 |

Even at significant scale, OCR cost is a rounding error compared to the marking LLM costs.

---

## What NOT to Build

- Custom ML model for handwriting recognition (not worth it at our scale)
- Real-time camera preview with live OCR (over-engineered for v1)
- Automatic handwriting quality scoring (nice-to-have for much later)
- Stylus/tablet input recognition (different problem entirely)