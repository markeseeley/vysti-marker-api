/**
 * MobileApp — Single mobile experience for all Vysti users.
 *
 * Replaces App/TeacherApp/WriteApp on phones.
 * Flow: Camera → OCR → Review → Mark → Results (score, issues, doc thumbnail)
 * No editing, no revision, no download — just snap, mark, view, share.
 *
 * Limits: 5 total mobile marks, 2 per day, 15-page OCR cap.
 * Same experience for free and paid users on mobile.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./MobileApp.css";
import { useAuthSession } from "./hooks/useAuthSession";
import CameraDropZone from "./components/CameraDropZone";
import TranscriptionReview from "./components/TranscriptionReview";
import PaywallModal from "./components/PaywallModal";
import { useDocxPreview } from "./hooks/useDocxPreview";
import { transcribeImages } from "./services/ocrService";
import { markText } from "./services/markEssay";
import { buildMarkTextPayload as buildPayload } from "@shared/markingApi";
import { logEvent, logError } from "./lib/logger";
import {
  OVERALL_CRITICAL_LABELS,
  OVERALL_MODERATE_LABELS,
} from "./lib/studentMetrics";

// ── Score helpers ──

const SCORE_TIERS = [
  [95, "outstanding", "Outstanding — your writing mechanics are exceptional."],
  [90, "excellent", "Excellent mechanics — only minor refinements needed."],
  [85, "strong", "Strong writing mechanics overall."],
  [80, "good", "Good writing mechanics with some areas to improve."],
  [75, "developing", "Your writing is developing — keep working on the highlighted areas."],
  [70, "emerging", "Review the highlighted issues to strengthen your mechanics."],
  [60, "struggling", "Work through the highlighted issues to build stronger mechanics."],
  [0, "beginning", "Start by addressing the critical issues flagged in your essay."],
];

function getTier(score) {
  for (const [min, key, msg] of SCORE_TIERS) {
    if (score >= min) return { key, msg };
  }
  return SCORE_TIERS[SCORE_TIERS.length - 1];
}

// ── Desktop nudge messages (rotate in results view) ──
const DESKTOP_NUDGES = [
  "On desktop, you can revise your essay and recheck your score instantly.",
  "Vysti highlights exactly where each issue is — edit and improve on desktop or tablet.",
  "Teachers: upload an entire class's essays at once on desktop.",
  "Watch your score climb in real time as you fix issues on desktop.",
];

// ── Phase type: "upload" | "transcribing" | "review" | "marking" | "results" ──

export default function MobileApp() {
  const { supa, isChecking, entitlement, redirectToSignin } = useAuthSession();
  const [phase, setPhase] = useState("upload");
  const [ocrPages, setOcrPages] = useState(null);
  const [ocrError, setOcrError] = useState("");
  const [markError, setMarkError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Mobile marks tracking (from /api/profile)
  const mobileMarksUsed = entitlement?.mobile_marks_used ?? 0;
  const mobileMarksLimit = entitlement?.mobile_marks_limit ?? 5;
  const marksRemaining = Math.max(0, mobileMarksLimit - mobileMarksUsed);

  // Result state
  const [markedBlob, setMarkedBlob] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [labelCounts, setLabelCounts] = useState(null);
  const [wordCount, setWordCount] = useState(null);
  const [totalIssues, setTotalIssues] = useState(0);

  // Doc preview
  const previewRef = useRef(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  // Render the marked doc into the hidden preview container
  useDocxPreview({
    blob: markedBlob,
    zoom: 1,
    containerRef: previewRef,
    onError: () => {},
    onEdit: null, // read-only
  });

  // ── Close menu on outside click / ESC ──
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // ── Auth ──
  const handleSessionExpired = useCallback(() => {
    redirectToSignin(window.location.pathname);
  }, [redirectToSignin]);

  const handleSignOut = useCallback(async () => {
    if (supa) {
      try { await supa.auth.signOut(); } catch {}
    }
    try {
      localStorage.removeItem("vysti_role");
      localStorage.removeItem("vysti_products");
    } catch {}
    window.location.replace(
      `/signin.html?redirect=${encodeURIComponent(window.location.pathname)}`
    );
  }, [supa]);

  // ── Upload → OCR ──
  const handleImagesReady = useCallback(async (imageFiles) => {
    setPhase("transcribing");
    setOcrError("");
    try {
      const result = await transcribeImages({
        supa,
        images: imageFiles,
        mode: "handwritten",
        source: "mobile",
        onSessionExpired: handleSessionExpired,
      });
      setOcrPages(result.pages);
      setPhase("review");
    } catch (err) {
      setOcrError(err.message || "Transcription failed. Please try again.");
      setPhase("upload");
    }
  }, [supa, handleSessionExpired]);

  // ── Review → Mark ──
  const handleConfirmText = useCallback(async (text) => {
    if (!text?.trim()) return;
    setPhase("marking");
    setMarkError("");
    try {
      const payload = {
        ...buildPayload({
          fileName: "handwritten_essay.docx",
          text,
          mode: "textual_analysis",
        }),
        include_summary_table: false,
        return_metadata: true,
        source: "mobile",
      };
      const { blob, metadata } = await markText({
        supa,
        payload,
        onSessionExpired: handleSessionExpired,
        timeoutMs: 90000,
      });
      setMarkedBlob(blob);
      if (metadata?.scores) setMetrics(metadata.scores);
      if (metadata?.label_counts) setLabelCounts(metadata.label_counts);
      if (metadata?.label_counts) {
        const total = Object.values(metadata.label_counts)
          .reduce((sum, n) => sum + (Number(n) || 0), 0);
        setTotalIssues(total);
      }
      setWordCount(metadata?.word_count || text.split(/\s+/).filter(Boolean).length);
      setPhase("results");
      logEvent("mobile_mark_success");
    } catch (err) {
      if (err?.isEntitlementError || err?.code === "MOBILE_LIMIT") {
        logEvent("mobile_paywall_shown");
        setShowPaywall(true);
        setPhase("upload");
      } else if (err?.message?.includes("Daily mobile limit")) {
        setMarkError("You've reached your daily limit. Try again tomorrow, or use the full desktop version.");
        setPhase("review");
      } else {
        logError("Mobile mark failed", { error: err?.message });
        setMarkError(err?.message || "Marking failed. Please try again.");
        setPhase("review");
      }
    }
  }, [supa, handleSessionExpired]);

  // ── Back to camera ──
  const handleBackToCapture = useCallback(() => {
    if (ocrPages) {
      ocrPages.forEach((p) => {
        if (p.imageUrl) URL.revokeObjectURL(p.imageUrl);
      });
    }
    setOcrPages(null);
    setPhase("upload");
  }, [ocrPages]);

  // ── Start over (from results) ──
  const handleStartOver = useCallback(() => {
    setMarkedBlob(null);
    setMetrics(null);
    setLabelCounts(null);
    setWordCount(null);
    setTotalIssues(0);
    setOcrPages(null);
    setMarkError("");
    setOcrError("");
    setPhase("upload");
  }, []);

  // ── Score calculation ──
  const displayScore = useMemo(() => {
    if (!metrics || !wordCount) return null;
    if (metrics.precision?.score == null) return null;
    const scores = [
      metrics.power?.score,
      metrics.variety?.score,
      metrics.cohesion?.score,
      metrics.precision?.score,
    ].filter((s) => s != null);
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const words = wordCount || 0;
    const penalty = words > 0 && words < 400 ? Math.round((400 - words) * 0.03) : 0;
    const raw = Math.max(0, avg - penalty);
    return Math.round(Math.sqrt(raw / 100) * 100);
  }, [metrics, wordCount]);

  const tier = displayScore !== null ? getTier(displayScore) : null;

  // ── Top issues ──
  const topIssues = useMemo(() => {
    if (!labelCounts) return [];
    return Object.entries(labelCounts)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([label, count]) => ({ label, count: Number(count) }));
  }, [labelCounts]);

  const severity = useMemo(() => {
    if (!labelCounts) return null;
    if (OVERALL_CRITICAL_LABELS.some((l) => (Number(labelCounts[l]) || 0) > 0)) return "critical";
    if (OVERALL_MODERATE_LABELS.some((l) => (Number(labelCounts[l]) || 0) > 0)) return "moderate";
    return null;
  }, [labelCounts]);

  // ── Share (native) ──
  const handleShare = useCallback(async () => {
    const shareText = displayScore !== null
      ? `I just scored ${displayScore}% on my essay. Check yours at vysti.org`
      : "Check your essay writing at vysti.org";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vysti Essay Score", text: shareText });
        logEvent("mobile_share");
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {}
  }, [displayScore]);

  // ── Desktop nudge (deterministic per session) ──
  const nudgeMessage = useMemo(
    () => DESKTOP_NUDGES[mobileMarksUsed % DESKTOP_NUDGES.length],
    [mobileMarksUsed]
  );

  // ── Countdown messaging ──
  const countdownMessage = useMemo(() => {
    if (marksRemaining <= 0) return null;
    if (marksRemaining === 1) return "Last free mark — upgrade for unlimited marks and the full revision experience.";
    if (marksRemaining === 2) return "2 marks remaining — Vysti does more than mark. Edit, revise, and improve your score on desktop.";
    return null;
  }, [marksRemaining]);

  // ── Loading state ──
  if (isChecking) {
    return (
      <div className="mob-app">
        <div className="mob-loading">
          <div className="mob-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="mob-app">
      {/* ── Header ── */}
      <header className="mob-header">
        <img
          src="/assets/logo.svg"
          alt="Vysti"
          className="mob-header-logo"
        />

        {/* Hamburger menu */}
        <div className="mob-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="mob-menu-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>
          {menuOpen && (
            <div className="mob-menu">
              <a href="/profile_react.html" className="mob-menu-item">
                Profile
              </a>
              <button
                type="button"
                className="mob-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setShowPaywall(true);
                }}
              >
                Subscribe
              </button>
              <div className="mob-menu-divider" />
              <button
                type="button"
                className="mob-menu-item mob-menu-item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Paywall Modal ── */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        returnPath={window.location.pathname}
      />

      {/* ── Desktop nudge ── */}
      {phase === "upload" && (
        <div className="mob-desktop-banner">
          For the full editing and revision experience, open Vysti on a computer or tablet.
        </div>
      )}

      {/* ── Upload phase ── */}
      {phase === "upload" && (
        <section className="mob-card">
          <h1 className="mob-card-title">Mark your essay</h1>
          <p className="mob-card-sub">Take a photo of your handwritten essay to get instant feedback.</p>

          {marksRemaining <= 0 ? (
            /* All marks used — paywall */
            <div className="mob-marks-exhausted">
              <p className="mob-marks-exhausted-title">You've used all 5 free marks</p>
              <p className="mob-marks-exhausted-sub">
                Subscribe to keep marking on mobile, plus unlock the full desktop experience — revision tools, score tracking, and unlimited marks.
              </p>
              <button
                type="button"
                className="mob-btn mob-btn-primary"
                onClick={() => {
                  logEvent("mobile_exhausted_upgrade_tap");
                  setShowPaywall(true);
                }}
              >
                See Plans
              </button>
            </div>
          ) : (
            <>
              {/* Countdown badge */}
              <div className={`mob-countdown ${marksRemaining <= 2 ? "mob-countdown--warn" : ""}`}>
                {marksRemaining} mark{marksRemaining !== 1 ? "s" : ""} remaining
              </div>

              {/* Contextual nudge at 2 or 1 remaining */}
              {countdownMessage && (
                <p className="mob-countdown-msg">{countdownMessage}</p>
              )}

              <CameraDropZone onImagesReady={handleImagesReady} disabled={false} />
            </>
          )}
          {ocrError && <div className="mob-error">{ocrError}</div>}
        </section>
      )}

      {/* ── Transcribing phase ── */}
      {phase === "transcribing" && (
        <section className="mob-card mob-center">
          <div className="mob-spinner" />
          <p className="mob-status-title">Reading your handwriting...</p>
          <p className="mob-status-sub">This may take a few seconds per page</p>
        </section>
      )}

      {/* ── Review phase ── */}
      {phase === "review" && ocrPages && (
        <section className="mob-card">
          <TranscriptionReview
            pages={ocrPages}
            onConfirm={handleConfirmText}
            onBack={handleBackToCapture}
          />
          {markError && <div className="mob-error">{markError}</div>}
        </section>
      )}

      {/* ── Marking phase ── */}
      {phase === "marking" && (
        <section className="mob-card mob-center">
          <div className="mob-spinner" />
          <p className="mob-status-title">Marking your essay...</p>
          <p className="mob-status-sub">Analyzing writing mechanics</p>
        </section>
      )}

      {/* ── Results phase ── */}
      {phase === "results" && (
        <>
          {/* Score */}
          {displayScore !== null && (
            <section className="mob-card mob-center mob-score-card">
              <div className="mob-score">{displayScore}%</div>
              {tier && <p className="mob-tier-msg">{tier.msg}</p>}
            </section>
          )}

          {/* Stats row */}
          <div className="mob-stats-row">
            <div className="mob-stat">
              <span className="mob-stat-value">{totalIssues}</span>
              <span className="mob-stat-label">Total Issues</span>
            </div>
            <div className="mob-stat">
              <span className="mob-stat-value">{wordCount || "\u2014"}</span>
              <span className="mob-stat-label">Words</span>
            </div>
            {topIssues.length > 0 && (
              <div className="mob-stat mob-stat--wide">
                <span className="mob-stat-value mob-stat-value--text">{topIssues[0].label}</span>
                <span className="mob-stat-label">Top Issue ({topIssues[0].count})</span>
              </div>
            )}
          </div>

          {/* Severity badge */}
          {severity && (
            <div className={`mob-severity mob-severity--${severity}`}>
              {severity === "critical" ? "Critical" : "Moderate"} issue detected
            </div>
          )}

          {/* Top issues list */}
          {topIssues.length > 1 && (
            <section className="mob-card">
              <h3 className="mob-section-title">Issues Found</h3>
              <ul className="mob-issue-list">
                {topIssues.map(({ label, count }) => (
                  <li key={label} className="mob-issue-item">
                    <span className="mob-issue-label">{label}</span>
                    <span className="mob-issue-count">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Doc thumbnail → fullscreen */}
          <section className="mob-card">
            <h3 className="mob-section-title">Marked Essay</h3>
            <button
              type="button"
              className="mob-doc-thumbnail"
              onClick={() => setPreviewFullscreen(true)}
              aria-label="View marked essay"
            >
              <div className="mob-doc-thumbnail-inner" ref={previewRef} />
              <div className="mob-doc-thumbnail-overlay">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
                <span>Tap to view full essay</span>
              </div>
            </button>
          </section>

          {/* Fullscreen preview modal */}
          {previewFullscreen && (
            <div
              className="mob-fullscreen-overlay"
              onClick={() => setPreviewFullscreen(false)}
            >
              <div
                className="mob-fullscreen-doc"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mob-fullscreen-header">
                  <h3 className="mob-fullscreen-title">Marked Essay</h3>
                  <button
                    type="button"
                    className="mob-fullscreen-close"
                    onClick={() => setPreviewFullscreen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div
                  className="mob-fullscreen-content"
                  dangerouslySetInnerHTML={{
                    __html: previewRef.current?.innerHTML || "",
                  }}
                />
              </div>
            </div>
          )}

          {/* Share */}
          <div className="mob-actions">
            <button
              type="button"
              className="mob-btn mob-btn-primary"
              onClick={handleShare}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share my score
            </button>
          </div>

          {/* Desktop nudge (contextual, rotates) */}
          <div className="mob-desktop-cta">
            <p className="mob-desktop-cta-title">There's more to Vysti</p>
            <p className="mob-desktop-cta-sub">{nudgeMessage}</p>
          </div>

          {/* Upgrade CTA */}
          <div className="mob-upgrade-cta">
            <p className="mob-upgrade-cta-title">
              {totalIssues > 0
                ? "Fix these issues and watch your score climb"
                : "Get the full Vysti experience"}
            </p>
            <p className="mob-upgrade-cta-sub">
              On desktop, you can revise your essay, recheck your score, and download your marked document.
            </p>
            <button
              type="button"
              className="mob-btn mob-btn-primary"
              onClick={() => {
                logEvent("mobile_results_upgrade_tap");
                setShowPaywall(true);
              }}
            >
              See Plans
            </button>
          </div>

          {/* Start over */}
          {marksRemaining > 0 ? (
            <button
              type="button"
              className="mob-btn mob-btn-ghost mob-start-over"
              onClick={handleStartOver}
            >
              Mark another essay
            </button>
          ) : (
            <div className="mob-marks-exhausted-inline">
              <p>No free marks remaining.</p>
              <button
                type="button"
                className="mob-btn mob-btn-primary"
                onClick={() => setShowPaywall(true)}
              >
                Subscribe for unlimited marks
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
