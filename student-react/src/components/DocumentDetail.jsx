import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PreviewPanel from "./PreviewPanel";
import ModeCard from "./ModeCard";
import TeacherScoreCard from "./TeacherScoreCard";
import TeacherDocumentsCard from "./TeacherDocumentsCard";
import TeacherAnnotationPalette from "./TeacherAnnotationPalette";
import { downloadBlob } from "@shared/download";
import { buildMarkTextPayload } from "@shared/markingApi";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { markText } from "../services/markEssay";
import { extractPreviewTextFromContainer } from "../lib/previewText";
import { loadThesisDevicesLexicon } from "../lib/studentMetrics";
import { buildPowerVerbFormsSet, loadPowerVerbs } from "../lib/powerVerbs";
import { TEACHER_MODE_RULE_DEFAULTS } from "../config";
import {
  clearHighlights,
  findBestMatchBlock,
  scrollAndFlash,
  highlightVarietyBlock,
  highlightTechniquesBlock,
} from "../lib/previewNavigator";
import { rescoreAfterDismissal } from "../lib/rescoreAfterDismissal";

export default function DocumentDetail({ doc, state, dispatch, supa, derived }) {
  const previewRef = useRef(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewErrorStack, setPreviewErrorStack] = useState(null);
  const [showSaveFlash, setShowSaveFlash] = useState(false);
  const [palettePos, setPalettePos] = useState(null);
  const savedRangeRef = useRef(null);
  const [docScore, setDocScore] = useState(null);
  const [downloadFallback, setDownloadFallback] = useState(null);
  const downloadUrlRef = useRef(null);
  const powerVerbsRef = useRef(null);
  const thesisLexiconRef = useRef(null);
  const [activeWorkIndex, setActiveWorkIndex] = useState(0);
  // Snapshot works at mark time so we can detect changes
  const worksAtMarkRef = useRef(JSON.stringify(state.works));
  const worksChanged = JSON.stringify(state.works) !== worksAtMarkRef.current;

  // ── Mode info for card ──
  const modeInfo = useMemo(() => {
    const d = TEACHER_MODE_RULE_DEFAULTS[state.mode] || {};
    return {
      label: d.tag || state.mode,
      description: d.description || "",
      details: d.details || [],
    };
  }, [state.mode]);

  // ── Lazy-load power verbs + thesis devices for score computation ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!powerVerbsRef.current) {
        const { list } = await loadPowerVerbs();
        if (!cancelled) powerVerbsRef.current = buildPowerVerbFormsSet(list);
      }
      if (!thesisLexiconRef.current) {
        const { lexicon } = await loadThesisDevicesLexicon();
        if (!cancelled) thesisLexiconRef.current = lexicon;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset score when document changes
  useEffect(() => {
    setDocScore(null);
  }, [doc?.id]);

  // Build a real blob URL for the download <a> tag so Chrome doesn't block
  // repeated downloads (programmatic link.click() is only allowed once).
  useEffect(() => {
    // Revoke any previous URL
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    setDownloadFallback(null);

    if (!doc?.markedBlob) return;
    const url = URL.createObjectURL(doc.markedBlob);
    downloadUrlRef.current = url;
    const name = doc.fileName.replace(/\.docx$/i, "_marked.docx");
    setDownloadFallback({ url, name });

    return () => {
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = null;
      }
    };
  }, [doc?.markedBlob, doc?.fileName]);

  // ── Undo stack ──
  const undoStackRef = useRef([]);
  const undoDebounceRef = useRef(null);
  const lastSnapshotHtmlRef = useRef(null);
  const MAX_UNDO = 50;

  // ── Edit handler ──
  const handleEdit = useCallback(() => {
    if (!doc) return;
    dispatch({ type: "FILE_EDITED", id: doc.id });
  }, [doc, dispatch]);

  // ── Undo helpers ──
  const saveUndoSnapshot = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const html = container.innerHTML;
    if (html === lastSnapshotHtmlRef.current) return;
    lastSnapshotHtmlRef.current = html;
    const stack = undoStackRef.current;
    stack.push(html);
    if (stack.length > MAX_UNDO) stack.shift();
  }, []);

  const debouncedSnapshot = useCallback(() => {
    clearTimeout(undoDebounceRef.current);
    undoDebounceRef.current = setTimeout(saveUndoSnapshot, 400);
  }, [saveUndoSnapshot]);

  const handleUndo = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const html = stack.pop();
    lastSnapshotHtmlRef.current = html;
    container.innerHTML = html;
    if (doc) dispatch({ type: "FILE_EDITED", id: doc.id });
  }, [doc, dispatch]);

  // Capture undo snapshot on text input (debounced)
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const onBeforeInput = () => debouncedSnapshot();
    container.addEventListener("beforeinput", onBeforeInput);
    return () => container.removeEventListener("beforeinput", onBeforeInput);
  }, [debouncedSnapshot]);

  // Intercept Ctrl+Z / Cmd+Z on the preview container
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const onKeyDown = (e) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  // ── Label dismiss handler (teacher double-clicks a yellow label to remove it) ──
  const handleLabelDismiss = useCallback((label, element) => {
    if (!doc || !element) return;
    saveUndoSnapshot();

    // Rewrite tags ("* Rewrite this paragraph for practice *"):
    // remove the entire span — it's a Vysti artifact, not student text.
    if (element.classList.contains("vysti-rewrite-tag")) {
      element.classList.add("vysti-dismiss-fade");
      setTimeout(() => element.remove(), 350);
      return;
    }

    // Teacher annotations: remove highlight + arrow, mark as edited (no DISMISS_LABEL)
    if (element.classList.contains("vysti-teacher-mark") || element.getAttribute("data-vysti-teacher") === "1") {
      element.classList.add("vysti-dismiss-fade");
      element.classList.remove("vysti-preview-hit", "vysti-teacher-mark");
      element.removeAttribute("data-vysti-label");
      element.removeAttribute("data-vysti-hit");
      element.removeAttribute("data-vysti-teacher");
      element.style.cursor = "";

      const block = element.closest("p, li, div") || element.parentElement;
      if (block) {
        const arrows = Array.from(block.querySelectorAll('span.vysti-teacher-mark, span[data-vysti-teacher="1"]')).filter((el) => {
          const text = (el.textContent || "").trim();
          return text.startsWith("\u2192");
        });
        for (const arrow of arrows) {
          arrow.remove();
          break;
        }
        block.normalize();
      }

      dispatch({ type: "FILE_EDITED", id: doc.id });
      return;
    }

    // 1. Fade out & remove the yellow highlight from the clicked element
    element.classList.add("vysti-dismiss-fade");
    element.classList.remove("vysti-preview-hit");
    element.removeAttribute("data-vysti-label");
    element.removeAttribute("data-vysti-hit");
    element.style.cursor = "";

    // 2. Find and remove the arrow label (→ Label) that follows in the same block
    const block = element.closest("p, li, div") || element.parentElement;
    if (block) {
      const arrows = Array.from(block.querySelectorAll("span, a")).filter((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return text.startsWith("→") && text.includes(label);
      });
      for (const arrow of arrows) {
        // Also clear inline highlighting on preceding siblings
        let sibling = arrow.previousSibling;
        while (sibling && sibling.nodeType === Node.ELEMENT_NODE) {
          if (sibling.style?.backgroundColor || sibling.style?.background) {
            sibling.style.backgroundColor = "";
            sibling.style.background = "";
          }
          sibling = sibling.previousSibling;
        }
        arrow.remove();
      }
      block.normalize();
    }

    // 3. Update label counts in state
    dispatch({ type: "DISMISS_LABEL", id: doc.id, label });

    // 4. Recalculate overall score with the dismissed label removed
    const newCounts = { ...doc.labelCounts };
    if (newCounts[label] > 1) newCounts[label] -= 1;
    else delete newCounts[label];
    const newScore = rescoreAfterDismissal(doc.metadata?.scores, newCounts, state.mode, doc.wordCount);
    if (newScore != null) {
      setDocScore(newScore);
      dispatch({ type: "FILE_SCORE_COMPUTED", id: doc.id, score: newScore });
    }
  }, [doc, dispatch, saveUndoSnapshot, state.mode]);

  // ── Recheck handler ──
  const handleRecheck = useCallback(async () => {
    if (!doc?.markedBlob || !supa) return;
    if (state.isRechecking) return;
    if (!doc.hasRevisedSinceMark) return;

    const container = previewRef.current;
    if (!container) return;

    const text = extractPreviewTextFromContainer(container);
    if (!text) return;

    dispatch({ type: "SET_RECHECKING", payload: true });

    try {
      const payload = buildMarkTextPayload({
        fileName: doc.fileName,
        text,
        mode: state.mode,
      });
      payload.student_mode = false; // Teacher recheck requires has_mark

      // Attach works if configured
      if (state.works?.length > 0) {
        const validWorks = state.works.filter((w) => w.author?.trim() || w.title?.trim());
        if (validWorks.length > 0) {
          payload.titles = validWorks.map((w) => ({
            author: w.author?.trim() || "",
            title: w.title?.trim() || "",
            is_minor: Boolean(w.isMinor),
          }));
        }
      }

      const { blob } = await markText({
        supa,
        payload,
      });

      worksAtMarkRef.current = JSON.stringify(state.works);
      dispatch({
        type: "FILE_RECHECKED",
        id: doc.id,
        blob,
      });
    } catch (err) {
      console.error("Teacher recheck failed:", err);
    } finally {
      dispatch({ type: "SET_RECHECKING", payload: false });
    }
  }, [doc, supa, state.isRechecking, state.mode, state.works, dispatch]);

  // ── Download revised handler ──
  const handleDownloadRevised = useCallback(async () => {
    if (!doc?.markedBlob || !supa) return;
    if (state.isDownloading) return;

    const container = previewRef.current;
    if (!container) return;

    const text = extractPreviewTextFromContainer(container);
    if (!text) return;

    dispatch({ type: "SET_DOWNLOADING", payload: true });

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) return;

      const apiBase = getApiBaseUrl();
      if (!apiBase) return;

      const outputName = doc.fileName.replace(/\.docx$/i, "_revised.docx");
      const response = await fetch(`${apiBase}/export_docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ file_name: outputName, text }),
      });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      downloadBlob(blob, outputName);
    } catch (err) {
      console.error("Teacher download revised failed:", err);
    } finally {
      dispatch({ type: "SET_DOWNLOADING", payload: false });
    }
  }, [doc, supa, state.isDownloading, dispatch]);

  // Navigation callbacks
  const handleNavigateToSentence = useCallback((sentenceOrExample) => {
    const container = previewRef.current;
    if (!container) return false;

    const exampleObj =
      typeof sentenceOrExample === "string"
        ? { sentence: sentenceOrExample }
        : sentenceOrExample || {};

    const sentence = String(
      exampleObj?.sentence || exampleObj?.sentence_text || exampleObj?.text || ""
    ).trim();

    if (!sentence) return false;

    clearHighlights(container);
    const match = findBestMatchBlock(container, { ...exampleObj, sentence });
    if (!match || !match.el) return false;

    scrollAndFlash(match.el, { block: "center" });
    return true;
  }, []);

  const handleHighlightVarietyParagraph = useCallback((example) => {
    const container = previewRef.current;
    if (!container) return false;

    clearHighlights(container);
    const blockEl = highlightVarietyBlock(container, example);
    if (!blockEl) return false;

    blockEl.classList.add("vysti-flash-highlight");
    setTimeout(() => blockEl.classList.remove("vysti-flash-highlight"), 1400);
    return true;
  }, []);

  const handleHighlightTechniquesParagraph = useCallback((example) => {
    const container = previewRef.current;
    if (!container) return { ok: false, devices: [] };

    clearHighlights(container);
    const blockEl = highlightTechniquesBlock(container, example);
    if (!blockEl) return { ok: false, devices: [] };

    blockEl.classList.add("vysti-flash-highlight");
    setTimeout(() => blockEl.classList.remove("vysti-flash-highlight"), 1400);
    return { ok: true, devices: [] };
  }, []);

  const handleScrollToPreview = useCallback((opts) => {
    const container = previewRef.current;
    if (!container) return;
    if (opts?.clear) clearHighlights(container);
    const card = document.getElementById("markedPreviewCard");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePreviewError = useCallback((err) => {
    if (err) {
      setPreviewError(err.message || String(err));
      setPreviewErrorStack(err.stack || null);
    } else {
      setPreviewError(null);
      setPreviewErrorStack(null);
    }
  }, []);

  const handleDownloadMarked = useCallback(async () => {
    if (!doc?.markedBlob) return;

    const outputName = doc.fileName.replace(/\.docx$/i, "_marked.docx");

    // Collect teacher annotations from the preview DOM.
    const container = previewRef.current;
    const teacherAnnotations = [];
    if (container) {
      // Arrow marks (→ labels)
      const selector = 'span[data-vysti-teacher="1"][data-vysti-label], span.vysti-teacher-mark[data-vysti-label]';
      for (const span of container.querySelectorAll(selector)) {
        const text = (span.textContent || "").trim();
        if (!text.startsWith("\u2192")) continue;
        const label = span.getAttribute("data-vysti-label");
        if (!label) continue;
        const wrapper = span.previousElementSibling;
        const wrappedText = (wrapper && wrapper.getAttribute("data-vysti-label") === label)
          ? (wrapper.textContent || "").trim()
          : "";
        teacherAnnotations.push({ label, wrappedText });
      }

      // Inline comments (✎ pencil comments from SelectionPopover)
      for (const span of container.querySelectorAll('span[data-vysti-comment]')) {
        const comment = span.getAttribute("data-vysti-comment") || "";
        if (!comment) continue;
        const wrappedText = span.getAttribute("data-vysti-comment-anchor") || (span.textContent || "").trim();
        teacherAnnotations.push({ label: `💬 ${comment}`, wrappedText });
      }
    }

    // If teacher annotations exist, fetch annotated blob and update the
    // download fallback <a> so subsequent clicks work without programmatic click.
    if (teacherAnnotations.length > 0 && supa) {
      try {
        const { data, error } = await supa.auth.getSession();
        if (!error && data?.session) {
          const apiBase = getApiBaseUrl();
          if (apiBase) {
            const formData = new FormData();
            formData.append("file", doc.markedBlob, doc.fileName);
            formData.append("annotations", JSON.stringify(teacherAnnotations));

            const response = await fetch(`${apiBase}/annotate_docx`, {
              method: "POST",
              headers: { Authorization: `Bearer ${data.session.access_token}` },
              body: formData,
            });
            if (response.ok) {
              const blob = await response.blob();
              // Replace the fallback URL with the annotated blob
              if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
              const url = URL.createObjectURL(blob);
              downloadUrlRef.current = url;
              setDownloadFallback({ url, name: outputName });
              // Trigger this first download programmatically
              downloadBlob(blob, outputName);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Annotated download failed, falling back to original:", err);
      }
    }

    // Fallback: download original marked blob
    downloadBlob(doc.markedBlob, outputName);
  }, [doc, supa]);

  const handleShowPillHint = useCallback((hintOrUpdater) => {
    if (typeof hintOrUpdater === "function") {
      dispatch({ type: "SET_HINT", payload: hintOrUpdater(state.hint) });
    } else {
      dispatch({ type: "SET_HINT", payload: hintOrUpdater });
    }
  }, [dispatch, state.hint]);

  // ── After preview renders, hide the Issues Summary table (teacher only) ──
  const handleRendered = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const tables = container.querySelectorAll("table");
    for (const tbl of tables) {
      const firstRow = tbl.querySelector("tr");
      if (!firstRow) continue;
      const cells = firstRow.querySelectorAll("td, th");
      if (cells.length < 2) continue;
      const c0 = (cells[0].textContent || "").trim().toLowerCase();
      const c1 = (cells[1].textContent || "").trim().toLowerCase();
      if (c0 === "issue" && c1 === "explanation") {
        tbl.style.display = "none";
        // Also hide the spacer paragraph before the table
        const prev = tbl.previousElementSibling;
        if (prev && prev.tagName === "P" && !(prev.textContent || "").trim()) {
          prev.style.display = "none";
        }
        break;
      }
    }
  }, []);

  // Initialize undo stack when preview first renders + compute score
  const handleRenderedWithSnapshot = useCallback(() => {
    handleRendered();
    const container = previewRef.current;
    if (container) {
      undoStackRef.current = [];
      lastSnapshotHtmlRef.current = container.innerHTML;

      // Read server-computed scores from metadata
      if (doc) {
        const metrics = doc.metadata?.scores;
        if (metrics) {
          const hideCohesion = state.mode === "peel_paragraph";
          const scores = [
            metrics.power?.score,
            metrics.variety?.score,
            hideCohesion ? null : metrics.cohesion?.score,
            metrics.precision?.score,
          ].filter((s) => s != null);

          if (scores.length && metrics.precision?.score != null) {
            const rawAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
            const words = doc.wordCount || 0;
            const lengthPenalty = words > 0 && words < 400 ? Math.round((400 - words) * 0.03) : 0;
            const rawScore = Math.max(0, rawAverage - lengthPenalty);
            const displayScore = Math.round(Math.sqrt(rawScore / 100) * 100);
            setDocScore(displayScore);
            dispatch({ type: "FILE_SCORE_COMPUTED", id: doc.id, score: displayScore });
          }
        }
      }
    }
  }, [handleRendered, doc, state.mode, dispatch]);

  // ── Show annotation palette when teacher selects text in preview ──
  const checkSelection = useCallback(() => {
    // Don't close the palette while the user is interacting with it (e.g. comment input)
    if (document.activeElement?.closest?.(".teacher-annotation-palette")) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPalettePos(null);
      savedRangeRef.current = null;
      return;
    }

    const range = sel.getRangeAt(0);
    const container = previewRef.current;
    if (!container) {
      setPalettePos(null);
      savedRangeRef.current = null;
      return;
    }

    const ancestor = range.commonAncestorContainer;
    if (!container.contains(ancestor)) {
      setPalettePos(null);
      savedRangeRef.current = null;
      return;
    }

    savedRangeRef.current = range.cloneRange();

    const rect = range.getBoundingClientRect();
    setPalettePos({
      top: Math.max(8, rect.top - 48),
      left: Math.max(120, Math.min(rect.left + rect.width / 2, window.innerWidth - 120)),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", checkSelection);
    return () => document.removeEventListener("selectionchange", checkSelection);
  }, [checkSelection]);

  // Also detect selection via mouseup on the preview container (more reliable in some browsers)
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    container.addEventListener("mouseup", checkSelection);
    return () => container.removeEventListener("mouseup", checkSelection);
  }, [checkSelection]);

  // Close palette when preview container scrolls
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const onScroll = () => {
      if (palettePos) {
        setPalettePos(null);
        savedRangeRef.current = null;
      }
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [palettePos]);

  // ── Apply teacher annotation to selected text ──
  const handleAnnotationMark = useCallback((icon, label) => {
    const range = savedRangeRef.current;
    const container = previewRef.current;
    if (!range || !container) return;
    saveUndoSnapshot();

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const wrapper = document.createElement("span");
    wrapper.classList.add("vysti-preview-hit", "vysti-teacher-mark");
    wrapper.setAttribute("data-vysti-label", `${icon} ${label}`);
    wrapper.setAttribute("data-vysti-hit", "1");
    wrapper.setAttribute("data-vysti-teacher", "1");
    wrapper.style.cursor = "pointer";

    try {
      range.surroundContents(wrapper);
    } catch {
      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
    }

    const arrowSpan = document.createElement("span");
    arrowSpan.classList.add("vysti-preview-hit", "vysti-teacher-mark");
    arrowSpan.setAttribute("data-vysti-label", `${icon} ${label}`);
    arrowSpan.setAttribute("data-vysti-hit", "1");
    arrowSpan.setAttribute("data-vysti-teacher", "1");
    arrowSpan.style.cursor = "pointer";
    arrowSpan.style.fontWeight = "bold";
    arrowSpan.textContent = ` \u2192 ${icon} ${label}`;
    wrapper.after(arrowSpan);

    sel.removeAllRanges();
    savedRangeRef.current = null;
    setPalettePos(null);

    dispatch({ type: "FILE_EDITED", id: doc.id });
  }, [doc, dispatch, saveUndoSnapshot]);

  const handleAnnotationClose = useCallback(() => {
    setPalettePos(null);
    savedRangeRef.current = null;
  }, []);

  // ── Persist doc fields to Supabase via PATCH /update_mark_event ──
  const persistToApi = useCallback(async (fields = {}) => {
    if (!supa || !doc?.fileName) return false;
    try {
      const { data: sess } = await supa.auth.getSession();
      if (!sess?.session) return false;
      const apiBase = getApiBaseUrl();
      if (!apiBase) return false;

      const body = { file_name: doc.fileName, ...fields };
      if (doc.markEventId) body.mark_event_id = doc.markEventId;
      if (body.student_name === undefined && doc.studentName) body.student_name = doc.studentName;
      if (body.class_id === undefined) body.class_id = doc.classId || "";
      if (body.assignment_name === undefined && doc.assignmentName) body.assignment_name = doc.assignmentName;
      if (!fields.review_status) body.review_status = "in_progress";

      const resp = await fetch(`${apiBase}/update_mark_event`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      return resp.ok;
    } catch (err) {
      console.error("[save] API persist failed:", err);
      return false;
    }
  }, [supa, doc?.fileName, doc?.studentName, doc?.classId, doc?.assignmentName, doc?.markEventId]);

  // ── Save changes handler (persist teacher edits as HTML + API) ──
  const handleSave = useCallback(async () => {
    const container = previewRef.current;
    if (!container || !doc) return;
    dispatch({ type: "FILE_SAVED", id: doc.id, html: container.innerHTML });
    await persistToApi();
    setShowSaveFlash(true);
    setTimeout(() => setShowSaveFlash(false), 2000);
  }, [doc, dispatch, persistToApi]);

  if (!doc) return null;

  return (
    <div className="teacher-detail">
      <div className="teacher-detail-header">
        <button
          type="button"
          className="teacher-back-btn"
          onClick={() => dispatch({ type: "BACK_TO_OVERVIEW" })}
        >
          ← Back to Class Overview
        </button>
        <h2 className="teacher-detail-title">
          {doc.studentName || doc.fileName}
        </h2>

        {doc.hasRevisedSinceMark && (
          <button
            type="button"
            className="teacher-save-btn"
            onClick={handleSave}
          >
            Save changes
          </button>
        )}
        {showSaveFlash && (
          <span className="teacher-save-flash">Saved</span>
        )}

        {derived?.positionLabel && (
          <div className="teacher-doc-nav">
            <button
              type="button"
              className="teacher-nav-btn"
              disabled={!derived.hasPrev}
              onClick={() => dispatch({ type: "SELECT_DOCUMENT", payload: derived.prevDocId })}
              aria-label="Previous document"
            >
              ← Prev
            </button>
            <span className="teacher-nav-position">{derived.positionLabel}</span>
            <button
              type="button"
              className="teacher-nav-btn"
              disabled={!derived.hasNext}
              onClick={() => dispatch({ type: "SELECT_DOCUMENT", payload: derived.nextDocId })}
              aria-label="Next document"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Summary grid: mode | score | documents ── */}
      <div className="teacher-detail-grid">
        <section className="card teacher-mode-card">
          <ModeCard
            label={modeInfo.label}
            description={modeInfo.description}
            details={modeInfo.details}
          />
        </section>
        <section className="card teacher-score-card-wrap">
          <TeacherScoreCard
            score={docScore}
            labelCounts={doc.labelCounts}
            totalIssues={doc.totalLabels}
          />
        </section>
        <section className="card teacher-docs-card-wrap">
          <TeacherDocumentsCard
            files={state.files}
            activeDocId={doc.id}
            onSelectDocument={(id) => dispatch({ type: "SELECT_DOCUMENT", payload: id })}
            dispatch={dispatch}
            activeStudentName={doc.studentName}
            activeAssignmentName={doc.assignmentName}
            onStudentNameChange={(name) => dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "studentName", value: name })}
            onAssignmentNameChange={(name) => dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "assignmentName", value: name })}
            onFieldBlur={() => persistToApi().catch(() => {})}
          />
        </section>
      </div>

      <div className="teacher-annotation-hint">
        Select text in the preview to add comments or marks
      </div>

      <TeacherAnnotationPalette
        position={palettePos}
        onMark={handleAnnotationMark}
        onClose={handleAnnotationClose}
      />

      <PreviewPanel
        isTeacher
        markedBlob={doc.markedBlob}
        savedHtml={doc.savedHtml}
        zoom={state.zoom}
        onZoomChange={(z) => dispatch({ type: "SET_ZOOM", payload: z })}
        previewRef={previewRef}
        labelCounts={doc.labelCounts}
        issues={doc.issues}
        onNavigateToPreviewSentence={handleNavigateToSentence}
        onJumpPowerVerb={null}
        onToggleRepetition={null}
        onHighlightVarietyParagraph={handleHighlightVarietyParagraph}
        onHighlightTechniquesParagraph={handleHighlightTechniquesParagraph}
        onScrollToPreview={handleScrollToPreview}
        onOpenRevisionFromLabel={null}
        onRecheck={handleRecheck}
        isRechecking={state.isRechecking}
        isProcessing={false}
        onEdit={handleEdit}
        onDownloadMarked={handleDownloadMarked}
        onDownloadRevised={handleDownloadRevised}
        isDownloading={state.isDownloading}
        downloadFallback={downloadFallback}
        onClearDownloadFallback={() => setDownloadFallback(null)}
        hasRevisedSinceMark={doc.hasRevisedSinceMark}
        wordCount={doc.wordCount}
        totalIssues={doc.totalLabels}
        markMetadata={doc.metadata}
        metrics={null}
        metricsCollapsed={true}
        onToggleMetricsDetails={null}
        onOpenMetricInfo={null}
        onOpenPowerVerbs={null}
        hint={null}
        onDismissHint={null}
        onShowPillHint={null}
        mode={state.mode}
        previewError={previewError}
        previewErrorStack={previewErrorStack}
        showDebug={false}
        onClearPreview={() => {}}
        onPreviewError={handlePreviewError}
        selectedFileName={doc.fileName}
        works={state.works}
        activeWorkIndex={activeWorkIndex}
        onWorksChange={(next) => dispatch({ type: "SET_WORKS", payload: next })}
        onActiveWorkIndexChange={setActiveWorkIndex}
        worksChanged={worksChanged}
        onLabelDismiss={handleLabelDismiss}
        onRendered={handleRenderedWithSnapshot}
        onUndo={handleUndo}
      />

    </div>
  );
}
