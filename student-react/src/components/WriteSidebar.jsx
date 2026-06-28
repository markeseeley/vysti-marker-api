import MostCommonIssuesChart from "./MostCommonIssuesChart";
import WritingGuide from "./WritingGuide";
import MiniEssayGuide from "./MiniEssayGuide";

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
  textTitle,
  textIsMinor,
  onTextIsMinorChange,
  sentenceCount,
  onDeviceCountChange,
  cohesionDetails,
  bodyParaStats,
  thesisSentence,
  onIssueClick,
  onSkipStage,
  essayText,
  repeatedNouns,
  onOpenInRevise,
  writeMode,
  writeModeConfig,
}) {
  // Map noun-repetition issue → top repeated noun for display
  const topRepeatedNoun = (repeatedNouns || [])[0]?.lemma || null;
  const hasResults = totalLabels > 0;
  // The writing guide now covers all 6 Foundation stages — always visible.
  const showGuide = true;

  return (
    <div className="write-sidebar">
      {showGuide && (writeModeConfig?.customGuide === "mini"
        ? <MiniEssayGuide essayText={essayText} writeModeConfig={writeModeConfig} />
        : <WritingGuide stage={stage} missingComponents={firstSentenceComponents} authorName={authorName} textTitle={textTitle} textIsMinor={textIsMinor} onTextIsMinorChange={onTextIsMinorChange} sentenceCount={sentenceCount} onDeviceCountChange={onDeviceCountChange} bodyParaStats={bodyParaStats} thesisSentence={thesisSentence} onSkipStage={onSkipStage} essayText={essayText} onOpenInRevise={onOpenInRevise} writeMode={writeMode} writeModeConfig={writeModeConfig} />
      )}

      {issues.length > 0 && (
        <div className="write-issues-list">
          <h3 className="write-issues-title">Issues found</h3>
          <ul className="write-issues-ul">
            {issues.map((issue) => (
              <li
                key={issue.label}
                className={`write-issue-row${onIssueClick ? " write-issue-clickable" : ""}`}
                onClick={() => onIssueClick?.(issue.label, issue)}
                role={onIssueClick ? "button" : undefined}
                tabIndex={onIssueClick ? 0 : undefined}
                onKeyDown={onIssueClick ? (e) => { if (e.key === "Enter") onIssueClick(issue.label, issue); } : undefined}
              >
                <span className="write-issue-label">{issue.label}</span>
                <span className="write-issue-count">{issue.count}</span>
                {issue.label === "Noun repetition" && topRepeatedNoun && (
                  <p className="write-issue-found">Repeated: <strong>{topRepeatedNoun}</strong></p>
                )}
                {issue.short_explanation ? (
                  <p className="write-issue-hint">
                    {issue.short_explanation
                      .replace(/\{FOUND\}/g, issue.found_value || "that word")
                      .replace(/\{COUNT\}/g, String(issue.count || "several"))
                      .replace(/<\/?[^>]+>/g, "")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
