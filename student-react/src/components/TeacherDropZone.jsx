import { useCallback, useRef, useState } from "react";
import { FileText } from "./Icons";

export default function TeacherDropZone({
  onFilesAdded, files, onClearFiles, onRemoveFile,
  canMark, isProcessing, processProgress, onMarkAll,
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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".docx")
    );
    if (dropped.length) onFilesAdded(dropped);
  }, [onFilesAdded]);

  const handleInputChange = useCallback((e) => {
    const selected = Array.from(e.target.files).filter((f) =>
      f.name.toLowerCase().endsWith(".docx")
    );
    if (selected.length) onFilesAdded(selected);
    e.target.value = "";
  }, [onFilesAdded]);

  return (
    <>
      <div
        className={`drop-zone${dragOver ? " dragover" : ""}`}
        id="dropZone"
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload .docx files"
      >
        <img className="dz-icon" src="/assets/cloud-upload.svg" alt="" aria-hidden="true" />
        <div className="dz-title">Drop essays here</div>
        <div className="dz-sub">or click to browse</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        multiple
        hidden
        onChange={handleInputChange}
      />

      {files.map((fd, i) => (
        <div key={i} className="dz-file-row dz-enter">
          <span className="dz-file-pill" title={fd.file.name}>
            <span className="dz-file-icon" aria-hidden="true"><FileText size={14} /></span>
            <span className="dz-file-name">{fd.file.name}</span>
          </span>
          <button
            type="button"
            className="dz-clear-btn"
            onClick={(e) => { e.stopPropagation(); onRemoveFile?.(i); }}
            aria-label={`Remove ${fd.file.name}`}
            title="Remove file"
          >
            ✕
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <div className="dz-submit-row dz-enter">
          <button
            type="button"
            className={`primary-btn${isProcessing ? " is-loading loading-cursor" : ""}`}
            disabled={!canMark}
            onClick={(e) => { e.stopPropagation(); onMarkAll(); }}
          >
            {isProcessing
              ? `Marking ${processProgress.current} of ${processProgress.total}...`
              : "Mark Essays"}
          </button>
        </div>
      )}
    </>
  );
}
