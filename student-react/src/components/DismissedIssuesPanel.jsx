import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Popover panel showing dismissed issues, allowing users to restore (undismiss) them.
 * Appears next to the Zoom control in the preview toolbar.
 */
export default function DismissedIssuesPanel({
  isOpen,
  anchorEl,
  dismissedIssues,
  fileName,
  onUndismiss,
  onClose
}) {
  const panelRef = useRef(null);
  const [selected, setSelected] = useState(new Set());

  // Filter to current file's dismissed issues
  const records = (dismissedIssues || []).filter(
    (r) => r?.file_name === fileName
  );

  // Group by label
  const grouped = {};
  records.forEach((r, idx) => {
    const label = r?.label || "Unknown";
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push({ ...r, _idx: idx });
  });
  const labels = Object.keys(grouped).sort();

  // Reset selection when opening
  useEffect(() => {
    if (isOpen) setSelected(new Set());
  }, [isOpen]);

  // Position popover below anchor
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || !panelRef.current) return;
    const panel = panelRef.current;
    const rect = anchorEl.getBoundingClientRect();
    const gap = 6;
    const padding = 12;
    panel.style.display = "block";
    panel.style.visibility = "hidden";
    const pRect = panel.getBoundingClientRect();
    const top = rect.bottom + gap;
    let left = rect.right - pRect.width;
    left = Math.max(padding, Math.min(left, window.innerWidth - pRect.width - padding));
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.visibility = "visible";
  }, [anchorEl, isOpen, records.length]);

  // Close on outside click / escape
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorEl?.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorEl, isOpen, onClose]);

  if (!isOpen || labels.length === 0) return null;

  const toggleLabel = (label) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleRestore = () => {
    if (selected.size === 0) return;
    // Collect all records that match selected labels
    const toRestore = records.filter((r) => selected.has(r?.label));
    onUndismiss?.(toRestore);
    setSelected(new Set());
  };

  const totalSelected = labels.reduce(
    (sum, label) => sum + (selected.has(label) ? grouped[label].length : 0),
    0
  );

  return createPortal(
    <div ref={panelRef} className="dismissed-panel">
      <div className="dismissed-panel-header">Dismissed Issues</div>
      <div className="dismissed-panel-list">
        {labels.map((label) => {
          const items = grouped[label];
          return (
            <label key={label} className="dismissed-panel-row">
              <input
                type="checkbox"
                name="dismissed-issue-select"
                checked={selected.has(label)}
                onChange={() => toggleLabel(label)}
              />
              <span className="dismissed-panel-label">{label}</span>
              <span className="dismissed-panel-count">{items.length}</span>
            </label>
          );
        })}
      </div>
      <div className="dismissed-panel-footer">
        <span className="dismissed-panel-note">
          Restored issues appear on next recheck.
        </span>
        <button
          type="button"
          className="primary-btn"
          disabled={totalSelected === 0}
          onClick={handleRestore}
        >
          Restore{totalSelected > 0 ? ` (${totalSelected})` : ""}
        </button>
      </div>
    </div>,
    document.body
  );
}
