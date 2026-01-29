export default function ResultsCard({ status, showDownload, onDownload, isDownloading }) {
  const statusClass =
    status.kind === "success" ? " success" : status.kind === "error" ? " error" : "";

  return (
    <section className="card rules-card" id="resultsCard">
      <div
        id="statusArea"
        className={`status-area${statusClass}`}
        role="status"
        aria-live="polite"
      >
        {status.message}
      </div>

      <button
        id="downloadBtn"
        className={`secondary-btn${isDownloading ? " is-loading loading-cursor" : ""}`}
        type="button"
        style={{ display: showDownload ? "inline-flex" : "none", marginTop: "12px" }}
        onClick={onDownload}
        disabled={isDownloading}
      >
        {isDownloading ? "Processing" : "Download marked essay"}
      </button>
    </section>
  );
}
