import { useState, useRef, useEffect } from "react";

/**
 * User menu dropdown with ladder icon.
 * Shows Profile, Sign Out, and future items (Subscription, Theme).
 *
 * Props:
 *   onSignOut: () => void
 */
export default function UserMenu({ onSignOut }) {
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

  return (
    <div className="user-menu-wrap" ref={menuRef}>
      <button
        className="iconbtn user-menu-trigger"
        type="button"
        aria-label="User menu"
        title="Menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="4" y1="6" x2="16" y2="6" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="18" x2="16" y2="18" />
          <circle cx="19.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <ul className="user-menu" role="menu">
          <li>
            <a href="/profile_react.html" role="menuitem">
              <svg className="user-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </a>
          </li>
          <li className="user-menu-divider" />
          <li>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut?.(); }}>
              <svg className="user-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
