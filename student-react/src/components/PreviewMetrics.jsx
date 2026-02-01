import { METRIC_INFO } from "../lib/studentMetrics";

const renderScore = (score) => {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return `${score}/100`;
};

export default function PreviewMetrics({
  metrics,
  collapsed,
  onToggleDetails,
  onOpenInfo,
  onOpenPillHint,
  mode
}) {
  const hideCohesion = mode === "peel_paragraph";
  const cohesionScore = hideCohesion ? null : metrics?.cohesion?.score;

  return (
    <div className="preview-metrics-wrap">
      <div className="metrics-details-toggle">
        <button
          type="button"
          className="metrics-toggle-btn"
          id="metricsDetailsToggle"
          aria-expanded={!collapsed}
          onClick={onToggleDetails}
        >
          {collapsed ? "Show details" : "Hide details"}
        </button>
      </div>
      <div
        className={`student-metrics-grid metrics-inline${collapsed ? " details-collapsed" : ""}`}
        id="metricsGrid"
      >
        {["power", "variety", "cohesion", "precision"].map((key) => {
          if (key === "cohesion" && hideCohesion) return null;
          const metric = metrics?.[key];
          const score = key === "cohesion" ? cohesionScore : metric?.score;
          const title = METRIC_INFO[key]?.title || key;
          return (
            <div className="metric-card" key={key} id={`metric-${key}`}>
              <div className="metric-head">
                <div className="metric-title">
                  {title}
                  <button
                    className="metric-info metric-info-btn"
                    type="button"
                    data-metric={key}
                    aria-label={`${title} info`}
                    onClick={onOpenInfo}
                  >
                    i
                  </button>
                </div>
                <div className={`metric-score${score === 100 ? " perfect" : ""}`}>
                  {renderScore(score)}
                </div>
              </div>
              <div className="metric-meter">
                <div
                  className={`metric-meter-fill${score === 100 ? " perfect" : ""}`}
                  style={{ width: score ? `${score}%` : "0%" }}
                />
              </div>
              <div className="metric-sub">
                {key === "power" && metric?.details ? (
                  <>
                    <div className="metric-success">
                      Power verbs: {metric.details.powerCount}/{metric.details.powerTarget}
                    </div>
                    <div className="metric-persistent">
                      Weak verbs: {metric.details.weakCount}
                    </div>
                    {metric.details.weakCount > 0 ? (
                      <button
                        type="button"
                        className="example-btn power-verb-pill"
                        onClick={(event) =>
                          onOpenPillHint?.({
                            anchorEl: event.currentTarget,
                            mode: "anchor",
                            dismissKey: "power_verbs_needed",
                            data: {
                              title: "Power verbs needed",
                              body:
                                "Select from the Power Verbs list to strengthen the highlighted verbs."
                            }
                          })
                        }
                      >
                        Power verbs needed
                      </button>
                    ) : null}
                  </>
                ) : null}
                {key === "variety" && metric?.details ? (
                  <>
                    <div className="metric-success">
                      Techniques: {metric.details.techniqueOkCount}/{metric.details.bodyParagraphCount}
                    </div>
                    <div className="metric-persistent">
                      Evidence: {metric.details.evidenceOkCount}/{metric.details.bodyParagraphCount}
                    </div>
                  </>
                ) : null}
                {key === "cohesion" && metric?.details ? (
                  <div className="metric-success">
                    Sentence links: {metric.details.sentenceBoundaryHits}/
                    {metric.details.sentenceBoundaryDenom}
                  </div>
                ) : null}
                {key === "precision" && metric?.details?.hasCounts ? (
                  <>
                    <div className="metric-success">
                      Unnecessary: {metric.details.unnecessaryCount}
                    </div>
                    <div className="metric-persistent">
                      Wordy: {metric.details.wordyCount}, Imprecise: {metric.details.impreciseCount}
                    </div>
                  </>
                ) : key === "precision" ? (
                  <div className="metric-success">Mark to unlock precision score.</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
