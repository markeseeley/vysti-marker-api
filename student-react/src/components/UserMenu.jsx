import { useState, useRef, useEffect, useCallback } from "react";
import { submitErrorReport, getUserEmail } from "../lib/reportIssue";

/**
 * User menu dropdown with ladder icon.
 * Shows Profile, Report an issue, Sign Out.
 * Sign Out requires confirmation. Report opens an in-app form.
 *
 * Props:
 *   onSignOut: () => void
 */
export default function UserMenu({ onSignOut }) {
  const [open, setOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
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
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setShowReportModal(true); }}>
                <svg className="user-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                Report an issue
              </button>
            </li>
            <li className="user-menu-divider" />
            <li>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setShowSignOutConfirm(true); }}>
                <svg className="user-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </li>
          </ul>
        )}
      </div>

      {showSignOutConfirm && (
        <SignOutConfirmModal
          onCancel={() => setShowSignOutConfirm(false)}
          onConfirm={() => { setShowSignOutConfirm(false); onSignOut?.(); }}
        />
      )}

      {showReportModal && (
        <ReportIssueModal onClose={() => setShowReportModal(false)} />
      )}
    </>
  );
}


function SignOutConfirmModal({ onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop um-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign out confirmation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="modal-card">
        <h3>Sign out</h3>
        <p className="um-modal-body">Are you sure you want to sign out?</p>
        <div className="modal-actions">
          <button ref={cancelRef} className="secondary-btn" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" type="button" onClick={onConfirm}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


function ReportIssueModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const textareaRef = useRef(null);

  useEffect(() => {
    getUserEmail().then((e) => { if (e) setEmail(e); });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setStatus("sending");
    try {
      await submitErrorReport(message.trim());
      setStatus("sent");
      setTimeout(() => onClose(), 2000);
    } catch {
      setStatus("error");
    }
  }, [message, onClose]);

  return (
    <div
      className="modal-backdrop um-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Report an issue"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card">
        <h3>Report an issue</h3>

        {status === "sent" ? (
          <p className="um-modal-success">Thanks! Your report has been submitted.</p>
        ) : (
          <>
            <label>
              <span>Email</span>
              <input type="email" value={email} disabled />
            </label>
            <label>
              <span>What went wrong?</span>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue you encountered..."
                maxLength={2000}
              />
            </label>
            <p className="um-modal-hint">
              Debug information (build ID, browser, recent errors) will be attached automatically.
            </p>
            {status === "error" && (
              <p className="um-modal-error">Failed to submit. Please try again or email contact@vysti.org.</p>
            )}
            <div className="modal-actions">
              <button className="secondary-btn" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={handleSubmit}
                disabled={!message.trim() || status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
