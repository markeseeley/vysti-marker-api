import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download } from "./Icons";
import {
  OVERALL_CRITICAL_LABELS,
  OVERALL_MODERATE_LABELS
} from "../lib/studentMetrics";

export default function DropZone({
  selectedFile,
  isDragOver,
  validationError,
  onBrowseClick,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onClearFile,
  fileInputRef,
  isProcessing,
  requestActive,
  hasResults,
  metrics,
  mode,
  totalIssues,
  wordCount,
  labelCounts,
  onOpenRevisionFromLabel,
  processingLabel
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse the billboard after marking results arrive
  useEffect(() => {
    if (hasResults && selectedFile) {
      const timer = setTimeout(() => setCollapsed(true), 1800);
      return () => clearTimeout(timer);
    }
    setCollapsed(false);
  }, [hasResults, selectedFile]);

  // Four phases: default → selected → processing → collapsed
  let phase = "default";
  if (collapsed && hasResults && selectedFile) phase = "collapsed";
  else if (isProcessing || (hasResults && selectedFile)) phase = "processing";
  else if (selectedFile) phase = "selected";

  const title = {
    collapsed: "Mark another essay",
    processing: processingLabel || "Marking...",
    selected: "Ready to mark",
    default: "Drop essay here",
  }[phase];

  const showSubtitle = phase === "default";
  const isCompact = phase === "collapsed";

  // ── Cross-fade with vertical motion for title changes ──
  const [displayedTitle, setDisplayedTitle] = useState(title);
  const [titleTransition, setTitleTransition] = useState("");
  const transitionRef = useRef(null);

  useEffect(() => {
    if (title === displayedTitle) return;
    // Phase 1: Exit — fade out + slide up
    setTitleTransition("dz-title--exiting");
    transitionRef.current = setTimeout(() => {
      // Phase 2: Pre-enter — reposition below (no transition)
      setTitleTransition("dz-title--pre-enter");
      setDisplayedTitle(title);
      // Phase 3: Enter — animate to final position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTitleTransition("");
        });
      });
    }, 350);
    return () => clearTimeout(transitionRef.current);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Raw score (before curve) — used for point-loss calculations
  // Wait until precision score is available so the displayed score never jumps.
  const rawScore = useMemo(() => {
    if (!metrics || !wordCount) return null;
    if (metrics.precision?.score == null) return null;
    const hideCohesion = mode === "peel_paragraph";
    const scores = [
      metrics.power?.score,
      metrics.variety?.score,
      hideCohesion ? null : metrics.cohesion?.score,
      metrics.precision?.score
    ].filter((s) => s != null);
    if (!scores.length) return null;
    const rawAverage = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Short essay penalty: essays under 400 words lose up to ~12 pts
    const words = wordCount || 0;
    const lengthPenalty = words > 0 && words < 400 ? Math.round((400 - words) * 0.03) : 0;

    return Math.max(0, rawAverage - lengthPenalty);
  }, [metrics, mode, wordCount]);

  // Displayed score — square root curve lifts mid-range while preserving 0 and 100
  const averageScore = useMemo(() => {
    if (rawScore === null) return null;
    return Math.round(Math.sqrt(rawScore / 100) * 100);
  }, [rawScore]);

  // Displayed score — updates whenever the computed average changes
  // (e.g. after a Recheck) and resets when results are cleared.
  const [lockedScore, setLockedScore] = useState(null);
  useEffect(() => {
    if (!hasResults) { setLockedScore(null); return; }
    if (averageScore !== null) setLockedScore(averageScore);
  }, [hasResults, averageScore]);

  // Determine which critical/moderate labels are active for the tier badge
  const tierInfo = useMemo(() => {
    if (!labelCounts) return null;
    const critical = OVERALL_CRITICAL_LABELS.filter(
      (l) => (Number(labelCounts[l]) || 0) > 0
    );
    if (critical.length) return { tier: "Critical", labels: critical };
    const moderate = OVERALL_MODERATE_LABELS.filter(
      (l) => (Number(labelCounts[l]) || 0) > 0
    );
    if (moderate.length) return { tier: "Moderate", labels: moderate };
    return null;
  }, [labelCounts]);

  // ── Set response: general statement ──
  const SCORE_MESSAGES = {
    outstanding: [
      "Outstanding — your writing mechanics are exceptional.",
      "Impressive command of writing rules and structure.",
      "Excellent technical skill on display.",
    ],
    excellent: [
      "Excellent mechanics — only minor refinements needed.",
      "Strong technical writing with just a few areas to polish.",
      "Great attention to mechanics and structure.",
    ],
    strong: [
      "Strong writing mechanics overall.",
      "Solid technical skill with some areas to refine.",
      "Good command of writing rules.",
    ],
    good: [
      "Good writing mechanics with some areas to improve.",
      "Solid foundation — a few adjustments will sharpen your writing.",
      "Your mechanics are on the right track.",
    ],
    developing: [
      "Your writing is developing well — keep working on the highlighted areas.",
      "A solid start — focus on the flagged issues to improve.",
      "Good habits forming — the highlighted areas will help you level up.",
    ],
    emerging: [
      "Review the highlighted issues to strengthen your mechanics.",
      "Focus on the flagged areas — each fix makes a difference.",
      "Several areas to work on — start with the most common issues.",
    ],
    struggling: [
      "Work through the highlighted issues to build stronger mechanics.",
      "Focus on the most common issues first.",
      "Review each highlighted area carefully.",
    ],
    beginning: [
      "Start by addressing the critical issues flagged in your essay.",
      "Focus on one issue at a time — each fix will improve your writing.",
      "Work through the highlighted areas step by step.",
    ],
  };

  const setResponse = useMemo(() => {
    if (lockedScore === null) return null;

    // Pick score tier
    let tier;
    if (lockedScore >= 95) tier = "outstanding";
    else if (lockedScore >= 90) tier = "excellent";
    else if (lockedScore >= 85) tier = "strong";
    else if (lockedScore >= 80) tier = "good";
    else if (lockedScore >= 75) tier = "developing";
    else if (lockedScore >= 70) tier = "emerging";
    else if (lockedScore >= 60) tier = "struggling";
    else tier = "beginning";

    const msgs = SCORE_MESSAGES[tier];
    return msgs[lockedScore % msgs.length];
  }, [lockedScore]);

  return (
    <section className={`card upload-card${isCompact ? " upload-card--collapsed" : ""}`}>
      <div
        id="dropZone"
        className={`drop-zone${isDragOver ? " dragover" : ""}${isCompact ? " drop-zone--compact" : ""}`}
        tabIndex={0}
        role="button"
        aria-label="Upload .docx or .pdf file"
        onClick={onBrowseClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowseClick();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragOver ? (
          <div className="dropzone-overlay" />
        ) : null}
        <div className={`dz-icon-slot${phase !== "default" ? " dz-icon-slot--hidden" : ""}`} aria-hidden="true">
          <img
            className="dz-icon"
            src="/assets/cloud-upload.svg"
            alt=""
          />
        </div>
        <div className={`dz-title${isCompact ? " dz-title--compact" : ""}${titleTransition ? ` ${titleTransition}` : ""}`}>
          {displayedTitle}
        </div>
        <div className={`dz-sub${showSubtitle ? "" : " dz-sub--hidden"}`}>
          or click to browse
        </div>
        <input
          ref={fileInputRef}
          type="file"
          id="fileInput"
          name="file"
          accept=".docx,.pdf"
          hidden
          onChange={onFileChange}
        />
      </div>

      {selectedFile ? (
        <div className="dz-file-row dz-enter">
          <span className="dz-file-pill" title={selectedFile.name}>
            <span className="dz-file-icon" aria-hidden="true"><FileText size={14} /></span>
            <span className="dz-file-name">{selectedFile.name}</span>
          </span>
          <button
            type="button"
            className="dz-clear-btn"
            onClick={onClearFile}
            aria-label="Remove file"
            title="Remove file"
          >
            ✕
          </button>
        </div>
      ) : null}
      {selectedFile && (!hasResults || isProcessing) ? (
        <div className="dz-submit-row dz-enter">
          <button
            className={`primary-btn${isProcessing ? " is-loading loading-cursor" : ""}`}
            id="checkBtn"
            type="submit"
            disabled={!selectedFile || isProcessing || requestActive}
          >
            {isProcessing ? "Processing" : "Mark my essay"}
          </button>
        </div>
      ) : null}

      {validationError ? <div className="dropzone-error">{validationError}</div> : null}


      {isCompact && lockedScore !== null ? (
        <div className="dz-score-pill dz-enter">
          <span className="dz-score-value">Score {lockedScore}%</span>
          {setResponse ? (
            <p className="dz-set-response">{setResponse}</p>
          ) : null}
          <div className="dz-pill-actions">
            {tierInfo ? (
              <button
                type="button"
                className={`dz-tier-badge dz-tier-badge--${tierInfo.tier.toLowerCase()}`}
                title={tierInfo.labels.join(", ")}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRevisionFromLabel?.(tierInfo.labels[0]);
                }}
              >
                {tierInfo.tier} Issue
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
