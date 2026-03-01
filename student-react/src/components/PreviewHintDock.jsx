export default function PreviewHintDock({ hint, onDismiss }) {
  if (!hint) return null;
  const nav = hint.nav || null;
  return (
    <div className="preview-hint-bar" aria-live="polite">
      <div className="hint-bar-content">
        <div className="hint-bar-text">
          {hint.title ? <strong className="hint-bar-title">{hint.title}</strong> : null}
          {hint.title && hint.body ? <span className="hint-bar-sep">—</span> : null}
          {hint.body ? <span className="hint-bar-body">{hint.body}</span> : null}
        </div>
        {hint.subheader ? (
          <span className="hint-bar-counter">{hint.subheader}</span>
        ) : null}
      </div>
      <div className="hint-bar-actions">
        {nav && nav.count > 1 ? (
          <>
            <button
              type="button"
              className="hint-bar-btn"
              onClick={() => nav.onPrev?.()}
              aria-label="Previous"
            >
              ← Prev
            </button>
            <button
              type="button"
              className="hint-bar-btn"
              onClick={() => nav.onNext?.()}
              aria-label="Next"
            >
              Next →
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="hint-bar-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
