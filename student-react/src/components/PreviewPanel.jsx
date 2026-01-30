import { useDocxPreview } from "../hooks/useDocxPreview";

export default function PreviewPanel({
  markedBlob,
  zoom,
  onZoomChange,
  previewRef,
  onRecheck,
  isRechecking,
  onEdit,
  onDownloadRevised,
  isDownloading,
  hasRevisedSinceMark
}) {
  useDocxPreview({
    blob: markedBlob,
    zoom,
    containerRef: previewRef,
    onEdit
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
          </div>
        </div>
      </div>
      <div id="markedPreview" ref={previewRef} className="marked-preview-container"></div>
      <div className="preview-actions">
        <button
          type="button"
          className={`primary-btn${isRechecking ? " is-loading loading-cursor" : ""}`}
          id="recheckDocumentBtn"
          onClick={onRecheck}
          disabled={!markedBlob || isRechecking}
        >
          {isRechecking ? "Processing" : "Recheck my essay"}
        </button>
        <button
          type="button"
          className={`secondary-btn${isDownloading ? " is-loading loading-cursor" : ""}`}
          onClick={() => onDownloadRevised?.()}
          disabled={!markedBlob || !hasRevisedSinceMark || isDownloading}
        >
          {isDownloading ? "Preparing" : "Download revised essay"}
        </button>
      </div>
      {!hasRevisedSinceMark && markedBlob ? (
        <p className="helper-text">Make an edit in the preview to enable download.</p>
      ) : null}
    </section>
  );
}
