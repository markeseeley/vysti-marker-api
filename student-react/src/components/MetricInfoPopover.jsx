import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  METRIC_INFO,
  CONCISION_LABELS,
  CLARITY_LABELS,
  CONVENTIONS_LABELS,
  DEVELOPMENT_LABELS,
  COHESION_CRITICAL_LABELS,
  COHESION_MODERATE_LABELS,
  COHESION_MINOR_LABELS
} from "../lib/studentMetrics";

/**
 * Generate a summary of issues for the given metric
 */
function generateIssueSummary(metricKey, metricData, labelCounts) {
  if (!metricData?.details) return null;

  const issues = [];
  const details = metricData.details;
  const counts = labelCounts || {};

  if (metricKey === "power") {
    const weakCount = Number(details.weakCount) || 0;
    const powerCount = Number(details.powerCount) || 0;
    const powerTarget = Number(details.powerTarget) || 0;

    if (weakCount > 0) {
      const weakByBase = details.weakByBase || {};
      const weakTypes = [];
      for (const verb of ["show", "use", "demonstrate", "emphasize", "represent", "state", "symbolize"]) {
        if (weakByBase[verb] > 0) weakTypes.push(`"${verb}" (${weakByBase[verb]})`);
      }
      if (weakTypes.length > 0) {
        issues.push(`${weakCount} weak verb${weakCount > 1 ? 's' : ''}: ${weakTypes.join(', ')}`);
      } else {
        issues.push(`${weakCount} weak verb${weakCount > 1 ? 's' : ''}`);
      }
    }

    if (powerTarget > 0 && powerCount < powerTarget) {
      const deficit = powerTarget - powerCount;
      issues.push(`Need ${deficit} more power verb${deficit > 1 ? 's' : ''} (have ${powerCount}/${powerTarget})`);
    }
  }

  if (metricKey === "variety") {
    const bodyCount = Number(details.bodyParagraphCount) || 0;

    if (details.techniqueFailures?.length > 0 && !details.techniquesUnavailable) {
      const count = details.techniqueFailures.length;
      issues.push(`${count} body paragraph${count > 1 ? 's lack' : ' lacks'} 3+ rhetorical techniques`);
    }

    if (details.evidenceDevFailures?.length > 0) {
      const count = details.evidenceDevFailures.length;
      issues.push(`${count} body paragraph${count > 1 ? 's lack' : ' lacks'} sufficient evidence or development`);
    }

    if (details.structureFailures?.length > 0) {
      const count = details.structureFailures.length;
      issues.push(`${count} body paragraph${count > 1 ? 's have' : ' has'} too many weak pronoun starters`);
    }

    const devCount = Number(details.developmentCount) || 0;
    if (devCount > 0) {
      const topLabels = DEVELOPMENT_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => {
          const shortLabel = item.label
            .replace("Shorten, modify, and integrate quotations", "Long quotations")
            .replace("Floating quotation", "Floating quotations")
            .replace("Follow the process for inserting evidence", "Evidence integration")
            .replace("Explain the significance of evidence", "Missing evidence explanation")
            .replace("No quotations in the final sentence of a body paragraph", "Quotations ending paragraphs")
            .replace("No quotations in topic sentences", "Quotations in topic sentences")
            .replace("No quotations in thesis statements", "Quotations in thesis");
          return `${shortLabel} (${item.count})`;
        }).join(', ');
        issues.push(summary);
      } else {
        issues.push(`${devCount} development issue${devCount > 1 ? 's' : ''}`);
      }
    }
  }

  if (metricKey === "cohesion") {
    const sentenceMisses = details.issues?.sentenceBoundaryMisses?.length || 0;
    const paragraphMisses = details.issues?.paragraphBoundaryMisses?.length || 0;
    const weakTransitions = details.issues?.weakTransitions?.length || 0;

    if (sentenceMisses > 0) {
      issues.push(`${sentenceMisses} sentence${sentenceMisses > 1 ? 's lack' : ' lacks'} connection to previous sentence`);
    }

    if (paragraphMisses > 0) {
      issues.push(`${paragraphMisses} paragraph${paragraphMisses > 1 ? 's lack' : ' lacks'} connection to previous paragraph`);
    }

    if (weakTransitions > 0) {
      issues.push(`${weakTransitions} repeated or weak transition${weakTransitions > 1 ? 's' : ''}`);
    }

    // Add label-based issues
    const criticalCount = Number(details.criticalCohesionCount) || 0;
    const moderateCount = Number(details.moderateCohesionCount) || 0;
    const minorCount = Number(details.minorCohesionCount) || 0;

    if (criticalCount > 0) {
      const topLabels = COHESION_CRITICAL_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => {
          const shortLabel = item.label
            .replace("Off-topic", "Off-topic")
            .replace("Follow the organization of the thesis", "Thesis organization")
            .replace("Use a closed thesis statement", "Closed thesis")
            .replace("The topics in the thesis statement should be specific devices or strategies", "Specific thesis topics");
          return `${shortLabel} (${item.count})`;
        }).join(', ');
        issues.push(summary);
      }
    }

    if (moderateCount > 0) {
      const topLabels = COHESION_MODERATE_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => `${item.label} (${item.count})`).join(', ');
        issues.push(summary);
      }
    }
  }

  if (metricKey === "precision") {
    const concisionCount = Number(details.concisionCount) || 0;
    const clarityCount = Number(details.clarityCount) || 0;
    const conventionsCount = Number(details.conventionsCount) || 0;

    if (concisionCount > 0) {
      const topLabels = CONCISION_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => {
          const shortLabel = item.label
            .replace("Avoid referring to the reader or audience unless necessary", "Addressing reader")
            .replace("Avoid the words 'therefore', 'thereby', 'hence', and 'thus'", "Banned connectors")
            .replace("Use the author's name instead of 'the author'", "'The author'")
            .replace("No 'I', 'we', 'us', 'our' or 'you' in academic writing", "First/second person")
            .replace("No contractions in academic writing", "Contractions")
            .replace("Avoid the word 'which'", "'Which'")
            .replace("Avoid using the word 'and' more than twice in a sentence", "Too many 'and's");
          return `${shortLabel} (${item.count})`;
        }).join(', ');
        issues.push(`Concision: ${summary}`);
      } else {
        issues.push(`${concisionCount} concision issue${concisionCount > 1 ? 's' : ''}`);
      }
    }

    if (clarityCount > 0) {
      const topLabels = CLARITY_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => {
          let shortLabel = item.label;
          if (shortLabel.startsWith("Avoid the vague term")) {
            shortLabel = "Vague: " + shortLabel.match(/'([^']+)'/)?.[1];
          } else {
            shortLabel = shortLabel
              .replace("Clarify pronouns and antecedents", "Unclear pronouns")
              .replace("Do not refer to the text as a text; refer to context instead", "Meta-textual references")
              .replace("Avoid absolute language like 'always' or 'never'", "Absolute language")
              .replace(/^Avoid the word '([^']+)'$/, "'$1'")
              .replace(/^Avoid the phrase '([^']+)'$/, "'$1'");
          }
          return `${shortLabel} (${item.count})`;
        }).join(', ');
        issues.push(`Clarity: ${summary}`);
      } else {
        issues.push(`${clarityCount} clarity issue${clarityCount > 1 ? 's' : ''}`);
      }
    }

    if (conventionsCount > 0) {
      const topLabels = CONVENTIONS_LABELS
        .map(label => ({ label, count: counts[label] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      if (topLabels.length > 0) {
        const summary = topLabels.map(item => {
          const shortLabel = item.label
            .replace("Spelling error", "Spelling")
            .replace("Check subject-verb agreement", "Subject-verb agreement")
            .replace("Commonly confused word", "Confused words")
            .replace("Comma after introductory word", "Missing commas")
            .replace("The title of major works should be italicized", "Title formatting (major works)")
            .replace("The title of minor works should be inside double quotation marks", "Title formatting (minor works)")
            .replace("Add parenthetical citation", "Missing citation");
          return `${shortLabel} (${item.count})`;
        }).join(', ');
        issues.push(`Conventions: ${summary}`);
      } else {
        issues.push(`${conventionsCount} conventions issue${conventionsCount > 1 ? 's' : ''}`);
      }
    }
  }

  return issues.length > 0 ? issues : null;
}

export default function MetricInfoPopover({ isOpen, anchorEl, metricKey, metricData, labelCounts, onClose }) {
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || !popoverRef.current) return;
    const popover = popoverRef.current;
    const rect = anchorEl.getBoundingClientRect();
    const gap = 10;
    const padding = 12;
    popover.style.display = "block";
    popover.style.visibility = "hidden";
    const popRect = popover.getBoundingClientRect();
    const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.visibility = "visible";
  }, [anchorEl, isOpen, metricKey]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (anchorEl?.contains(event.target)) return;
      onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handleReposition = () => {
      if (!popoverRef.current || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const gap = 10;
      const padding = 12;
      const popRect = popoverRef.current.getBoundingClientRect();
      const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
      const top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
      popoverRef.current.style.top = `${Math.round(top)}px`;
      popoverRef.current.style.left = `${Math.round(left)}px`;
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [anchorEl, isOpen, onClose]);

  if (!isOpen) return null;
  const info = METRIC_INFO[metricKey] || {};
  const issues = generateIssueSummary(metricKey, metricData, labelCounts);

  return createPortal(
    <div ref={popoverRef} className="tour-popover metric-popover">
      <div className="tour-title">{info.title || "Metric"}</div>
      <div className="tour-body">{info.body || ""}</div>
      {issues?.length ? (
        <>
          <div className="metric-popover-tips-title">Issues to Revise</div>
          <ul className="metric-popover-list metric-popover-issues">
            {issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </>
      ) : null}
      {info.tips?.length ? (
        <>
          <div className="metric-popover-tips-title">Tips</div>
          <ul className="metric-popover-list">
            {info.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>,
    document.body
  );
}
