import { useDocxPreview } from "../hooks/useDocxPreview";
import PreviewMetrics from "./PreviewMetrics";
import PreviewHintDock from "./PreviewHintDock";

export default function PreviewPanel({
  markedBlob,
  zoom,
  onZoomChange,
  previewRef,
  onRecheck,
  isRechecking,
  isProcessing,
  onEdit,
  onDownloadMarked,
  onDownloadRevised,
  isDownloading,
  hasRevisedSinceMark,
  wordCount,
  totalIssues,
  metrics,
  metricsCollapsed,
  onToggleMetricsDetails,
  onOpenMetricInfo,
  onOpenPillHint,
  onOpenPowerVerbs,
  hint,
  onDismissHint,
  mode,
  previewError,
  previewErrorStack,
  showDebug,
  onClearPreview,
  onPreviewError
}) {
  useDocxPreview({
    blob: markedBlob,
    zoom,
    containerRef: previewRef,
    onEdit,
    onError: onPreviewError
  });

  return (
    <section
      className="card marked-preview-card"
      id="markedPreviewCard"
      style={{ display: markedBlob ? "block" : "none" }}
    >
      <div className="preview-header">
        <h2 className="preview-title">Preview</h2>

        <div className="preview-header-right">
          {markedBlob ? (
            <div className="preview-header-stats">
              <div className="preview-header-stats-row">
                <div className="student-stat preview-stat">
                  <div className="student-stat-label">Word count</div>
                  <div className="student-stat-value">{wordCount ?? "—"}</div>
                </div>
                <div className="student-stat preview-stat">
                  <div className="student-stat-label">Total issues</div>
                  <div className="student-stat-value">{totalIssues ?? "—"}</div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="preview-tools">
            <label className="preview-zoom" htmlFor="previewZoom">
              <span>Zoom</span>
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
            <button
              type="button"
              className="preview-pill-btn"
              id="previewPowerVerbsBtn"
              aria-label="Open Power Verbs"
              onClick={onOpenPowerVerbs}
            >
              <span className="preview-pill-icon" aria-hidden="true">
                📘
              </span>
              Power Verbs
            </button>
          </div>
        </div>
      </div>
      {markedBlob ? (
        <PreviewMetrics
          metrics={metrics}
          collapsed={metricsCollapsed}
          onToggleDetails={onToggleMetricsDetails}
          onOpenInfo={onOpenMetricInfo}
          onOpenPillHint={onOpenPillHint}
          mode={mode}
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
        <div className="preview-stage">
          <PreviewHintDock hint={hint} onDismiss={onDismissHint} />
          <div id="markedPreview" ref={previewRef} className="marked-preview-container"></div>
        </div>
      )}
      <div className="preview-actions">
        <button
          type="button"
          className={`primary-btn${isRechecking ? " is-loading loading-cursor" : ""}`}
          id="recheckDocumentBtn"
          onClick={onRecheck}
          disabled={!markedBlob || isRechecking || isProcessing || Boolean(previewError)}
        >
          {isRechecking ? "Processing" : "Recheck my essay"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          id="downloadBtn"
          onClick={onDownloadMarked}
          disabled={!markedBlob || isProcessing}
        >
          Download marked essay
        </button>
        <button
          type="button"
          className={`secondary-btn${isDownloading ? " is-loading loading-cursor" : ""}`}
          onClick={() => onDownloadRevised?.()}
          disabled={
            !markedBlob ||
            !hasRevisedSinceMark ||
            isDownloading ||
            isProcessing ||
            Boolean(previewError)
          }
          title={
            !hasRevisedSinceMark && markedBlob
              ? "Make at least one change in Preview to enable download"
              : ""
          }
        >
          {isDownloading ? "Preparing" : "Download revised essay"}
        </button>
      </div>
      {!hasRevisedSinceMark && markedBlob ? (
        <p className="helper-text">
          Make at least one change in Preview to enable download.
        </p>
      ) : null}
    </section>
  );
}
