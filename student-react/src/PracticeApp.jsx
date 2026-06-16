import { useState, useCallback, useRef, useEffect } from "react";
import PreviewMetrics from "./components/PreviewMetrics.jsx";
import PracticeRevisionPanel from "./components/PracticeRevisionPanel.jsx";
import { fetchRandomEssay } from "./services/practiceEssay.js";
import "./PracticeApp.css";

export default function PracticeApp() {
  /* ── Essay state ── */
  const [markedBlob, setMarkedBlob] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Preview ── */
  const previewRef = useRef(null);
  const [zoom, setZoom] = useState(1.1);

  /* ── Derived from metadata ── */
  const metrics = metadata?.scores || null;
  const labelCounts = metadata?.label_counts || {};
  const issues = metadata?.issues || [];
  const examples = metadata?.examples || [];

  /* ── Load a random essay ── */
  const loadEssay = useCallback(async () => {
    setLoading(true);
    setError("");
    setMarkedBlob(null);
    setMetadata(null);
    try {
      const result = await fetchRandomEssay();
      setMarkedBlob(result.blob);
      setMetadata(result.metadata);
      setFilename(result.filename);
    } catch (err) {
      setError(err.message || "Failed to load practice essay.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Auto-load on mount */
  useEffect(() => {
    loadEssay();
  }, [loadEssay]);

  /* ── Render docx preview ── */
  useEffect(() => {
    let active = true;
    const el = previewRef.current;
    if (!el) return undefined;
    (async () => {
      el.innerHTML = "";
      if (!markedBlob) return;
      try {
        const buf = await markedBlob.arrayBuffer();
        if (!active) return;
        const renderAsync =
          window.docx?.renderAsync || window.docxPreview?.renderAsync;
        if (renderAsync) {
          await renderAsync(buf, el, null, { inWrapper: true });
          if (!active) return;
          el.contentEditable = "true";
          el.spellcheck = true;
          el.classList.add("preview-editable");
          el.style.zoom = zoom;
        } else {
          el.innerHTML = "<p>Preview not available.</p>";
        }
      } catch (err) {
        console.error("Failed to render preview", err);
        if (active) el.innerHTML = "<p>Error rendering preview.</p>";
      }
    })();
    return () => { active = false; };
  }, [markedBlob, previewRef]);

  useEffect(() => {
    const el = previewRef.current;
    if (el) el.style.zoom = zoom;
  }, [zoom, previewRef]);

  return (
    <div className="student-react-shell student-page">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <img src="/assets/logo.svg" alt="Vysti" />
        </div>
        <nav>
          <a href="/mark" title="Upload and grade student essays">Mark</a>
          <a href="/revise" title="Upload your essay for feedback">Revise</a>
          <a href="/practice.html" className="active" title="Practice revising a real essay">Practice</a>
          <a href="/progress" title="Track your writing progress">Progress</a>
        </nav>
        <div className="actions" />
      </header>

      {/* Main content */}
      <div className="practice-essay-content">
        {/* Loading state */}
        {loading && (
          <div className="practice-loading">
            <div className="practice-spinner" />
            <p>Loading a practice essay...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="practice-error">
            <p>{error}</p>
            <button className="practice-next-btn" onClick={loadEssay}>
              Try Again
            </button>
          </div>
        )}

        {/* Essay loaded — show Preview + Metrics + Revision */}
        {markedBlob && !loading && (
          <>
            {/* Metrics + Preview card wrapped in a single card (matches student_react) */}
            <section className="card marked-preview-card">
              {metrics && (
                <PreviewMetrics
                  metrics={metrics}
                  labelCounts={labelCounts}
                  issues={issues}
                  collapsed={false}
                  onToggleDetails={() => {}}
                  onOpenInfo={() => {}}
                  onOpenPowerVerbs={() => {}}
                  onUpdatePowerVerbTarget={() => {}}
                  onNavigateToExample={() => {}}
                  onNavigateToPreviewSentence={() => {}}
                  onJumpPowerVerb={() => {}}
                  onToggleRepetition={() => {}}
                  onHighlightVarietyParagraph={() => {}}
                  onHighlightTechniquesParagraph={() => {}}
                  onOpenRevisionFromLabel={() => {}}
                  onScrollToPreview={() => {}}
                  onLogPreviewHighlights={() => {}}
                  onShowPillHint={() => {}}
                  onScanAllTechniques={() => {}}
                  mode="textual_analysis"
                />
              )}

              {/* Preview */}
              <div className="preview-header" id="previewCardHeader">
                <h2 className="preview-title">Preview</h2>
                <div className="preview-header-right">
                  <div className="preview-tools">
                    <label className="preview-zoom" htmlFor="previewZoom">
                      <span>Zoom</span>
                      <select
                        id="previewZoom"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                      >
                        <option value={0.8}>80%</option>
                        <option value={0.9}>90%</option>
                        <option value={1}>100%</option>
                        <option value={1.1}>110%</option>
                        <option value={1.25}>125%</option>
                        <option value={1.5}>150%</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div
                id="markedPreview"
                ref={previewRef}
                className="marked-preview-container"
              />
            </section>

            {/* Revision panel */}
            <PracticeRevisionPanel
              issues={issues}
              examples={examples}
              labelCounts={labelCounts}
              previewRef={previewRef}
              mode="textual_analysis"
            />

            {/* Try another / CTA */}
            <div className="practice-essay-actions">
              <button className="practice-next-btn" onClick={loadEssay}>
                Try Another Essay
              </button>
              <a href="/revise" className="practice-cta-btn">
                Mark Your Own Essay
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
