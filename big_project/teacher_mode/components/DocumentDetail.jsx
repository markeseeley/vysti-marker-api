import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PreviewPanel from "@student/components/PreviewPanel";
import ModeSelect from "@student/components/ModeSelect";
import ModeCard from "@student/components/ModeCard";
import TeacherScoreCard from "./TeacherScoreCard";
import TeacherDocumentsCard from "./TeacherDocumentsCard";
import TeacherCommentNotebook from "./TeacherCommentNotebook";
import { formatCommentForDownload } from "../lib/commentBank";
import { markTeacherEssay, recheckTeacherText } from "../services/markTeacher";
import { computeIBScores } from "../lib/ibScoring";
import { fetchStudentContext, persistTeacherComment } from "../lib/studentContext";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { extractPreviewTextFromContainer, extractTextWithTeacherAnnotations } from "@student/lib/previewText";
import { TEACHER_MODE_RULE_DEFAULTS, TEACHER_MODES } from "@student/config";
import {
  clearHighlights,
  findBestMatchBlock,
  scrollAndFlash,
  highlightVarietyBlock,
  highlightTechniquesBlock,
  highlightThesisDevicesInBlock,
} from "@student/lib/previewNavigator";
import { applyDismissalsToPreviewDOM } from "@student/lib/previewDismissals";
import { canonicalLabel } from "@student/lib/dismissIssues";
import { applyRepetitionHighlights, clearRepetitionHighlights } from "@student/lib/repetitionHighlight";
import { generateReportPdf } from "@student/lib/generateReport";
import JSZip from "jszip";
import WorkFields from "./WorkFields";

/** True if the inline backgroundColor is a Vysti engine highlight (any non-trivial color). */
function isEngineHighlight(bg) {
  if (!bg) return false;
  const l = bg.toLowerCase().trim();
  if (!l || l === "transparent" || l === "inherit" || l === "initial" || l === "unset") return false;
  if (l === "white" || l === "#ffffff" || l === "#fff" || l.startsWith("rgb(255, 255, 255")) return false;
  return true;
}

/** Walk backward from an arrow span and clear the engine highlights that precede it. */
function clearHighlightsBeforeArrow(arrow) {
  let prev = arrow.previousElementSibling;
  let gap = 0;
  while (prev && gap < 4) {
    if (isEngineHighlight(prev.style?.backgroundColor)) {
      prev.style.backgroundColor = "";
      prev.style.background = "";
      prev.style.removeProperty("font-weight");
      prev = prev.previousElementSibling;
      gap = 0;
    } else {
      // Skip whitespace / punctuation spans that sit between highlight and arrow
      const t = (prev.textContent || "").trim();
      if (!t || /^[\s,;:.!?'"()\-\u2013\u2014]+$/.test(t)) {
        prev = prev.previousElementSibling;
        gap++;
      } else {
        break;
      }
    }
  }
}

function makeDownloadBase(doc) {
  const assignment = (doc.assignmentName || "").trim();
  const student = (doc.studentName || "").trim();
  if (assignment && student) return `${assignment} - ${student}`;
  if (student) return student;
  if (assignment) return assignment;
  return doc.fileName.replace(/\.(docx|pdf)$/i, "");
}

function makeDownloadName(doc, suffix) {
  const base = makeDownloadBase(doc);
  return `${base}${suffix}.docx`;
}

/**
 * Simple download helper — triggers a single <a> click download and returns
 * { url, revoke, cancelAutoRevoke } for the visible fallback link.
 *
 * This replaces downloadBlob() from shared/download.js which fires an
 * additional iframe-based download, creating a spurious second file with a
 * UUID filename.
 */
function triggerDownload(blob, filename) {
  const downloadableBlob = new Blob([blob], { type: "application/octet-stream" });
  const url = URL.createObjectURL(downloadableBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { try { document.body.removeChild(link); } catch {} }, 2000);
  const revokeTimer = setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return {
    url,
    revoke() { clearTimeout(revokeTimer); URL.revokeObjectURL(url); },
    cancelAutoRevoke() { clearTimeout(revokeTimer); },
  };
}

export default function DocumentDetail({ doc, state, dispatch, supa, derived, powerVerbFormsSet, thesisDevicesLexicon, toolkitEnabled, onToolkitChange, onAddFiles, entitlement, onUpgrade }) {
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Source text confirmation dialog state ──
  const [pendingDropFiles, setPendingDropFiles] = useState(null);
  const [dialogWorks, setDialogWorks] = useState(null);

  // ── Dropzone title cross-fade (matches student DropZone pattern) ──
  const dzTitle = state.isProcessing ? "Marking\u2026" : "Mark another essay";
  const [dzDisplayedTitle, setDzDisplayedTitle] = useState(dzTitle);
  const [dzTitleTransition, setDzTitleTransition] = useState("");
  const dzTransitionRef = useRef(null);

  useEffect(() => {
    if (dzTitle === dzDisplayedTitle) return;
    // Phase 1: Exit — fade out + slide up
    setDzTitleTransition("preview-dz-title--exiting");
    dzTransitionRef.current = setTimeout(() => {
      // Phase 2: Pre-enter — instant reposition below
      setDzTitleTransition("preview-dz-title--pre-enter");
      setDzDisplayedTitle(dzTitle);
      // Phase 3: Enter — animate to final position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDzTitleTransition("");
        });
      });
    }, 350);
    return () => clearTimeout(dzTransitionRef.current);
  }, [dzTitle, dzDisplayedTitle]);
  const [previewError, setPreviewError] = useState(null);
  const [previewErrorStack, setPreviewErrorStack] = useState(null);

  // ── Scan toggles (techniques + repetition) ──
  const [scanTechniques, setScanTechniques] = useState(false);
  const [scanRepetition, setScanRepetition] = useState(false);
  const [scanPopover, setScanPopover] = useState(null); // { type, rect, data }
  const scanPopoverRef = useRef(null);

  // Close scan popover on click-outside
  useEffect(() => {
    if (!scanPopover) return;
    const handler = (e) => {
      if (scanPopoverRef.current && !scanPopoverRef.current.contains(e.target)) {
        setScanPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [scanPopover]);

  // Close scan popover on Escape
  useEffect(() => {
    if (!scanPopover) return;
    const handler = (e) => { if (e.key === "Escape") setScanPopover(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [scanPopover]);

  const [dismissPrompt, setDismissPrompt] = useState(null);
  const [saveProgressState, setSaveProgressState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [docScore, setDocScore] = useState(null);
  const [activeWorkIndex, setActiveWorkIndex] = useState(0);
  const [isRechecking, setIsRechecking] = useState(false);
  const saveProgressTimerRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const downloadGuardTimerRef = useRef(null);
  const isDownloadingRef = useRef(false);
  // Pre-prepared export blob for "Download Marked Essay" — built in the background
  // so the download is synchronous (within user gesture) when clicked.
  const preparedExportRef = useRef(null); // { docId, blob, name }
  const prepareExportTimerRef = useRef(null);
  // Pre-prepared report PDF blob — same principle as preparedExportRef.
  const preparedReportRef = useRef(null); // { docId, blob, name }

  // Keep ref in sync so download handlers never use stale closures
  useEffect(() => { isDownloadingRef.current = state.isDownloading; }, [state.isDownloading]);

  // ── Mode info for card ──
  const modeInfo = useMemo(() => {
    const d = TEACHER_MODE_RULE_DEFAULTS[state.mode] || {};
    return {
      label: d.tag || state.mode,
      description: d.description || "",
      details: d.details || [],
    };
  }, [state.mode]);

  // Sync score when document changes, and adjust upward when labels are dismissed.
  // doc.score = original metrics-based score (set once by computeAndDispatchMetrics).
  // doc.metadata.total_labels = original label count (never changes).
  // doc.totalLabels = current count (decremented on dismiss, incremented on undismiss).
  useEffect(() => {
    if (doc?.score == null) { setDocScore(null); return; }
    const originalTotal = doc.metadata?.total_labels ?? 0;
    const currentTotal = doc.totalLabels ?? 0;
    const dismissed = originalTotal - currentTotal;
    if (dismissed <= 0 || originalTotal <= 0) {
      setDocScore(doc.score);
      return;
    }
    // Linear interpolation toward 100 based on fraction of labels dismissed
    const fraction = dismissed / originalTotal;
    const adjusted = Math.min(100, Math.round(doc.score + fraction * (100 - doc.score)));
    setDocScore(adjusted);
    // Keep the comment notebook score in sync
    if (doc.teacherComment && doc.teacherComment.score !== adjusted) {
      dispatch({ type: "SET_TEACHER_SCORE", id: doc.id, score: adjusted });
    }
  }, [doc?.id, doc?.score, doc?.totalLabels, doc?.teacherComment, dispatch]);

  // Clear prepared export blobs when switching documents so the Download
  // button works for the new document instead of re-downloading the old one.
  useEffect(() => {
    preparedExportRef.current = null;
    if (prepareExportTimerRef.current) clearTimeout(prepareExportTimerRef.current);
    preparedReportRef.current = null;
  }, [doc?.id]);

  // Pre-prepare the marked export blob in the background so that
  // handleDownloadMarked can trigger the download synchronously (within the
  // user gesture).  Chrome blocks programmatic a.click() downloads when the
  // user activation has been consumed by prior async operations (fetch, etc.).
  const prepareMarkedExport = useCallback(() => {
    if (!doc?.markedBlob || !supa) return;
    const container = previewRef.current;
    if (!container) return;
    const docId = doc.id;
    // Debounce to avoid hammering the API on rapid edits / re-renders
    if (prepareExportTimerRef.current) clearTimeout(prepareExportTimerRef.current);
    prepareExportTimerRef.current = setTimeout(async () => {
      try {
        const text = extractTextWithTeacherAnnotations(container);
        if (!text) return;
        const ibScores = computeIBScores(doc.labelCounts, doc.wordCount);
        const commentText = doc.teacherComment?.includeInDownload !== false
          ? formatCommentForDownload(doc.teacherComment, ibScores)
          : "";
        const { data: sess } = await supa.auth.getSession();
        const apiBase = getApiBaseUrl();
        if (!sess?.session || !apiBase) return;
        const outputName = makeDownloadName(doc, "_marked");
        const resp = await fetch(`${apiBase}/export_teacher_docx`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session.access_token}`,
          },
          body: JSON.stringify({ file_name: outputName, text, comment: commentText || "" }),
        });
        if (resp.ok) {
          const blob = await resp.blob();
          // Only store if we're still on the same document
          if (doc.id === docId) {
            preparedExportRef.current = { docId, blob, name: outputName };
          }
        }
      } catch {
        // Best-effort — download will still work via fallback
      }
    }, 800);
  }, [doc, supa, state.files]);

  // Pre-prepare the PDF report blob in the background so the download
  // button can render a real <a> link (genuine user click = never blocked).
  // Report data (metrics, labelCounts) is stable after marking — only
  // needs regeneration when the document changes, not on every edit.
  const prepareReportExport = useCallback(() => {
    if (!doc?.markedBlob || !doc?.metrics) return;
    const docId = doc.id;
    // Small delay so we don't block the main thread immediately after render
    setTimeout(async () => {
      try {
        const modeLabel = TEACHER_MODES.find((m) => m.value === state.mode)?.label || state.mode;
        const blob = await generateReportPdf({
          metrics: doc.metrics,
          labelCounts: doc.labelCounts,
          issues: doc.examples?.length ? doc.examples : doc.issues,
          wordCount: doc.wordCount,
          totalIssues: doc.totalLabels,
          mode: state.mode,
          modeLabel,
          fileName: doc.fileName || "essay",
          studentName: doc.studentName || "",
          assignmentName: doc.assignmentName || "",
          date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        });
        if (doc.id !== docId) return; // Document switched
        const outputName = `${makeDownloadBase(doc)}_report.pdf`;
        preparedReportRef.current = { docId, blob, name: outputName };
      } catch (err) {
        console.warn("[prepareReportExport] failed:", err);
      }
    }, 500);
  }, [doc, state.mode]);

  // ── Undo stack ──
  const undoStackRef = useRef([]);
  const undoDebounceRef = useRef(null);
  const lastSnapshotHtmlRef = useRef(null);
  const MAX_UNDO = 50;

  // ── Edit handler ──
  const handleEdit = useCallback(() => {
    if (!doc) return;
    dispatch({ type: "FILE_EDITED", id: doc.id });
    // Invalidate prepared download blobs — content has changed, so the
    // next download must fetch a fresh export from the API.
    preparedExportRef.current = null;
    preparedReportRef.current = null;
    // Re-prepare export blob in the background (800ms debounce inside
    // prepareMarkedExport) so the blob is ready when the user clicks
    // Download.  Without this, Safari (no showSaveFilePicker) falls back
    // to the raw markedBlob which lacks teacher annotations.
    prepareMarkedExport();
  }, [doc, dispatch, prepareMarkedExport]);

  // ── Recheck: re-mark using the current preview text (respects edits) ──
  const handleRecheck = useCallback(async () => {
    if (!doc || !supa || isRechecking) return;

    // Extract the current preview text (includes any teacher edits)
    const container = previewRef.current;
    const previewText = container
      ? extractPreviewTextFromContainer(container)
      : null;

    // If we have preview text, use /mark_text (respects edits).
    // Fall back to original file upload if preview is empty.
    setIsRechecking(true);
    try {
      let result;
      if (previewText?.trim()) {
        result = await recheckTeacherText({
          supa,
          text: previewText,
          fileName: doc.fileName || "essay.docx",
          mode: state.mode,
          rules: state.rules,
          works: doc.works || state.works,
        });
      } else if (doc.file) {
        result = await markTeacherEssay({
          supa,
          file: doc.file,
          mode: state.mode,
          rules: state.rules,
          works: doc.works || state.works,
          studentName: doc.studentName,
          assignmentName: doc.assignmentName,
          classId: doc.classId || state.classId,
        });
      } else {
        console.error("Recheck: no preview text or original file available");
        return;
      }
      dispatch({
        type: "FILE_MARKED",
        id: doc.id,
        mode: state.mode,
        blob: result.blob,
        downloadUrl: result.downloadUrl,
        metadata: result.metadata,
      });
      preparedExportRef.current = null;
      preparedReportRef.current = null;
    } catch (err) {
      console.error("Recheck failed:", err);
    } finally {
      setIsRechecking(false);
    }
  }, [doc, supa, state.mode, state.rules, state.works, state.classId, isRechecking, dispatch]);

  // ── Undo helpers ──
  const saveUndoSnapshot = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const html = container.innerHTML;
    lastSnapshotHtmlRef.current = html;
    const stack = undoStackRef.current;
    stack.push(html);
    if (stack.length > MAX_UNDO) stack.shift();
  }, []);

  const debouncedSnapshot = useCallback(() => {
    clearTimeout(undoDebounceRef.current);
    undoDebounceRef.current = setTimeout(() => {
      const container = previewRef.current;
      if (!container) return;
      if (container.innerHTML === lastSnapshotHtmlRef.current) return;
      saveUndoSnapshot();
    }, 400);
  }, [saveUndoSnapshot]);

  const handleUndo = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const html = stack.pop();
    lastSnapshotHtmlRef.current = html;
    container.innerHTML = html;
    container.focus(); // Re-focus so subsequent Ctrl+Z presses reach the container
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

  // ── Extract clean sentence text from a block (strips arrow labels) ──
  const getBlockSentence = useCallback((blockEl) => {
    if (!blockEl) return "";
    const clone = blockEl.cloneNode(true);
    clone.querySelectorAll("span, a").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text.startsWith("\u2192")) el.remove();
    });
    return (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
  }, []);

  // ── Dismiss a single original label (highlight + arrow) from the DOM ──
  const performSingleDismiss = useCallback((label, element) => {
    if (!doc || !element) return;
    saveUndoSnapshot();

    // Capture sentence BEFORE modifying the DOM
    const block = element.closest("p, li, div") || element.parentElement;
    const sentence = getBlockSentence(block);

    element.classList.add("vysti-dismiss-fade");
    element.classList.remove("vysti-preview-hit", "vysti-arrow-label", "vysti-conventions-hit");
    element.removeAttribute("data-vysti-label");
    element.removeAttribute("data-vysti-hit");
    element.removeAttribute("data-vysti-original");
    element.removeAttribute("data-vysti-meter");
    element.style.backgroundColor = "";
    element.style.background = "";
    element.style.cursor = "";
    element.style.removeProperty("font-weight");

    if (block) {
      const arrows = Array.from(block.querySelectorAll("span, a")).filter((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return text.startsWith("\u2192") && text.includes(label);
      });
      for (const arrow of arrows) {
        clearHighlightsBeforeArrow(arrow);
        arrow.remove();
      }
      block.normalize();
    }

    dispatch({ type: "DISMISS_LABEL", id: doc.id, label });

    // Record dismissed issue so it survives recheck
    if (sentence) {
      dispatch({
        type: "ADD_DISMISSED_ISSUES",
        id: doc.id,
        records: [{ label, sentence, file_name: doc.fileName, created_at: new Date().toISOString() }],
      });
    }
  }, [doc, dispatch, saveUndoSnapshot, getBlockSentence]);

  // ── Dismiss ALL instances of a label from the preview DOM ──
  const performDismissAll = useCallback((label) => {
    const container = previewRef.current;
    if (!container || !doc) { setDismissPrompt(null); return; }
    saveUndoSnapshot();

    // Find every arrow span matching this label anywhere in the preview
    const arrows = Array.from(container.querySelectorAll("span, a")).filter((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return text.startsWith("\u2192") && text.includes(label);
    });

    // Capture sentences BEFORE modifying the DOM
    const dismissRecords = [];
    for (const arrow of arrows) {
      const block = arrow.closest("p, li, div") || arrow.parentElement;
      const sentence = getBlockSentence(block);
      if (sentence) {
        dismissRecords.push({ label, sentence, file_name: doc.fileName, created_at: new Date().toISOString() });
      }
    }

    // For each arrow: clear its preceding highlights, strip any tagged siblings, remove arrow
    const clearedBlocks = new Set();
    for (const arrow of arrows) {
      const block = arrow.closest("p, li, div") || arrow.parentElement;
      if (block) clearedBlocks.add(block);
      clearHighlightsBeforeArrow(arrow);
      arrow.remove();
    }

    // Also strip any tagged highlight spans for this label (yellow-tagged by tagYellowLabels)
    const tagged = Array.from(container.querySelectorAll("[data-vysti-label]"))
      .filter((el) => el.getAttribute("data-vysti-label") === label);
    for (const span of tagged) {
      span.classList.remove("vysti-preview-hit", "vysti-arrow-label", "vysti-conventions-hit");
      span.removeAttribute("data-vysti-label");
      span.removeAttribute("data-vysti-hit");
      span.removeAttribute("data-vysti-original");
      span.removeAttribute("data-vysti-meter");
      span.style.backgroundColor = "";
      span.style.background = "";
      span.style.cursor = "";
      span.style.removeProperty("font-weight");
    }

    // Normalize text nodes in affected blocks
    for (const block of clearedBlocks) {
      block.normalize();
    }

    const totalDismissed = arrows.length + tagged.length;
    if (totalDismissed > 0) {
      dispatch({ type: "DISMISS_LABEL_ALL", id: doc.id, label, count: totalDismissed });
      if (dismissRecords.length > 0) {
        dispatch({ type: "ADD_DISMISSED_ISSUES", id: doc.id, records: dismissRecords });
      }
    }
    setDismissPrompt(null);
  }, [doc, dispatch, saveUndoSnapshot, getBlockSentence]);

  // ── Label dismiss handler (teacher double-clicks a yellow label to remove it) ──
  const handleLabelDismiss = useCallback((label, element) => {
    if (!doc || !element) return;

    // Rewrite tags ("* Rewrite this paragraph for practice *"):
    // remove the entire span — it's a Vysti artifact, not student text.
    if (element.classList.contains("vysti-rewrite-tag")) {
      saveUndoSnapshot();
      element.classList.add("vysti-dismiss-fade");
      setTimeout(() => element.remove(), 350);
      return;
    }

    // Teacher annotations: remove highlight + arrow, mark as edited (no DISMISS_LABEL)
    if (element.classList.contains("vysti-teacher-mark") || element.getAttribute("data-vysti-teacher") === "1") {
      saveUndoSnapshot();
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

    // Original labels: if multiple instances exist, offer "Dismiss All"
    const count = doc.labelCounts?.[label] || 0;
    if (count > 1) {
      const rect = element.getBoundingClientRect();
      setDismissPrompt({
        label,
        element,
        count,
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
      return;
    }

    // Single instance: dismiss immediately
    performSingleDismiss(label, element);
  }, [doc, dispatch, saveUndoSnapshot, performSingleDismiss]);

  // No-op — previously maintained a fallback <a> link for downloads.
  // Kept as a stable reference so callers don't need to change.
  const setDownloadResult = useCallback(() => {}, []);

  // ── Download revised handler ──
  const handleDownloadRevised = useCallback(async () => {
    if (!doc?.markedBlob || !supa) return;
    if (isDownloadingRef.current) return;

    const container = previewRef.current;
    if (!container) return;

    const text = extractPreviewTextFromContainer(container);
    if (!text) return;

    const outputName = makeDownloadName(doc, "_revised");

    // showSaveFilePicker MUST be called within the user gesture — before any
    // await — or Chrome silently blocks it.
    let fileHandle = null;
    if (window.showSaveFilePicker) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: outputName,
          types: [{
            description: "Word Document",
            accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
          }],
        });
      } catch (err) {
        if (err.name === "AbortError" && !err.message?.includes("Intercepted")) return;
        // SecurityError, interception, or other — fall through to triggerDownload below
      }
    }

    dispatch({ type: "SET_DOWNLOADING", payload: true });
    // Safety net: auto-clear after 30s in case finally doesn't run
    if (downloadGuardTimerRef.current) clearTimeout(downloadGuardTimerRef.current);
    downloadGuardTimerRef.current = setTimeout(() => {
      dispatch({ type: "SET_DOWNLOADING", payload: false });
    }, 30_000);

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) { console.warn("[download-revised] no session"); return; }

      const apiBase = getApiBaseUrl();
      if (!apiBase) { console.warn("[download-revised] no apiBase"); return; }

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

      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          // Write failed — fall through to triggerDownload
          const result = triggerDownload(blob, outputName);
          setDownloadResult(result, outputName);
        }
      } else {
        const result = triggerDownload(blob, outputName);
        setDownloadResult(result, outputName);
      }
    } catch (err) {
      console.error("Teacher download revised failed:", err);
    } finally {
      if (downloadGuardTimerRef.current) clearTimeout(downloadGuardTimerRef.current);
      dispatch({ type: "SET_DOWNLOADING", payload: false });
    }
  }, [doc, supa, state.files, dispatch, setDownloadResult]);

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
    if (!doc?.markedBlob && !doc?.downloadUrl) return;

    const outputName = makeDownloadName(doc, "_marked");

    // showSaveFilePicker requires a user gesture — it MUST be called
    // synchronously within the click handler, before any await.
    // Open the Save As dialog first, then resolve the blob to write.
    let fileHandle = null;
    if (window.showSaveFilePicker) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: outputName,
          types: [{
            description: "Word Document",
            accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
          }],
        });
      } catch (err) {
        if (err.name === "AbortError" && !err.message?.includes("Intercepted")) return;
        // SecurityError, interception, or other — fall through to triggerDownload below
      }
    }

    // Now resolve the best available blob (async work is safe here since
    // the file handle is already open).
    const prepared = preparedExportRef.current;
    let downloadMe = (prepared && prepared.docId === doc.id && prepared.blob)
      ? prepared.blob
      : null;

    // If we have NO file handle AND no prepared blob, the user gesture will
    // expire the moment we await anything.  Download the raw marked blob
    // synchronously now (without teacher comments) so the download actually
    // triggers, then kick off background preparation for next time.
    if (!fileHandle && !downloadMe) {
      if (doc.markedBlob) {
        const result = triggerDownload(doc.markedBlob, outputName);
        setDownloadResult(result, outputName);
      }
      prepareMarkedExport();
      return;
    }

    // If no prepared blob, try a live API call to include teacher comments.
    // This is safe because either:
    //   (a) we have a fileHandle (Save As dialog already open), or
    //   (b) we have a prepared blob and won't enter this block.
    if (!downloadMe && supa && previewRef.current) {
      try {
        const text = extractTextWithTeacherAnnotations(previewRef.current);
        if (text) {
          const ibScores = computeIBScores(doc.labelCounts, doc.wordCount);
          const commentText = doc.teacherComment?.includeInDownload !== false
            ? formatCommentForDownload(doc.teacherComment, ibScores)
            : "";
          const { data: sess } = await supa.auth.getSession();
          const apiBase = getApiBaseUrl();
          if (sess?.session && apiBase) {
            const resp = await fetch(`${apiBase}/export_teacher_docx`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sess.session.access_token}`,
              },
              body: JSON.stringify({ file_name: outputName, text, comment: commentText || "" }),
            });
            if (resp.ok) downloadMe = await resp.blob();
          }
        }
      } catch {
        // Fall through to raw markedBlob
      }
    }

    // Last resort: raw marked blob (without teacher comments)
    if (!downloadMe) downloadMe = doc.markedBlob;
    if (!downloadMe) return;

    // Write to the Save As file handle, or fall back to triggerDownload.
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(downloadMe);
        await writable.close();
      } catch {
        // Write failed — fall through to triggerDownload
        const result = triggerDownload(downloadMe, outputName);
        setDownloadResult(result, outputName);
      }
    } else {
      const result = triggerDownload(downloadMe, outputName);
      setDownloadResult(result, outputName);
    }

    // Persist teacher comment in the background (best-effort)
    if (supa && doc.teacherComment?.paragraph) {
      persistTeacherComment(supa, doc.fileName, doc.studentName, doc.classId, doc.teacherComment.paragraph, doc.markEventId).catch(() => {});
    }

    // Re-prepare for next download (comment may have changed since prep)
    prepareMarkedExport();
  }, [doc, supa, state.files, prepareMarkedExport, setDownloadResult]);

  // ── Download PDF report ──
  // generateReportPdf is statically imported at the top of the file.
  // Dynamic import() of the report module causes React 19 to tear down
  // and remount the entire tree, resetting all state to initial values.
  const isGeneratingRef = useRef(false);
  const handleDownloadReport = useCallback(async () => {
    if (!doc?.markedBlob || !doc.metrics || isGeneratingRef.current) return;

    const filename = `${makeDownloadBase(doc)}_report.pdf`;

    // Always use showSaveFilePicker FIRST (Chrome/Edge) — it must be the
    // first await to preserve the user gesture.  After the dialog is open,
    // async work (PDF generation) is safe.
    let fileHandle = null;
    if (window.showSaveFilePicker) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: "PDF Document",
            accept: { "application/pdf": [".pdf"] },
          }],
        });
      } catch (err) {
        if (err.name === "AbortError" && !err.message?.includes("Intercepted")) return;
      }
    }

    isGeneratingRef.current = true;
    try {
      // Use pre-prepared blob if available (instant), otherwise generate now.
      const prepared = preparedReportRef.current;
      let blob = (prepared && prepared.docId === doc.id && prepared.blob)
        ? prepared.blob
        : null;

      if (!blob) {
        const modeLabel = TEACHER_MODES.find((m) => m.value === state.mode)?.label || state.mode;
        blob = await generateReportPdf({
          metrics: doc.metrics,
          labelCounts: doc.labelCounts,
          issues: doc.examples?.length ? doc.examples : doc.issues,
          wordCount: doc.wordCount,
          totalIssues: doc.totalLabels,
          mode: state.mode,
          modeLabel,
          fileName: doc.fileName || "essay",
          studentName: doc.studentName || "",
          assignmentName: doc.assignmentName || "",
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });
      }

      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          triggerDownload(blob, filename);
        }
      } else {
        // No showSaveFilePicker (Firefox/Safari) — triggerDownload as fallback.
        triggerDownload(blob, filename);
      }
      // Store for next time
      preparedReportRef.current = { docId: doc.id, blob, name: filename };
    } catch (err) {
      console.error("Report generation failed", err);
    } finally {
      isGeneratingRef.current = false;
    }
  }, [doc, state.mode]);

  const handleShowPillHint = useCallback((hintOrUpdater) => {
    if (typeof hintOrUpdater === "function") {
      dispatch({ type: "SET_HINT", payload: hintOrUpdater(state.hint) });
    } else {
      dispatch({ type: "SET_HINT", payload: hintOrUpdater });
    }
  }, [dispatch, state.hint]);

  // ── After preview renders, hide the Issues Summary table (teacher only) ──
  // Also tag and hide technique (green) highlights so they're hidden by default.
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

    // Tag and hide technique (green) highlights from the .docx
    const GREEN_RE = /^(lime|green|#00ff00)$|^rgb\(0,\s*(255|128),\s*0/i;
    for (const span of container.querySelectorAll("span")) {
      const bg = (span.style.backgroundColor || "").toLowerCase().trim();
      if (bg && GREEN_RE.test(bg)) {
        span.setAttribute("data-vysti-technique-bg", bg);
        span.style.backgroundColor = "transparent";
      }
    }
  }, []);

  // Read server-computed metrics from doc.metadata.scores
  const computeAndDispatchMetrics = useCallback(() => {
    if (!doc) return;
    const metrics = doc.metadata?.scores;
    if (!metrics) return;
    dispatch({ type: "FILE_METRICS_COMPUTED", id: doc.id, metrics });

    // Compute display score (same formula as student DropZone)
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
  }, [doc, state.mode, dispatch]);

  // Initialize undo stack when preview first renders
  const handleRenderedWithSnapshot = useCallback(() => {
    handleRendered();
    const container = previewRef.current;
    if (container) {
      undoStackRef.current = [];
      lastSnapshotHtmlRef.current = container.innerHTML;
      // Persist rendered HTML immediately so session restore (Keep Working) works
      // even if the teacher never clicks Save or edits the document.
      if (doc && !doc.savedHtml) {
        dispatch({ type: "FILE_SAVED", id: doc.id, html: container.innerHTML });
      }
    }
    computeAndDispatchMetrics();
    // Pre-prepare the export blob so downloads are synchronous when clicked
    prepareMarkedExport();
    prepareReportExport();
  }, [handleRendered, computeAndDispatchMetrics, doc, dispatch, prepareMarkedExport, prepareReportExport]);

  // ── Scan toggle handlers ──
  // Reset scan state when document changes
  useEffect(() => {
    setScanTechniques(false);
    setScanRepetition(false);
  }, [doc?.id]);

  const handleToggleScanTechniques = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    if (scanTechniques) {
      // OFF: hide docx green highlights + remove client-side device spans
      for (const span of container.querySelectorAll("[data-vysti-technique-bg]")) {
        span.style.backgroundColor = "transparent";
      }
      for (const span of container.querySelectorAll(".vysti-device-hit")) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }
      container.classList.remove("vysti-scan-techniques");
      setScanTechniques(false);
      setScanPopover(null);
      return;
    }

    // ON: first clear repetition if active
    if (scanRepetition) {
      clearRepetitionHighlights(container);
      container.classList.remove("vysti-scan-repetition");
      setScanRepetition(false);
    }

    // Restore docx green highlights
    for (const span of container.querySelectorAll("[data-vysti-technique-bg]")) {
      span.style.backgroundColor = span.getAttribute("data-vysti-technique-bg");
    }

    // Also add client-side highlights for any devices the docx missed
    if (thesisDevicesLexicon?.size) {
      const blocks = Array.from(container.querySelectorAll("p, li"));
      const isCentered = (el) => {
        const s = window.getComputedStyle(el);
        return s.textAlign === "center" || s.textAlign === "-webkit-center";
      };
      for (const block of blocks) {
        if (!isCentered(block) && (block.textContent || "").trim()) {
          highlightThesisDevicesInBlock(block, thesisDevicesLexicon);
        }
      }
      // Add inline green to client-side device spans so download picks them up
      for (const span of container.querySelectorAll(".vysti-device-hit:not([data-vysti-technique-bg])")) {
        span.style.backgroundColor = "#00ff00";
      }
    }

    container.classList.add("vysti-scan-techniques");
    setScanTechniques(true);

    // Collect unique techniques from highlighted spans for popover
    if (thesisDevicesLexicon?.size) {
      const found = new Set();
      for (const span of container.querySelectorAll(".vysti-device-hit, [data-vysti-technique-bg]")) {
        const t = (span.textContent || "").trim().toLowerCase();
        if (t && thesisDevicesLexicon.has(t)) {
          found.add(thesisDevicesLexicon.get(t));
        }
      }
      const techniques = Array.from(found).sort();
      if (techniques.length > 0) {
        setScanPopover({ type: "techniques", data: techniques });
      }
    }
  }, [scanTechniques, scanRepetition, thesisDevicesLexicon]);

  const handleToggleScanRepetition = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    if (scanRepetition) {
      clearRepetitionHighlights(container);
      container.classList.remove("vysti-scan-repetition");
      setScanRepetition(false);
      setScanPopover(null);
      return;
    }

    // First clear techniques if active
    if (scanTechniques) {
      for (const span of container.querySelectorAll("[data-vysti-technique-bg]")) {
        span.style.backgroundColor = "transparent";
      }
      for (const span of container.querySelectorAll(".vysti-device-hit")) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }
      container.classList.remove("vysti-scan-techniques");
      setScanTechniques(false);
    }

    const repeatedNouns = doc?.metrics?.power?.details?.repeatedNouns || [];
    const filtered = repeatedNouns
      .filter((n) => (n.activeCount || n.count || 0) >= 3)
      .sort((a, b) => (b.activeCount || b.count || 0) - (a.activeCount || a.count || 0));
    const result = applyRepetitionHighlights(container, repeatedNouns);
    if (result.total > 0) {
      container.classList.add("vysti-scan-repetition");
      setScanPopover({ type: "repetition", data: filtered });
    }
    setScanRepetition(result.total > 0);
  }, [scanRepetition, scanTechniques, doc?.metrics]);

  // Fallback: dispatch server metrics if not yet dispatched
  useEffect(() => {
    if (!doc || doc.metrics) return;
    if (!doc.metadata?.scores) return;
    computeAndDispatchMetrics();
  }, [doc?.id, doc?.metrics, doc?.metadata?.scores, computeAndDispatchMetrics]);

  // Close dismiss prompt when preview scrolls
  useEffect(() => {
    const container = previewRef.current;
    if (!container || !dismissPrompt) return;
    const onScroll = () => setDismissPrompt(null);
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [dismissPrompt]);

  // Maroon border on paragraph containing the dismiss target
  useEffect(() => {
    if (!dismissPrompt?.element) return;
    const para = dismissPrompt.element.closest("p, li, div");
    if (!para) return;
    para.classList.add("vysti-dismiss-target-para");
    return () => para.classList.remove("vysti-dismiss-target-para");
  }, [dismissPrompt]);

  // ── Persist fields to Supabase via /update_mark_event ──
  const persistToApi = useCallback(async (fields = {}) => {
    if (!supa || !doc?.fileName) return false;
    try {
      const { data: sess } = await supa.auth.getSession();
      if (!sess?.session) return false;
      const apiBase = getApiBaseUrl();
      if (!apiBase) return false;

      const body = { file_name: doc.fileName, ...fields };
      if (doc.markEventId) body.mark_event_id = doc.markEventId;
      // Include current doc fields so the save is complete
      if (body.student_name === undefined && doc.studentName) body.student_name = doc.studentName;
      if (body.class_id === undefined) body.class_id = doc.classId || "";
      if (body.assignment_name === undefined && doc.assignmentName) body.assignment_name = doc.assignmentName;
      if (body.teacher_comment === undefined && doc.teacherComment?.paragraph) {
        const ibScores = computeIBScores(doc.labelCounts, doc.wordCount);
        body.teacher_comment = formatCommentForDownload(doc.teacherComment, ibScores) || "";
      }
      // Include source works so the Progress page can display them
      if (body.source_works === undefined) {
        const works = (doc.works || state.works || []).filter((w) => w.author || w.title);
        if (works.length > 0) {
          body.source_works = works.map((w) => ({ author: w.author || "", title: w.title || "" }));
        }
      }
      // Include score so the Progress page stays current
      if (body.score === undefined && doc.teacherComment?.score != null) {
        body.score = doc.teacherComment.score;
      }
      // Auto-promote pending → in_progress on first save
      if (!fields.review_status) body.review_status = "in_progress";

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session.access_token}`,
      };
      let resp = await fetch(`${apiBase}/update_mark_event`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      // If save failed (e.g. `score` column doesn't exist yet), retry
      // without optional fields that may not be in the DB schema.
      if (!resp.ok && body.score !== undefined) {
        const { score: _s, ...bodyWithoutScore } = body;
        resp = await fetch(`${apiBase}/update_mark_event`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(bodyWithoutScore),
        });
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`[save] /update_mark_event ${resp.status}:`, errText);
      }
      return resp.ok;
    } catch (err) {
      console.error("[save] API persist failed:", err);
      return false;
    }
  }, [supa, doc?.fileName, doc?.studentName, doc?.classId, doc?.assignmentName, doc?.teacherComment, doc?.works, state.works, doc?.markEventId]);

  // ── Save changes handler (persist teacher edits as HTML + API) ──
  const handleSave = useCallback(async () => {
    const container = previewRef.current;
    if (!container || !doc) return;

    const html = container.innerHTML;

    // 1. Save to local reducer (in-memory)
    dispatch({ type: "FILE_SAVED", id: doc.id, html });

    // 2. Persist to Supabase
    clearTimeout(saveProgressTimerRef.current);
    setSaveProgressState("saving");

    const ok = await persistToApi();

    // 3. Upload savedHtml to Supabase Storage so the resume flow can restore edits
    try {
      const { data: sess } = await supa.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (uid && doc.fileName) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        await supa.storage.from("originals").upload(
          `${uid}/${doc.fileName}.saved.html`,
          htmlBlob,
          { upsert: true, contentType: "text/html" },
        );
      }
    } catch (err) {
      console.warn("[save] savedHtml upload failed (non-critical):", err);
    }

    if (ok) {
      setSaveProgressState("saved");
      setLastSavedAt(new Date());
      // If the review was previously marked complete but the teacher made
      // further edits and then saved, reset the status back to in_progress.
      // persistToApi() already sends review_status: "in_progress" to the
      // backend; this keeps the local UI in sync so the "Done" badge
      // disappears and the "Finish Review" button reappears.
      if (doc.reviewStatus === "completed" && doc.hasRevisedSinceMark) {
        dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "reviewStatus", value: "in_progress" });
      }
    } else {
      setSaveProgressState("failed");
    }
    saveProgressTimerRef.current = setTimeout(() => setSaveProgressState("idle"), 2500);
    // Re-prepare the export blob so the next download includes latest edits
    prepareMarkedExport();
  }, [doc, dispatch, persistToApi, supa, prepareMarkedExport]);

  // Auto-save every 60 seconds when teacher has unsaved edits
  useEffect(() => {
    clearInterval(autoSaveIntervalRef.current);
    if (!doc?.hasRevisedSinceMark) return;
    autoSaveIntervalRef.current = setInterval(async () => {
      const container = previewRef.current;
      if (container && doc) {
        const html = container.innerHTML;
        dispatch({ type: "FILE_SAVED", id: doc.id, html });
        clearTimeout(saveProgressTimerRef.current);
        setSaveProgressState("saving");
        const ok = await persistToApi();
        // Also upload savedHtml to storage (best-effort)
        try {
          const { data: sess } = await supa.auth.getSession();
          const uid = sess?.session?.user?.id;
          if (uid && doc.fileName) {
            const htmlBlob = new Blob([html], { type: "text/html" });
            await supa.storage.from("originals").upload(
              `${uid}/${doc.fileName}.saved.html`,
              htmlBlob,
              { upsert: true, contentType: "text/html" },
            );
          }
        } catch {}
        if (ok) {
          setSaveProgressState("saved");
          setLastSavedAt(new Date());
          // Reset "completed" review status on auto-save after edits
          if (doc.reviewStatus === "completed") {
            dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "reviewStatus", value: "in_progress" });
          }
        } else {
          setSaveProgressState("failed");
        }
        saveProgressTimerRef.current = setTimeout(() => setSaveProgressState("idle"), 2500);
      }
    }, 60_000);
    return () => clearInterval(autoSaveIntervalRef.current);
  }, [doc?.id, doc?.hasRevisedSinceMark, dispatch, persistToApi, supa]);

  // ── Finish Review handler ──
  const handleFinishReview = useCallback(async () => {
    if (!doc) return;
    setSaveProgressState("saving");

    // Save current HTML first
    const container = previewRef.current;
    if (container) {
      dispatch({ type: "FILE_SAVED", id: doc.id, html: container.innerHTML });
    }

    const ok = await persistToApi({ review_status: "completed" });
    if (ok) {
      dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "reviewStatus", value: "completed" });
      setSaveProgressState("saved");
      setLastSavedAt(new Date());
    } else {
      setSaveProgressState("failed");
    }
    clearTimeout(saveProgressTimerRef.current);
    saveProgressTimerRef.current = setTimeout(() => setSaveProgressState("idle"), 2500);
  }, [doc, dispatch, persistToApi]);

  // ── Fetch student context (previous essay data) when document opens ──
  useEffect(() => {
    if (!doc || !supa || doc.status !== "marked") return;
    if (!doc.studentName?.trim()) return;
    // Skip if already fetched for this doc
    if (doc.studentContext !== null) return;

    let cancelled = false;
    fetchStudentContext(supa, doc.studentName, doc.classId, doc.fileName)
      .then((ctx) => {
        if (!cancelled && ctx) {
          dispatch({ type: "SET_STUDENT_CONTEXT", id: doc.id, context: ctx });
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [doc?.id, doc?.studentName, doc?.classId, doc?.status, supa, dispatch]);

  // ── Re-apply dismissed labels to preview DOM after recheck/blob change ──
  // Only run when the blob changes (recheck produces a fresh DOM that needs
  // prior dismissals re-applied).  We must NOT re-run when dismissedIssues
  // changes alone, because the label was already removed synchronously by
  // performSingleDismiss / performDismissAll — re-running would create
  // orphan highlight spans (findBestMatchBlock wraps text nodes, then the
  // early-return in removeIssueLabelAndHighlight skips clearHighlights).
  const prevBlobRef = useRef(doc?.markedBlob);
  useEffect(() => {
    const blobChanged = doc?.markedBlob !== prevBlobRef.current;
    prevBlobRef.current = doc?.markedBlob;
    if (!blobChanged) return;
    if (!doc?.markedBlob || !previewRef.current || !doc?.fileName) return;
    const dismissed = doc.dismissedIssues;
    if (!dismissed || dismissed.length === 0) return;
    const timer = window.setTimeout(() => {
      applyDismissalsToPreviewDOM(previewRef.current, dismissed, doc.fileName);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [doc?.markedBlob, doc?.dismissedIssues, doc?.fileName]);

  // ── Undismiss (restore) previously dismissed issues ──
  const handleUndismiss = useCallback((recordsToRestore) => {
    if (!recordsToRestore?.length || !doc) return;
    dispatch({ type: "UNDISMISS_ISSUES", id: doc.id, records: recordsToRestore });
  }, [doc, dispatch]);

  // ── Preview dropzone handlers ──
  const handlePreviewDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!onAddFiles) return;
    const files = [...e.dataTransfer.files].filter(
      (f) => /\.(docx|pdf)$/i.test(f.name) || f.name.endsWith(".doc")
    );
    if (files.length > 0) {
      setPendingDropFiles(files);
      setDialogWorks(state.works.map((w) => ({ ...w })));
    }
  }, [onAddFiles, state.works]);

  const handlePreviewBrowse = useCallback((e) => {
    if (!onAddFiles) return;
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length > 0) {
      setPendingDropFiles(files);
      setDialogWorks(state.works.map((w) => ({ ...w })));
    }
  }, [onAddFiles, state.works]);

  const handleDialogCancel = useCallback(() => {
    setPendingDropFiles(null);
    setDialogWorks(null);
  }, []);

  const handleDialogMark = useCallback(() => {
    if (!pendingDropFiles || !onAddFiles) return;
    if (dialogWorks) {
      dispatch({ type: "SET_WORKS", payload: dialogWorks });
    }
    onAddFiles(pendingDropFiles);
    setPendingDropFiles(null);
    setDialogWorks(null);
  }, [pendingDropFiles, dialogWorks, onAddFiles, dispatch]);

  // Escape key closes dialog
  useEffect(() => {
    if (!pendingDropFiles) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); handleDialogCancel(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingDropFiles, handleDialogCancel]);

  if (!doc) return null;

  return (
    <div className="teacher-detail">
      <div className="teacher-detail-header">
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
          <ModeSelect
            mode={state.mode}
            onChange={(m) => dispatch({ type: "SET_MODE", payload: m })}
            modes={TEACHER_MODES}
          />
          <ModeCard
            label={modeInfo.label}
            description={modeInfo.description}
            details={modeInfo.details}
          />
          {/* ── Source texts the teacher entered ── */}
          {(() => {
            const works = doc.works || state.works || [];
            const filled = works.filter((w) => w.author || w.title);
            if (filled.length === 0) return null;
            return (
              <div className="teacher-works-display">
                <h4 className="teacher-works-heading">Source texts</h4>
                {filled.map((w, i) => (
                  <div key={i} className="teacher-works-item">
                    {w.author && <span className="teacher-works-author">{w.author}</span>}
                    {w.author && w.title && <span className="teacher-works-sep"> — </span>}
                    {w.title && (
                      <span className="teacher-works-title">
                        {w.isMinor ? `\u201C${w.title}\u201D` : <i>{w.title}</i>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
        <section className="card teacher-score-card-wrap">
          {/* ── Dropzone inside score card (matches student DropZone layout) ── */}
          {onAddFiles && entitlement?.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit ? (
            <div
              className="teacher-preview-dropzone"
              tabIndex={0}
              role="button"
              aria-label="Subscribe to mark more essays"
              onClick={() => { onUpgrade?.(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUpgrade?.(); } }}
            >
              <span className="preview-dz-title">Subscribe to mark more</span>
            </div>
          ) : onAddFiles && (
            <div
              className={`teacher-preview-dropzone${isDragOver ? " drag-over" : ""}${state.isProcessing ? " is-processing" : ""}`}
              tabIndex={0}
              role="button"
              aria-label="Upload .docx or .pdf files"
              onDragOver={(e) => { e.preventDefault(); if (!state.isProcessing) setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={state.isProcessing ? undefined : handlePreviewDrop}
              onClick={state.isProcessing ? undefined : () => fileInputRef.current?.click()}
              onKeyDown={state.isProcessing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            >
              <span className={`preview-dz-title${dzTitleTransition ? ` ${dzTitleTransition}` : ""}`}>{dzDisplayedTitle}</span>
              <input
                ref={fileInputRef}
                type="file"
                name="teacher-add-files"
                accept=".docx,.pdf,.doc"
                multiple
                style={{ display: "none" }}
                onChange={handlePreviewBrowse}
              />
            </div>
          )}
          <TeacherScoreCard
            score={docScore}
            labelCounts={doc.labelCounts}
            onDownloadReport={handleDownloadReport}
            hasMetrics={!!doc.metrics}
          />
        </section>
        <section className="card teacher-docs-card-wrap">
          <TeacherDocumentsCard
            files={state.files}
            activeDocId={doc.id}
            onSelectDocument={(id) => dispatch({ type: "SELECT_DOCUMENT", payload: id })}
            onRemoveDocument={(id) => {
              if (id === doc.id && doc.downloadUrl) URL.revokeObjectURL(doc.downloadUrl);
              dispatch({ type: "REMOVE_FILE", payload: id });
            }}
            activeStudentName={doc.studentName}
            activeAssignmentName={doc.assignmentName}
            onStudentNameChange={(name) => dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "studentName", value: name })}
            onAssignmentNameChange={(name) => dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "assignmentName", value: name })}
            onFieldBlur={() => persistToApi().catch(() => {})}
            onSave={() => persistToApi()}
            classes={state.classes}
            activeClassId={doc.classId}
            onClassChange={(classId) => {
              dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "classId", value: classId });
              // Clear student context so it re-fetches for the new class
              dispatch({ type: "SET_STUDENT_CONTEXT", id: doc.id, context: null });
              // Auto-persist the class change
              persistToApi({ class_id: classId || "" }).catch(() => {});
            }}
            onBatchClassChange={(ids, classId) => {
              for (const id of ids) {
                dispatch({ type: "UPDATE_FILE_FIELD", id, field: "classId", value: classId });
                dispatch({ type: "SET_STUDENT_CONTEXT", id, context: null });
              }
            }}
            supa={supa}
            onClassCreated={(newClass, target) => {
              const updated = [...state.classes, newClass].sort((a, b) => a.name.localeCompare(b.name));
              dispatch({ type: "SET_CLASSES", payload: updated });
              if (target === "single") {
                dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "classId", value: newClass.id });
                dispatch({ type: "SET_STUDENT_CONTEXT", id: doc.id, context: null });
              }
            }}
            onDownloadSelected={async (ids) => {
              const toDownload = state.files.filter((f) => ids.includes(f.id) && (f.downloadUrl || f.markedBlob?.size > 0));
              if (!toDownload.length) return;

              // showSaveFilePicker MUST be called within the user gesture —
              // before any await — or Chrome silently blocks it.
              let fileHandle = null;
              if (window.showSaveFilePicker) {
                try {
                  fileHandle = await window.showSaveFilePicker({
                    suggestedName: "marked_essays.zip",
                    types: [{
                      description: "ZIP Archive",
                      accept: { "application/zip": [".zip"] },
                    }],
                  });
                } catch (err) {
                  if (err.name === "AbortError" && !err.message?.includes("Intercepted")) return;
                  // SecurityError, interception, or other — fall through to triggerDownload below
                }
              }

              // Now safe to do async work — file handle is already open (or we'll
              // use the fallback <a>.click() which works for the first auto-download).

              // Get session + API base for export_teacher_docx calls
              let sess = null;
              let apiBase = null;
              try {
                const { data } = await supa.auth.getSession();
                sess = data?.session;
                apiBase = getApiBaseUrl();
              } catch {}

              // Bundle all marked essays into a single .zip file.
              const zip = new JSZip();
              for (const f of toDownload) {
                const name = makeDownloadName(f, "_marked");
                let blob = null;

                // Try to export via API with teacher comments included.
                // Use the live preview for the current doc, savedHtml for others.
                if (sess && apiBase) {
                  try {
                    let text = null;
                    if (f.id === doc?.id && previewRef.current) {
                      text = extractTextWithTeacherAnnotations(previewRef.current);
                    } else if (f.savedHtml) {
                      const tmp = document.createElement("div");
                      tmp.innerHTML = f.savedHtml;
                      text = extractTextWithTeacherAnnotations(tmp);
                    }
                    if (text) {
                      const ibScores = computeIBScores(f.labelCounts, f.wordCount);
                      const commentText = f.teacherComment?.includeInDownload !== false
                        ? formatCommentForDownload(f.teacherComment, ibScores)
                        : "";
                      const resp = await fetch(`${apiBase}/export_teacher_docx`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${sess.access_token}`,
                        },
                        body: JSON.stringify({ file_name: name, text, comment: commentText || "" }),
                      });
                      if (resp.ok) blob = await resp.blob();
                    }
                  } catch (err) {
                    console.warn(`[download-all] export failed for ${f.fileName}:`, err);
                  }
                }

                // Fall back to raw marked blob if API export didn't work
                if (!blob) {
                  blob = f.markedBlob?.size > 0 ? f.markedBlob : await fetch(f.downloadUrl).then((r) => r.blob());
                }
                zip.file(name, blob);
              }
              const zipBlob = await zip.generateAsync({ type: "blob" });

              // Write to the already-open file handle, or fall back to <a>.click()
              if (fileHandle) {
                try {
                  const writable = await fileHandle.createWritable();
                  await writable.write(zipBlob);
                  await writable.close();
                } catch {
                  // Write failed — fall through to triggerDownload
                  triggerDownload(zipBlob, "marked_essays.zip");
                }
              } else {
                // Fallback (Firefox / Safari, or showSaveFilePicker failed)
                triggerDownload(zipBlob, "marked_essays.zip");
              }
            }}
          />
        </section>
      </div>

      <div className="teacher-scan-bar">
        <div className="teacher-scan-buttons">
          <button
            type="button"
            className={`teacher-scan-btn${scanTechniques ? " active" : ""}`}
            onClick={handleToggleScanTechniques}
            title={scanTechniques ? "Hide technique highlights" : "Show techniques (green)"}
          >
            <span className="scan-dot scan-dot--green" />
            Techniques
          </button>
          <button
            type="button"
            className={`teacher-scan-btn${scanRepetition ? " active" : ""}`}
            onClick={handleToggleScanRepetition}
            disabled={!doc?.metrics?.power?.details?.repeatedNouns?.length}
            title={scanRepetition ? "Hide repetition highlights" : "Show repeated nouns (red)"}
          >
            <span className="scan-dot scan-dot--red" />
            Repetition
          </button>
        </div>
        {scanPopover && (
          <div ref={scanPopoverRef} className="scan-info-popover">
            {scanPopover.type === "techniques" && (
              <>
                <div className="scan-popover-title">Techniques found</div>
                <ul className="scan-popover-list">
                  {scanPopover.data.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {scanPopover.type === "repetition" && (
              <>
                <div className="scan-popover-title">Repeated nouns</div>
                <ul className="scan-popover-list">
                  {scanPopover.data.map((n) => (
                    <li key={n.lemma}>
                      {n.lemma} <span className="scan-popover-count">{"\u00d7"}{n.activeCount || n.count || 0}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* TeacherAnnotationPalette replaced by SelectionPopover in PreviewPanel */}

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
        isProcessing={false}
        onEdit={handleEdit}
        onRecheck={handleRecheck}
        isRechecking={isRechecking}
        onDownloadMarked={handleDownloadMarked}
        onDownloadRevised={handleDownloadRevised}
        isDownloading={state.isDownloading}
        hasRevisedSinceMark={doc.hasRevisedSinceMark}
        worksChanged={doc.worksChangedSinceMark}
        onSaveProgress={handleSave}
        saveProgressState={saveProgressState}
        saveProgressEnabled
        lastSavedAt={lastSavedAt}
        onFinishReview={handleFinishReview}
        reviewStatus={doc.reviewStatus}
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
        works={doc.works || state.works}
        activeWorkIndex={activeWorkIndex}
        onWorksChange={(w) => dispatch({ type: "SET_FILE_WORKS", id: doc.id, payload: w })}
        onActiveWorkIndexChange={setActiveWorkIndex}
        onLabelDismiss={handleLabelDismiss}
        onRendered={handleRenderedWithSnapshot}
        onUndo={handleUndo}
        onBeforeEdit={saveUndoSnapshot}
        dismissedIssues={doc.dismissedIssues}
        onUndismiss={handleUndismiss}
        toolkitEnabled={toolkitEnabled}
        onToolkitChange={onToolkitChange}
      />

      <TeacherCommentNotebook
        doc={doc}
        comment={doc.teacherComment}
        onCommentChange={(c) => dispatch({ type: "SET_TEACHER_COMMENT", id: doc.id, comment: c })}
        onScoreChange={(s) => dispatch({ type: "SET_TEACHER_SCORE", id: doc.id, score: s })}
        onToggleDownload={() => dispatch({ type: "TOGGLE_COMMENT_DOWNLOAD", id: doc.id })}
        onStudentNameChange={(name) => dispatch({ type: "UPDATE_FILE_FIELD", id: doc.id, field: "studentName", value: name })}
        studentContext={doc.studentContext}
        metrics={doc.metrics}
        mode={state.mode}
      />

      {dismissPrompt && (
        <div className="dismiss-all-overlay" onClick={() => setDismissPrompt(null)}>
          <div
            className="dismiss-all-prompt"
            style={{ top: dismissPrompt.top - 8, left: dismissPrompt.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="dismiss-all-prompt-btn"
              onClick={() => {
                const para = dismissPrompt.element?.closest("p, li, div");
                if (para) para.classList.remove("vysti-dismiss-target-para");
                performSingleDismiss(dismissPrompt.label, dismissPrompt.element);
                setDismissPrompt(null);
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="dismiss-all-prompt-btn dismiss-all-prompt-btn--all"
              onClick={() => {
                const para = dismissPrompt.element?.closest("p, li, div");
                if (para) para.classList.remove("vysti-dismiss-target-para");
                performDismissAll(dismissPrompt.label);
              }}
            >
              Dismiss all {dismissPrompt.count}
            </button>
          </div>
        </div>
      )}

      {/* ── "Update source texts?" confirmation dialog ── */}
      {pendingDropFiles && (
        <div
          className="prefs-overlay source-text-dialog-overlay"
          onClick={handleDialogCancel}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="source-text-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="source-text-dialog-header">
              <h3 className="source-text-dialog-title">Update source texts?</h3>
              <button
                type="button"
                className="prefs-close-btn"
                onClick={handleDialogCancel}
                aria-label="Close dialog"
              >&times;</button>
            </div>

            <p className="source-text-dialog-subtitle">
              {pendingDropFiles.length === 1
                ? `Marking \u201c${pendingDropFiles[0].name}\u201d`
                : `Marking ${pendingDropFiles.length} files`}
            </p>

            <div className="source-text-dialog-body">
              <WorkFields
                works={dialogWorks || []}
                onUpdate={setDialogWorks}
                maxWorks={3}
              />
            </div>

            <div className="source-text-dialog-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={handleDialogCancel}
              >Cancel</button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleDialogMark}
              >Mark</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
