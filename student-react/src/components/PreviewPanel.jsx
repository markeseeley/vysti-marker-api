import { useDocxPreview } from "../hooks/useDocxPreview";

export default function PreviewPanel({
  markedBlob,
  zoom,
  onZoomChange,
  previewRef,
  onRecheck,
  isRechecking
}) {
  useDocxPreview({
    blob: markedBlob,
    zoom,
    containerRef: previewRef
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
      </div>
    </section>
  );
}
