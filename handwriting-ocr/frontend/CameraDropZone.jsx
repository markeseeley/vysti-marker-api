/**
 * CameraDropZone — Mobile-first image upload for handwritten essays.
 *
 * On mobile: shows "Take Photo" button that opens camera directly.
 * On desktop: shows drag-and-drop zone for image files.
 * Both: support multi-image upload with page reordering.
 *
 * This component is NOT wired into the live app yet.
 * It lives in handwriting-ocr/frontend/ for isolated testing.
 */

import { useState, useRef, useCallback } from "react";

const MAX_PAGES = 20;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function CameraDropZone({ onTranscribe, disabled = false }) {
  const [pages, setPages] = useState([]);       // [{id, file, preview}]
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // ------- Add images -------
  const addImages = useCallback((files) => {
    const newPages = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.heic$/i)) continue;
      if (pages.length + newPages.length >= MAX_PAGES) break;

      newPages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }
    if (newPages.length > 0) {
      setPages((prev) => [...prev, ...newPages]);
    }
  }, [pages.length]);

  // ------- Remove page -------
  const removePage = useCallback((id) => {
    setPages((prev) => {
      const page = prev.find((p) => p.id === id);
      if (page) URL.revokeObjectURL(page.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // ------- Drag-to-reorder -------
  const handleDragStart = (index) => setDragIndex(index);
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setPages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  // ------- File drop on zone -------
  const handleZoneDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      addImages(Array.from(e.dataTransfer.files));
    }
  };

  // ------- Submit -------
  const handleTranscribe = () => {
    if (pages.length === 0 || disabled) return;
    onTranscribe(pages.map((p) => p.file));
  };

  return (
    <div className="camera-dropzone">
      {/* Upload area */}
      {pages.length < MAX_PAGES && (
        <div
          className={`camera-dropzone-area ${dragOver ? "drag-over" : ""}`}
          onDrop={handleZoneDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="camera-dropzone-icon">📷</div>
          <div className="camera-dropzone-text">
            {isMobile ? (
              <>
                <button
                  className="camera-btn camera-btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                >
                  Take Photo
                </button>
                <span className="camera-dropzone-or">or</span>
                <button
                  className="camera-btn camera-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose from Library
                </button>
              </>
            ) : (
              <>
                <p className="camera-dropzone-heading">
                  Drop page images here
                </p>
                <p className="camera-dropzone-sub">
                  or click to browse — JPEG, PNG, WebP
                </p>
              </>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => addImages(Array.from(e.target.files))}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => addImages(Array.from(e.target.files))}
          />
        </div>
      )}

      {/* Page thumbnails */}
      {pages.length > 0 && (
        <div className="camera-pages">
          <div className="camera-pages-header">
            <span>{pages.length} page{pages.length !== 1 ? "s" : ""}</span>
            {pages.length > 1 && (
              <span className="camera-pages-hint">Drag to reorder</span>
            )}
          </div>
          <div className="camera-pages-grid">
            {pages.map((page, i) => (
              <div
                key={page.id}
                className={`camera-page-thumb ${dragIndex === i ? "dragging" : ""}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
              >
                <img src={page.preview} alt={`Page ${i + 1}`} />
                <span className="camera-page-number">{i + 1}</span>
                <button
                  className="camera-page-remove"
                  onClick={() => removePage(page.id)}
                  aria-label="Remove page"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            className="camera-btn camera-btn-transcribe"
            onClick={handleTranscribe}
            disabled={disabled || pages.length === 0}
          >
            {disabled ? "Transcribing..." : `Transcribe ${pages.length} Page${pages.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
