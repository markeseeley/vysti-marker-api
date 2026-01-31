import { useEffect, useMemo, useRef, useState } from "react";
import { getDebugInfo } from "../lib/logger";

export default function DiagnosticsPanel({
  data,
  isOpen,
  onToggle,
  rolloutConfig,
  rolloutReason,
  uiMode,
  buildId,
  onForceClassic,
  onForceReact,
  onClearUiMode
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const dialogRef = useRef(null);
  const isVisible = typeof onToggle === "function" ? isOpen : localOpen;

  const handleToggle = () => {
    if (typeof onToggle === "function") {
      onToggle();
    } else {
      setLocalOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!isVisible) return;
    dialogRef.current?.focus();
  }, [isVisible]);

  const debugPayload = useMemo(() => {
    if (!isVisible) return "";
    const info = data || getDebugInfo();
    return JSON.stringify(info, null, 2);
  }, [data, isVisible]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugPayload);
      setCopyStatus("Copied.");
    } catch (err) {
      setCopyStatus("Copy failed.");
    }
    window.setTimeout(() => setCopyStatus(""), 2000);
  };

  const rolloutSummary = rolloutConfig
    ? JSON.stringify(rolloutConfig, null, 2)
    : "Missing rollout config";
  const rolloutReasonSummary = rolloutReason
    ? JSON.stringify(rolloutReason, null, 2)
    : "No rollout reason";

  return (
    <div className="diagnostics">
      <button
        type="button"
        className="diagnostics-link"
        onClick={handleToggle}
        aria-expanded={isVisible}
      >
        Diagnostics
      </button>
      {isVisible ? (
        <div
          className="diagnostics-panel"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={dialogRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              handleToggle();
            }
            if (event.key === "Tab") {
              const focusable = dialogRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              );
              if (!focusable || focusable.length === 0) return;
              const items = Array.from(focusable);
              const first = items[0];
              const last = items[items.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div className="diagnostics-row">
            <button type="button" className="secondary-btn" onClick={handleCopy}>
              Copy debug info
            </button>
            {copyStatus ? <span className="diagnostics-status">{copyStatus}</span> : null}
          </div>
          <div className="diagnostics-row diagnostics-controls">
            <div>
              <div className="diagnostics-status">
                uiMode: {uiMode || "unset"}
              </div>
              <div className="diagnostics-status">
                buildId: {buildId || "unknown"}
              </div>
            </div>
            <div className="diagnostics-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={onForceClassic}
              >
                Force Classic
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={onForceReact}
              >
                Force React
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={onClearUiMode}
              >
                Clear override
              </button>
            </div>
          </div>
          <pre className="diagnostics-pre">{rolloutReasonSummary}</pre>
          <pre className="diagnostics-pre">{rolloutSummary}</pre>
          <pre className="diagnostics-pre">{debugPayload}</pre>
        </div>
      ) : null}
    </div>
  );
}
