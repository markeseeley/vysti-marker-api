import { useMemo } from "react";
import {
  OVERALL_CRITICAL_LABELS,
  OVERALL_MODERATE_LABELS
} from "../lib/studentMetrics";

const SCORE_MESSAGES = {
  outstanding: [
    "Outstanding — writing mechanics are exceptional.",
    "Impressive command of writing rules and structure.",
    "Excellent technical skill on display.",
  ],
  excellent: [
    "Excellent mechanics — only minor refinements needed.",
    "Strong technical writing with just a few areas to polish.",
    "Great attention to mechanics and structure.",
  ],
  strong: [
    "Strong writing mechanics overall.",
    "Solid technical skill with some areas to refine.",
    "Good command of writing rules.",
  ],
  good: [
    "Good writing mechanics with some areas to improve.",
    "Solid foundation — a few adjustments will sharpen the writing.",
    "Mechanics are on the right track.",
  ],
  developing: [
    "Writing is developing well — focus on the highlighted areas.",
    "A solid start — the flagged issues show where to improve.",
    "Good habits forming — the highlighted areas will help level up.",
  ],
  emerging: [
    "Review the highlighted issues to strengthen mechanics.",
    "Focus on the flagged areas — each fix makes a difference.",
    "Several areas to work on — start with the most common issues.",
  ],
  struggling: [
    "Work through the highlighted issues to build stronger mechanics.",
    "Focus on the most common issues first.",
    "Review each highlighted area carefully.",
  ],
  beginning: [
    "Start by addressing the critical issues flagged in the essay.",
    "Focus on one issue at a time — each fix will improve the writing.",
    "Work through the highlighted areas step by step.",
  ],
};

export default function TeacherScoreCard({ score, labelCounts }) {
  const message = useMemo(() => {
    if (score === null || score === undefined) return null;
    let tier;
    if (score >= 95) tier = "outstanding";
    else if (score >= 90) tier = "excellent";
    else if (score >= 85) tier = "strong";
    else if (score >= 80) tier = "good";
    else if (score >= 75) tier = "developing";
    else if (score >= 70) tier = "emerging";
    else if (score >= 60) tier = "struggling";
    else tier = "beginning";
    const msgs = SCORE_MESSAGES[tier];
    return msgs[score % msgs.length];
  }, [score]);

  const tierInfo = useMemo(() => {
    if (!labelCounts) return null;
    const critical = OVERALL_CRITICAL_LABELS.filter(
      (l) => (Number(labelCounts[l]) || 0) > 0
    );
    if (critical.length) return { tier: "Critical", labels: critical };
    const moderate = OVERALL_MODERATE_LABELS.filter(
      (l) => (Number(labelCounts[l]) || 0) > 0
    );
    if (moderate.length) return { tier: "Moderate", labels: moderate };
    return null;
  }, [labelCounts]);

  if (score === null || score === undefined) {
    return (
      <div className="dz-score-pill">
        <span className="dz-score-value" style={{ opacity: 0.3 }}>Score —</span>
      </div>
    );
  }

  return (
    <div className="dz-score-pill">
      <span className="dz-score-value">Score {score}%</span>
      {message && <p className="dz-set-response">{message}</p>}
      {tierInfo && (
        <div className="dz-pill-actions">
          <span className={`dz-tier-badge dz-tier-badge--${tierInfo.tier.toLowerCase()}`}>
            {tierInfo.tier}
          </span>
        </div>
      )}
    </div>
  );
}
