/**
 * Recalculate the overall display score after a teacher dismisses labels.
 *
 * Ports the penalty formulas from scoring.py so we can adjust meter scores
 * on the fly without a backend round-trip. Only the label-count-dependent
 * penalties are recalculated — text-analysis bases (Power, variety_base,
 * cohesion_raw, pv_bonus, variety_bonus) stay unchanged.
 */

import {
  DEVELOPMENT_LABELS,
  COHESION_CRITICAL_LABELS,
  COHESION_MODERATE_LABELS,
  COHESION_MINOR_LABELS,
  CONCISION_LABELS,
  CLARITY_LABELS,
  CONVENTIONS_LABELS,
} from "../lib/studentMetrics";

// ── Helpers (ported from scoring.py) ────────────────────────────────

function cappedPenalty(count, perIssue, cap) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += perIssue * Math.pow(0.85, i);
  }
  return Math.min(total, cap);
}

function sumLabelCounts(labels, counts) {
  let total = 0;
  for (const l of labels) {
    total += Number(counts[l] || 0) || 0;
  }
  return total;
}

function sumLabelCountsDeduped(labels, counts, cap = 2) {
  let total = 0;
  for (const l of labels) {
    total += Math.min(Number(counts[l] || 0) || 0, cap);
  }
  return total;
}

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

// ── Main rescoring function ─────────────────────────────────────────

/**
 * @param {object|null} originalScores - doc.metadata.scores from backend
 * @param {object} currentLabelCounts - updated labelCounts after dismissal
 * @param {string} mode - essay mode (e.g. "textual_analysis", "peel_paragraph")
 * @param {number} wordCount - document word count
 * @returns {number|null} new display score, or null if data is insufficient
 */
export function rescoreAfterDismissal(originalScores, currentLabelCounts, mode, wordCount) {
  if (!originalScores) return null;
  const counts = currentLabelCounts || {};

  // Power: unchanged (text-based, no label penalties)
  const powerScore = originalScores.power?.score ?? null;

  // Variety: reconstruct base, reapply development penalty
  let varietyScore = originalScores.variety?.score ?? null;
  if (varietyScore != null) {
    const origDevPenalty = originalScores.variety?.details?.developmentPenalty ?? 0;
    const varietyBase = varietyScore + origDevPenalty;
    const newDevCount = sumLabelCounts(DEVELOPMENT_LABELS, counts);
    const newDevPenalty = cappedPenalty(newDevCount, 5, 20);
    varietyScore = clamp(Math.round(varietyBase - newDevPenalty), 0, 100);
  }

  // Cohesion: reconstruct raw, reapply tiered penalties
  let cohesionScore = originalScores.cohesion?.score ?? null;
  if (cohesionScore != null) {
    const d = originalScores.cohesion?.details || {};
    const origCritPen = d.criticalCohesionPenalty ?? 0;
    const origModPen = d.moderateCohesionPenalty ?? 0;
    const origMinorPen = d.minorCohesionPenalty ?? 0;
    const cohesionRaw = cohesionScore + origCritPen + origModPen + origMinorPen;

    const newCritCount = sumLabelCounts(COHESION_CRITICAL_LABELS, counts);
    const newModCount = sumLabelCounts(COHESION_MODERATE_LABELS, counts);
    const newMinorCount = sumLabelCounts(COHESION_MINOR_LABELS, counts);
    const newCritPen = cappedPenalty(newCritCount, 8, 25);
    const newModPen = cappedPenalty(newModCount, 4, 12);
    const newMinorPen = cappedPenalty(newMinorCount, 2, 6);
    cohesionScore = clamp(Math.round(cohesionRaw - newCritPen - newModPen - newMinorPen), 0, 100);
  }

  // Precision: reconstruct from penalty + bonuses, reapply with deduped counts
  let precisionScore = originalScores.precision?.score ?? null;
  if (precisionScore != null) {
    const d = originalScores.precision?.details || {};
    const origPenalty = d.penalty ?? 0;
    const pvBonus = d.powerVerbBonus ?? 0;
    const varietyBonus = d.varietyBonus ?? 0;

    const newConcisionDD = sumLabelCountsDeduped(CONCISION_LABELS, counts, 2);
    const newClarityDD = sumLabelCountsDeduped(CLARITY_LABELS, counts, 2);
    const newConventionsDD = sumLabelCountsDeduped(CONVENTIONS_LABELS, counts, 2);
    const newPenalty = cappedPenalty(newConcisionDD, 2.5, 15)
      + cappedPenalty(newClarityDD, 2, 18)
      + cappedPenalty(newConventionsDD, 2, 10);

    precisionScore = clamp(Math.round(100 - newPenalty + pvBonus + varietyBonus), 0, 100);
  }

  // Average meters (same logic as handleRenderedWithSnapshot)
  const hideCohesion = mode === "peel_paragraph";
  const meterScores = [
    powerScore,
    varietyScore,
    hideCohesion ? null : cohesionScore,
    precisionScore,
  ].filter((s) => s != null);

  if (!meterScores.length || precisionScore == null) return null;

  const rawAverage = meterScores.reduce((a, b) => a + b, 0) / meterScores.length;
  const words = wordCount || 0;
  const lengthPenalty = words > 0 && words < 400 ? Math.round((400 - words) * 0.03) : 0;
  const rawScore = Math.max(0, rawAverage - lengthPenalty);
  return Math.round(Math.sqrt(rawScore / 100) * 100);
}
