/**
 * TranscriptionReview — Side-by-side review of OCR results.
 *
 * Shows original page images alongside extracted text.
 * Student can edit the text before sending to the marker.
 */

import { useState, useCallback } from "react";

export default function TranscriptionReview({
  pages,          // [{page: 1, text: "...", imageUrl: "blob:..."}]
  onConfirm,      // (finalText: string) => void — sends to marker
  onBack,         // () => void — go back to camera
}) {
  const [editedPages, setEditedPages] = useState(
    () => pages.map((p) => ({ ...p, edited: p.text }))
  );
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [viewMode, setViewMode] = useState("side-by-side"); // "side-by-side" | "text-only"

  const activePage = editedPages[activePageIndex];

  const updatePageText = useCallback((index, newText) => {
    setEditedPages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], edited: newText };
      return updated;
    });
  }, []);

  const handleConfirm = () => {
    const finalText = editedPages.map((p) => p.edited).join("\n\n");
    onConfirm(finalText);
  };

  const hasEdits = editedPages.some((p) => p.edited !== p.text);

  return (
    <div className="transcription-review">
      {/* Header */}
      <div className="review-header">
        <button className="camera-btn camera-btn-secondary" type="button" onClick={onBack}>
          ← Retake
        </button>
        <h2 className="review-title">Review Transcription</h2>
        <div className="review-view-toggle">
          <button
            type="button"
            className={viewMode === "side-by-side" ? "active" : ""}
            onClick={() => setViewMode("side-by-side")}
          >
            Side by Side
          </button>
          <button
            type="button"
            className={viewMode === "text-only" ? "active" : ""}
            onClick={() => setViewMode("text-only")}
          >
            Text Only
          </button>
        </div>
      </div>

      {/* Page tabs */}
      {editedPages.length > 1 && (
        <div className="review-page-tabs">
          {editedPages.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`review-page-tab${i === activePageIndex ? " active" : ""}`}
              onClick={() => setActivePageIndex(i)}
            >
              Page {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className={`review-content ${viewMode}`}>
        {/* Original image */}
        {viewMode === "side-by-side" && activePage?.imageUrl && (
          <div className="review-image-panel">
            <div className="review-panel-label">Original</div>
            <img
              src={activePage.imageUrl}
              alt={`Page ${activePageIndex + 1} original`}
              className="review-image"
            />
          </div>
        )}

        {/* Editable text */}
        <div className="review-text-panel">
          <div className="review-panel-label">
            Transcribed Text
            {activePage?.edited !== activePage?.text && (
              <span className="review-edited-badge">edited</span>
            )}
          </div>
          <textarea
            className="review-textarea"
            value={activePage?.edited || ""}
            onChange={(e) => updatePageText(activePageIndex, e.target.value)}
            placeholder="Transcribed text will appear here..."
          />
        </div>
      </div>

      {/* Illegible markers warning */}
      {activePage?.edited?.includes("[illegible]") && (
        <div className="review-warning">
          This page contains [illegible] markers — please review and fill in the correct words if you can read them.
        </div>
      )}

      {/* Actions */}
      <div className="review-actions">
        <div className="review-info">
          {editedPages.length} page{editedPages.length !== 1 ? "s" : ""}
          {hasEdits && " (with edits)"}
        </div>
        <button
          type="button"
          className="camera-btn camera-btn-transcribe"
          onClick={handleConfirm}
        >
          Send to Marker →
        </button>
      </div>
    </div>
  );
}