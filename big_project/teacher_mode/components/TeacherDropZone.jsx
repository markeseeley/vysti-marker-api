import { useCallback, useEffect, useRef, useState } from "react";

export default function TeacherDropZone({
  onFilesAdded, files,
  canMark, isProcessing, processProgress, onMarkAll, onCancelMark,
  isUploadBlocked, onBlockedClick,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const _acceptFiles = useCallback((allFiles) => {
    const accepted = allFiles.filter((f) => /\.(docx|pdf)$/i.test(f.name));
    const doc = allFiles.filter((f) =>
      f.name.toLowerCase().endsWith(".doc") && !f.name.toLowerCase().endsWith(".docx")
    );
    if (doc.length > 0 && accepted.length === 0) {
      alert(`"${doc[0].name}" is a .doc file. Please save it as .docx or export as PDF and try again.`);
    } else if (doc.length > 0) {
      alert(`${doc.length} file${doc.length === 1 ? " is" : "s are"} in .doc format and ${doc.length === 1 ? "was" : "were"} skipped. Please save as .docx or export as PDF.`);
    }
    if (accepted.length) onFilesAdded(accepted);
  }, [onFilesAdded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (isUploadBlocked) { onBlockedClick?.(); return; }
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) _acceptFiles(dropped);
  }, [_acceptFiles, isUploadBlocked, onBlockedClick]);

  const handleInputChange = useCallback((e) => {
    const selected = Array.from(e.target.files);
    e.target.value = "";
    if (selected.length) _acceptFiles(selected);
  }, [_acceptFiles]);

  // Phase-based title (mirrors student DropZone)
  let phase = "default";
  if (isProcessing) phase = "processing";
  else if (files.length > 0) phase = "selected";

  const title = {
    processing: `Marking ${processProgress.current} of ${processProgress.total}\u2026`,
    selected: "Ready to mark",
    default: "Drop essays here",
  }[phase];

  // Cross-fade with vertical motion for title changes
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

  return (
    <>
      <div
        className={`drop-zone${dragOver ? " dragover" : ""}`}
        id="dropZone"
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (isUploadBlocked) { onBlockedClick?.(); return; }
          fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (isUploadBlocked) { onBlockedClick?.(); return; }
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload .docx or .pdf files"
      >
        <div className={`dz-icon-slot${phase !== "default" ? " dz-icon-slot--hidden" : ""}`} aria-hidden="true">
          <img className="dz-icon" src="/assets/cloud-upload.svg" alt="" />
        </div>
        <div className={`dz-title${titleTransition ? ` ${titleTransition}` : ""}`}>
          {displayedTitle}
        </div>
        <div className={`dz-sub${phase === "default" ? "" : " dz-sub--hidden"}`}>
          or click to browse
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        name="teacher-files"
        accept=".docx,.pdf"
        multiple
        hidden
        onChange={handleInputChange}
      />

      {files.length > 0 && (
        <div className="dz-submit-row dz-enter">
          <button
            type="button"
            className={`primary-btn${isProcessing ? " is-loading loading-cursor" : ""}`}
            disabled={!canMark}
            onClick={(e) => { e.stopPropagation(); onMarkAll(); }}
          >
            {isProcessing ? "Marking\u2026" : "Mark Essays"}
          </button>
          {isProcessing && onCancelMark && (
            <button
              type="button"
              className="dz-cancel-btn"
              title="Cancel marking"
              aria-label="Cancel marking"
              onClick={(e) => { e.stopPropagation(); onCancelMark(); }}
            >
              &times;
            </button>
          )}
        </div>
      )}
    </>
  );
}
