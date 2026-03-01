import MostCommonIssuesChart from "./MostCommonIssuesChart";
import WritingGuide from "./WritingGuide";

export default function WriteSidebar({
  issues,
  labelCounts,
  totalLabels,
  expandedMetric,
  onExpandedMetricChange,
  markEventId,
  isChecking,
  mode,
  hasText,
  stage,
  structuralStage,
  firstSentenceComponents,
  authorName,
  sentenceCount,
  onDeviceCountChange,
  cohesionDetails,
}) {
  const hasResults = totalLabels > 0;
  // The writing guide now covers all 6 Foundation stages — always visible.
  const showGuide = true;

  return (
    <div className="write-sidebar">
      {showGuide && <WritingGuide stage={stage} missingComponents={firstSentenceComponents} authorName={authorName} sentenceCount={sentenceCount} onDeviceCountChange={onDeviceCountChange} />}

      {hasResults ? (
        <>
          <MostCommonIssuesChart
            labelCounts={labelCounts}
            expandedMetric={expandedMetric}
            onExpandedMetricChange={onExpandedMetricChange}
            markEventId={markEventId}
            cohesionDetails={cohesionDetails}
          />

          {issues.length > 0 ? (
            <div className="write-issues-list">
              <h3 className="write-issues-title">Issues found</h3>
              <ul className="write-issues-ul">
                {issues.map((issue) => (
                  <li key={issue.label} className="write-issue-row">
                    <span className="write-issue-label">{issue.label}</span>
                    <span className="write-issue-count">{issue.count}</span>
                    {issue.short_explanation ? (
                      <p className="write-issue-hint">{issue.short_explanation}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="write-sidebar-empty">
          {!showGuide && (
            <p className="helper-text">
              {isChecking
                ? "Analyzing your writing..."
                : "Start writing and Vysti will provide feedback automatically."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
