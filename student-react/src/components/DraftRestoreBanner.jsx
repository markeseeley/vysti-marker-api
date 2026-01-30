export default function DraftRestoreBanner({
  visible,
  savedAt,
  onRestore,
  onDismiss,
  onDelete
}) {
  if (!visible) return null;
  const timeLabel = savedAt
    ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "recently";
  return (
    <div className="draft-banner">
      <div className="draft-banner-text">
        Unsaved draft found from {timeLabel}
      </div>
      <div className="draft-banner-actions">
        <button className="secondary-btn" type="button" onClick={onRestore}>
          Restore
        </button>
        <button className="secondary-btn" type="button" onClick={onDismiss}>
          Dismiss
        </button>
        <button className="secondary-btn" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
