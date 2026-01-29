export default function UploadCard({
  selectedFile,
  isDragOver,
  onBrowseClick,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onClearFile,
  fileInputRef
}) {
  return (
    <section className="card upload-card">
      <label>Upload</label>
      <div
        id="dropZone"
        className={`drop-zone${isDragOver ? " dragover" : ""}`}
        tabIndex={0}
        role="button"
        aria-label="Upload .docx file"
        onClick={onBrowseClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowseClick();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <img
          className="dz-icon"
          src="/assets/cloud-upload.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="dz-title">Drag &amp; drop .docx file here</div>
        <div className="dz-sub">or click to browse</div>
        <input
          ref={fileInputRef}
          type="file"
          id="fileInput"
          name="file"
          accept=".docx"
          hidden
          onChange={onFileChange}
        />
      </div>

      <ul id="fileList" className="file-list">
        {selectedFile ? <li>{selectedFile.name}</li> : null}
      </ul>
      <button
        type="button"
        id="clearFileBtn"
        className="secondary-btn"
        style={{ display: selectedFile ? "inline-flex" : "none" }}
        onClick={onClearFile}
      >
        Clear file
      </button>
    </section>
  );
}
