import { useEffect } from "react";

const AUTO_DISMISS = {
  info: 3500,
  success: 3500,
  warn: 4500
};

export default function StatusToasts({ toasts, onDismiss }) {
  useEffect(() => {
    const timers = (toasts || [])
      .filter((toast) => AUTO_DISMISS[toast.kind])
      .map((toast) => {
        const delay = AUTO_DISMISS[toast.kind];
        const timer = window.setTimeout(() => onDismiss?.(toast.id), delay);
        return () => window.clearTimeout(timer);
      });
    return () => {
      timers.forEach((clear) => clear());
    };
  }, [onDismiss, toasts]);

  if (!toasts?.length) return null;

  return (
    <div className="status-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind || "info"}`}>
          <div className="toast-body">
            <strong>{toast.title}</strong>
            {toast.message ? <div>{toast.message}</div> : null}
          </div>
          <div className="toast-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onDismiss?.(toast.id)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
