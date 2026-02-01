export default function PreviewHintDock({ hint, onDismiss }) {
  if (!hint) return null;
  return (
    <div id="previewHintDock" className="preview-hint-dock" aria-live="polite">
      <div className="tour-popover hint-card">
        <button
          type="button"
          className="tour-close"
          aria-label="Close hint"
          onClick={onDismiss}
        >
          ×
        </button>
        {hint.title ? <div className="tour-title">{hint.title}</div> : null}
        {hint.subheader ? (
          <div className="pill-hint-subheader">{hint.subheader}</div>
        ) : null}
        {hint.body ? <div className="tour-body">{hint.body}</div> : null}
        <div className="pill-hint-footer">
          <button type="button" className="secondary-btn" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
