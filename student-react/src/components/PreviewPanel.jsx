import { useState, useEffect, useRef, useMemo } from "react";
import { useDocxPreview } from "../hooks/useDocxPreview";
import PreviewMetrics from "./PreviewMetrics";
import PreviewHintDock from "./PreviewHintDock";
import LexisModal from "./LexisModal";
import PreviewToolbar from "./PreviewToolbar";
import SelectionPopover from "./SelectionPopover";
import DismissedIssuesPanel from "./DismissedIssuesPanel";
import { Search, Download } from "./Icons";
import { downloadBlob } from "@shared/download";
import { MODES } from "../config";

const PLACEHOLDER_WORKS = [
  { author: "Toni Morrison", title: "Beloved" },
  { author: "Gabriel García Márquez", title: "One Hundred Years of Solitude" },
  { author: "Sylvia Plath", title: "Lady Lazarus" },
  { author: "William Shakespeare", title: "Hamlet" },
  { author: "Mary Shelley", title: "Frankenstein" },
  { author: "F. Scott Fitzgerald", title: "The Great Gatsby" },
  { author: "Chinua Achebe", title: "Things Fall Apart" },
  { author: "Margaret Atwood", title: "The Handmaid's Tale" },
  { author: "Kazuo Ishiguro", title: "Never Let Me Go" },
  { author: "Emily Dickinson", title: "Because I could not stop for Death" },
];

export default function PreviewPanel({
  isTeacher = false,
  markedBlob,
  zoom,
  onZoomChange,
  previewRef,
  labelCounts,
  issues,
  onNavigateToPreviewSentence,
  onJumpPowerVerb,
  onToggleRepetition,
  onHighlightVarietyParagraph,
  onHighlightTechniquesParagraph,
  onScrollToPreview,
  onOpenRevisionFromLabel,
  onRecheck,
  isRechecking,
  isProcessing,
  onEdit,
  onDownloadMarked,
  onDownloadRevised,
  isDownloading,
  hasRevisedSinceMark,
  worksChanged,
  wordCount,
  totalIssues,
  markMetadata,
  metrics,
  metricsCollapsed,
  onToggleMetricsDetails,
  onOpenMetricInfo,
  onOpenPowerVerbs,
  onUpdatePowerVerbTarget,
  hint,
  onDismissHint,
  onShowPillHint,
  mode,
  previewError,
  previewErrorStack,
  showDebug,
  onClearPreview,
  onPreviewError,
  selectedFileName,
  works,
  activeWorkIndex,
  onWorksChange,
  onActiveWorkIndexChange,
  highlightResetKey,
  onLabelDismiss,
  onRefocus,
  onRendered,
  savedHtml,
  onUndo,
  onBeforeEdit,
  dismissedIssues,
  onUndismiss,
  onSaveProgress,
  saveProgressState,
  lastSavedAt,
  saveProgressEnabled,
  onFinishReview,
  reviewStatus,
  toolkitEnabled,
  onToolkitChange,
  onScanAllTechniques,
  entitlement,
  onPaywall,
}) {
  const [isLexisModalOpen, setIsLexisModalOpen] = useState(false);
  const [isDismissedPanelOpen, setIsDismissedPanelOpen] = useState(false);
  const dismissedBtnRef = useRef(null);

  const detectedLexis = markMetadata?.detected_lexis || [];
  const dismissedCount = (dismissedIssues || []).filter(
    (r) => r?.file_name === selectedFileName
  ).length;

  // ── Randomized placeholders (stable per mount) ──
  const placeholder = useMemo(() => {
    const idx = Math.floor(Math.random() * PLACEHOLDER_WORKS.length);
    return PLACEHOLDER_WORKS[idx];
  }, []);

  // ── Multi-work helpers ──
  const activeWork = works?.[activeWorkIndex] || works?.[0] || { author: "", title: "", isMinor: true };
  const worksLen = works?.length || 1;
  const canAddWork = worksLen < 3 && (activeWork.author.trim() || activeWork.title.trim());

  const updateWork = (index, field, value) => {
    const next = (works || []).map((w, i) => i === index ? { ...w, [field]: value } : w);
    onWorksChange?.(next);
  };
  const addWork = () => {
    if (worksLen >= 3) return;
    const next = [...(works || []), { author: "", title: "", isMinor: true }];
    onWorksChange?.(next);
    onActiveWorkIndexChange?.(next.length - 1);
  };
  const removeWork = (index) => {
    if (index === 0 || worksLen <= 1) return;
    const next = (works || []).filter((_, i) => i !== index);
    onWorksChange?.(next);
    if (activeWorkIndex >= next.length) onActiveWorkIndexChange?.(next.length - 1);
    else if (activeWorkIndex === index) onActiveWorkIndexChange?.(Math.max(0, index - 1));
  };

  const handleLabelClick = (label, element) => {
    if (onLabelDismiss) {
      onLabelDismiss(label, element);
    } else if (onOpenRevisionFromLabel) {
      onOpenRevisionFromLabel(label);
    }
  };

  // Fade out preview when recheck starts — useDocxPreview removes the class after re-render
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    if (isRechecking) {
      container.classList.add("preview-fading");
    }
  }, [isRechecking, previewRef]);

  useDocxPreview({
    blob: markedBlob,
    zoom,
    containerRef: previewRef,
    onEdit,
    onError: onPreviewError,
    onLabelClick: handleLabelClick,
    onRendered,
    savedHtml,
    isTeacher,
  });

  const logPreviewHighlights = () => {
    // No-op: debug logging removed for production
  };


  return (
    <section
      className={`card marked-preview-card${markedBlob ? " results-enter" : ""}`}
      id="markedPreviewCard"
      style={{ display: markedBlob ? "block" : "none" }}
    >
      <div className="preview-header">
        <div className="preview-header-right">
          {markedBlob ? (
            <div className="preview-header-stats" id="statsPanel">
              <div className="preview-header-stats-row">
                <div className="student-stat preview-stat">
                  <div className="student-stat-label">Words</div>
                  <div className="student-stat-value" id="wordCountStat">
                    {wordCount ?? "—"}
                  </div>
                </div>
                {!isTeacher && (
                  <div className="student-stat preview-stat">
                    <div className="student-stat-label">Issues</div>
                    <div className="student-stat-value" id="totalIssuesStat">
                      {totalIssues ?? "—"}
                    </div>
                  </div>
                )}
                {detectedLexis.length > 0 && (
                  <button
                    type="button"
                    className="secondary-btn lexis-btn"
                    title="Explore further"
                    onClick={() => setIsLexisModalOpen(true)}
                  >
                    <Search size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Explore
                  </button>
                )}
              </div>
            </div>
          ) : null}
          <div className="preview-tools" style={isTeacher && works ? { display: "flex", flexDirection: "column", gap: "6px" } : undefined}>
            {/* Collapsed chips for non-active works (only when 2+ works) */}
            {worksLen > 1 && (
              <div className="preview-work-chips">
                {(works || []).map((w, i) => {
                  if (i === activeWorkIndex) return null;
                  const detail = [w.author, w.title].filter(Boolean).join(" \u2014 ");
                  return (
                    <div
                      key={i}
                      className="preview-work-chip"
                      onClick={() => onActiveWorkIndexChange?.(i)}
                      title={detail || "Click to edit"}
                    >
                      <span className="preview-work-chip-text">
                        <strong>Work {i + 1}</strong>{detail ? `: ${detail}` : ""}
                      </span>
                      {i > 0 && (
                        <button
                          type="button"
                          className="preview-work-chip-remove"
                          onClick={(e) => { e.stopPropagation(); removeWork(i); }}
                          aria-label={`Remove work ${i + 1}`}
                        >&times;</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active work label (only when 2+ works) */}
            {worksLen > 1 && (
              <div className="preview-work-active-label">Work {activeWorkIndex + 1}</div>
            )}

            {/* Author / Title inputs for the active work */}
            <div className="preview-work-inputs">
              <div className="preview-work-field">
                <div className="preview-work-label">Author</div>
                <input
                  type="text"
                  className="preview-work-input"
                  name="preview-work-author"
                  placeholder={`e.g. ${placeholder.author}`}
                  maxLength={250}
                  value={activeWork.author || ""}
                  onChange={(e) => updateWork(activeWorkIndex, "author", e.target.value)}
                />
              </div>
              <div className="preview-work-field">
                <div className="preview-work-label">Title</div>
                <input
                  type="text"
                  className="preview-work-input"
                  name="preview-work-title"
                  placeholder={`e.g. ${placeholder.title}`}
                  maxLength={300}
                  value={activeWork.title || ""}
                  onChange={(e) => updateWork(activeWorkIndex, "title", e.target.value)}
                />
              </div>
            </div>
            <div className="preview-work-hint-row">
              <span className="preview-work-hint">Did we get it right?</span>
              <div className="preview-work-type-radios">
                <label className="preview-work-type-radio" title="The title of the text must be in double quotation marks.">
                  <input
                    type="radio"
                    name={`workType-${activeWorkIndex}`}
                    checked={activeWork.isMinor === true}
                    onChange={() => updateWork(activeWorkIndex, "isMinor", true)}
                  />
                  <span>Minor work</span>
                </label>
                <label className="preview-work-type-radio" title="The title of the text must be in italics.">
                  <input
                    type="radio"
                    name={`workType-${activeWorkIndex}`}
                    checked={activeWork.isMinor === false}
                    onChange={() => updateWork(activeWorkIndex, "isMinor", false)}
                  />
                  <span>Major work</span>
                </label>
              </div>
            </div>

            {/* Add another text — only when room for more and current has content */}
            {canAddWork && (
              <button type="button" className="preview-work-add-btn" onClick={addWork}>
                + Add another text
              </button>
            )}
          </div>
        </div>
        <div className="preview-zoom-col">
          <label className="preview-zoom" htmlFor="previewZoom">
            <select
              id="previewZoom"
              value={zoom}
              onChange={(event) => onZoomChange(Number(event.target.value))}
            >
              <option value={0.8}>80%</option>
              <option value={0.9}>90%</option>
              <option value={1}>100%</option>
              <option value={1.1}>110%</option>
              <option value={1.25}>125%</option>
              <option value={1.5}>150%</option>
            </select>
          </label>
          {dismissedCount > 0 ? (
            <>
              <button
                ref={dismissedBtnRef}
                type="button"
                className="dismissed-issues-btn"
                onClick={() => setIsDismissedPanelOpen((v) => !v)}
              >
                Dismissed <span className="dismissed-badge">{dismissedCount}</span>
              </button>
              <DismissedIssuesPanel
                isOpen={isDismissedPanelOpen}
                anchorEl={dismissedBtnRef.current}
                dismissedIssues={dismissedIssues}
                fileName={selectedFileName}
                onUndismiss={(records) => {
                  onUndismiss?.(records);
                  setIsDismissedPanelOpen(false);
                }}
                onClose={() => setIsDismissedPanelOpen(false)}
              />
            </>
          ) : null}
        </div>
      </div>
      {markedBlob ? (
        <PreviewMetrics
          metrics={metrics}
          labelCounts={labelCounts}
          collapsed={metricsCollapsed}
          onToggleDetails={onToggleMetricsDetails}
          onOpenInfo={onOpenMetricInfo}
          onOpenPowerVerbs={onOpenPowerVerbs}
          onUpdatePowerVerbTarget={onUpdatePowerVerbTarget}
          issues={issues}
          onNavigateToPreviewSentence={onNavigateToPreviewSentence}
          onJumpPowerVerb={onJumpPowerVerb}
          onToggleRepetition={onToggleRepetition}
          onHighlightVarietyParagraph={onHighlightVarietyParagraph}
          onHighlightTechniquesParagraph={onHighlightTechniquesParagraph}
          onScrollToPreview={onScrollToPreview}
          onOpenRevisionFromLabel={onOpenRevisionFromLabel}
          onLogPreviewHighlights={logPreviewHighlights}
          onShowPillHint={onShowPillHint}
          onScanAllTechniques={onScanAllTechniques}
          mode={mode}
          highlightResetKey={highlightResetKey}
        />
      ) : null}
      {previewError ? (
        <div className="preview-error-panel">
          <p>Preview failed to render.</p>
          <p className="helper-text">Error: {previewError}</p>
          {showDebug && previewErrorStack ? (
            <pre className="preview-error-stack">{previewErrorStack}</pre>
          ) : null}
          <div className="results-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onClearPreview}
            >
              Clear preview
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={onDownloadMarked}
              disabled={!markedBlob}
            >
              Download marked essay
            </button>
          </div>
        </div>
      ) : (
        <>
          <PreviewHintDock hint={hint} onDismiss={onDismissHint} />
          <div className="preview-stage">
            <PreviewToolbar
              previewRef={previewRef}
              onEdit={onEdit}
              onBeforeEdit={onBeforeEdit}
              onRecheck={onRecheck}
              isRechecking={isRechecking}
              hasRevisedSinceMark={hasRevisedSinceMark}
              worksChanged={worksChanged}
              onRefocus={onRefocus}
              onUndo={onUndo}
              onSaveProgress={onSaveProgress}
              saveProgressState={saveProgressState}
              saveProgressEnabled={saveProgressEnabled}
              lastSavedAt={lastSavedAt}
              onFinishReview={onFinishReview}
              reviewStatus={reviewStatus}
              isTeacher={isTeacher}
              onDownloadMarked={onDownloadMarked}
              onDownloadRevised={onDownloadRevised}
              isDownloading={isDownloading}
              markedBlob={markedBlob}
              isProcessing={isProcessing}
              previewError={previewError}

              toolkitEnabled={toolkitEnabled}
              onToolkitChange={onToolkitChange}
              entitlement={entitlement}
              onPaywall={onPaywall}
            />
            <div id="markedPreview" ref={previewRef} className="marked-preview-container"></div>
            {isTeacher && <SelectionPopover previewRef={previewRef} onEdit={onEdit} onBeforeEdit={onBeforeEdit} toolkitEnabled={toolkitEnabled} />}
          </div>
        </>
      )}
      {/* Buttons moved to PreviewToolbar above */}
      <LexisModal
        isOpen={isLexisModalOpen}
        onClose={() => setIsLexisModalOpen(false)}
        detectedLexis={detectedLexis}
        onFindInPreview={(termText) => {
          setIsLexisModalOpen(false);
          if (onScrollToPreview) onScrollToPreview({ clear: true });
          requestAnimationFrame(() => {
            if (onNavigateToPreviewSentence) {
              onNavigateToPreviewSentence({ sentence: termText });
            }
          });
        }}
      />
    </section>
  );
}
