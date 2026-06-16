export default function PracticeSummary({ results, sentences, onRestart }) {
  const totalIssues = results.reduce((sum, r) => sum + r.total, 0);
  const totalApproved = results.reduce((sum, r) => sum + r.approved, 0);
  const pct = totalIssues > 0 ? Math.round((totalApproved / totalIssues) * 100) : 0;

  return (
    <div className="practice-summary">
      <div className="revision-pillbox">
        <h2 className="practice-summary-title">Session Complete</h2>

        <div className="practice-summary-score">
          <span className="practice-summary-pct">{pct}%</span>
          <span className="practice-summary-detail">
            {totalApproved} of {totalIssues} issues fixed across{" "}
            {sentences.length} sentences
          </span>
        </div>

        <div className="practice-summary-breakdown">
          {sentences.map((s, i) => {
            const r = results[i];
            return (
              <div key={s.id} className="practice-summary-row">
                <span className="practice-summary-num">{i + 1}.</span>
                <span className="practice-summary-sentence">
                  {s.sentence.length > 60
                    ? s.sentence.slice(0, 60) + "..."
                    : s.sentence}
                </span>
                <span
                  className={
                    "practice-summary-badge" +
                    (r.approved === r.total
                      ? " practice-badge-perfect"
                      : r.approved > 0
                      ? " practice-badge-partial"
                      : " practice-badge-none")
                  }
                >
                  {r.approved}/{r.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="practice-summary-actions">
        <button className="practice-next-btn" onClick={onRestart}>
          Practice Again
        </button>
        <a href="/revise" className="practice-cta-btn">
          Try Vysti Marker for Your Essay
        </a>
      </div>
    </div>
  );
}
