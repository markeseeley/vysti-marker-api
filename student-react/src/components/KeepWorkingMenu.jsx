import { useState, useRef, useEffect } from "react";

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return `Today ${formatTime(iso)}`;
  if (isYesterday) return `Yesterday ${formatTime(iso)}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
}

function truncate(str, max = 24) {
  if (!str || str.length <= max) return str || "";
  return str.slice(0, max - 1) + "\u2026";
}

/**
 * Unified "Keep working" dropdown shared across all topbars.
 * Shows one pill per mode (Mark / Revise / Write) that has in-progress work.
 *
 * Props:
 *   items: Array<{ mode, label, sublabel, time, href?, onClick? }>
 */
export default function KeepWorkingMenu({ items }) {
  const list = Array.isArray(items) ? items : [];
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (list.length === 0) return null;

  const handleItemClick = (item) => {
    setOpen(false);
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  // Single item — simple button
  if (list.length === 1) {
    const item = list[0];
    return (
      <button
        className="topbar-btn keep-working-btn"
        type="button"
        title={`Resume ${item.label}${item.sublabel ? ` — ${item.sublabel}` : ""}`}
        onClick={() => handleItemClick(item)}
      >
        Keep working
      </button>
    );
  }

  // Multiple items — button with dropdown
  return (
    <div className="keep-working-wrap" ref={menuRef}>
      <button
        className="topbar-btn keep-working-btn"
        type="button"
        title="Resume saved work"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Keep working &#9662;
      </button>
      {open && (
        <ul className="keep-working-menu" role="menu">
          {list.map((item) => (
            <li key={item.mode}>
              <button type="button" onClick={() => handleItemClick(item)}>
                <span className={`kw-mode-dot kw-mode-dot--${item.mode}`} />
                <span className="kw-mode-label">{item.label}</span>
                <span className="kw-file">{truncate(item.sublabel)}</span>
                <span className="kw-time">{formatDate(item.time)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
