export default function DiagnosticsPanel({ isOpen, onToggle, data }) {
  const payload = data || {};
  return (
    <section className="card rules-card">
      <button
        className="secondary-btn"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        Diagnostics ({isOpen ? "hide" : "show"})
      </button>
      {isOpen ? (
        <pre style={{ marginTop: "12px", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
import { useState } from "react";
import { getDebugInfo } from "../lib/logger";

export default function DiagnosticsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const handleCopy = async () => {
    const info = getDebugInfo();
    const payload = JSON.stringify(info, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus("Copied.");
    } catch (err) {
      setCopyStatus("Copy failed.");
    }
    window.setTimeout(() => setCopyStatus(""), 2000);
  };

  return (
    <div className="diagnostics">
      <button
        type="button"
        className="diagnostics-link"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        Diagnostics
      </button>
      {isOpen ? (
        <div className="diagnostics-panel">
          <div className="diagnostics-row">
            <button type="button" className="secondary-btn" onClick={handleCopy}>
              Copy debug info
            </button>
            {copyStatus ? <span className="diagnostics-status">{copyStatus}</span> : null}
          </div>
          <pre className="diagnostics-pre">{JSON.stringify(getDebugInfo(), null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
