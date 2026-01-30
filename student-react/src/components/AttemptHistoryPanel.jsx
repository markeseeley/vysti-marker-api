export default function AttemptHistoryPanel({
  enabled,
  attempts,
  selectedAttemptId,
  onSelectAttempt,
  onRefresh,
  isLoading,
  error
}) {
  if (!enabled) return null;
  return (
    <section className="card practice-card">
      <div className="practice-header">
        <h2>Attempt history</h2>
        <button className="diagnostics-link" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {isLoading ? <p className="helper-text">Loading history…</p> : null}
      {error ? <p className="helper-text error-text">{error}</p> : null}

      {!isLoading && (!attempts || attempts.length === 0) ? (
        <p className="helper-text">No attempts yet for this file.</p>
      ) : null}

      <div className="attempt-list">
        {(attempts || []).map((attempt) => {
          const timeLabel = attempt?.createdAt
            ? new Date(attempt.createdAt).toLocaleString()
            : "Unknown time";
          return (
            <button
              key={attempt.id}
              type="button"
              className={`attempt-item${
                selectedAttemptId === attempt.id ? " is-active" : ""
              }`}
              onClick={() => onSelectAttempt?.(attempt)}
            >
              <div className="attempt-time">{timeLabel}</div>
              <div className="attempt-meta">
                <span>Total issues: {attempt.totalIssues ?? 0}</span>
                <span>{attempt.topIssue || "Top issue —"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
