/**
 * Maps issue labels to student metrics (Power, Variety, Cohesion, Precision)
 * This creates harmony between the Most Common Issues chart and the metric meters.
 */

import {
  CONCISION_LABELS,
  CLARITY_LABELS,
  CONVENTIONS_LABELS,
  DEVELOPMENT_LABELS,
  PARAGRAPH_LABELS,
  TRANSITION_LABELS
} from "./studentMetrics";

// Metric definitions with primary colors and gradients
export const METRICS = {
  power: {
    id: "power",
    name: "Power",
    color: "rgb(220, 53, 69)", // Red
    bgColor: "rgb(220, 53, 69)",
    gradientStart: "rgb(234, 150, 157)", // Muted tint at bottom
    gradientEnd: "rgb(220, 53, 69)", // Bold at top
    description: "Replace weak verbs (show, use, make) with precise, analytical alternatives"
  },
  variety: {
    id: "variety",
    name: "Analysis",
    color: "rgb(13, 110, 253)", // Blue
    bgColor: "rgb(13, 110, 253)",
    gradientStart: "rgb(148, 183, 254)", // Muted tint at bottom
    gradientEnd: "rgb(13, 110, 253)", // Bold at top
    description: "Use rhetorical or literary techniques, cite evidence, and develop analysis in each body paragraph"
  },
  cohesion: {
    id: "cohesion",
    name: "Cohesion",
    color: "rgb(25, 135, 84)", // Green
    bgColor: "rgb(25, 135, 84)",
    gradientStart: "rgb(147, 207, 180)", // Muted tint at bottom
    gradientEnd: "rgb(25, 135, 84)", // Bold at top
    description: "Connect ideas within paragraphs, across paragraph breaks, and through your thesis"
  },
  precision: {
    id: "precision",
    name: "Precision",
    color: "rgb(255, 193, 7)", // Yellow
    bgColor: "rgb(255, 193, 7)",
    gradientStart: "rgb(255, 224, 130)", // Muted tint at bottom
    gradientEnd: "rgb(255, 193, 7)", // Bold at top
    description: "Write concisely, use clear and specific language, and follow academic conventions"
  },
  other: {
    id: "other",
    name: "Other",
    color: "rgb(108, 117, 125)", // Gray
    bgColor: "rgb(108, 117, 125)",
    gradientStart: "rgb(182, 186, 190)", // Muted tint at bottom
    gradientEnd: "rgb(108, 117, 125)", // Bold at top
    description: "Structural and formatting issues"
  }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pattern matchers for each metric
const METRIC_MATCHERS = {
  power: [
    /weak verb/i,
    /power verb/i,
    /avoid.*\b(show|use|make|do|get|have)\b/i,
    /precise verb/i,
    /verb choice/i
  ],
  variety: [
    // Exact-match development labels (quotation rules) — checked first
    ...DEVELOPMENT_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    /technique/i,
    /device/i,
    /rhetorical/i,
    /evidence/i,
    /quotation/i,
    /quote/i,
    /citation/i,
    /cite/i,
    /only cite/i,
    /shorten.*integrate.*quotation/i,
    /modify.*quotation/i
  ],
  cohesion: [
    // Exact-match paragraph/transition labels — checked first
    ...PARAGRAPH_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    ...TRANSITION_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    /transition/i,
    /boundary/i,
    /topic sentence/i,
    /cohesion/i,
    /connection/i,
    /flow/i,
    /word family/i,
    /coherence/i,
    /link/i,
    /first sentence.*state/i,
    /opening sentence/i,
    /organize/i,
    /organization/i,
    /paragraph/i,
    /undeveloped/i,
    /develop/i,
    /thesis/i,
    /introduction/i,
    /conclusion/i,
    /avoid.*quotation.*in.*thesis/i,
    /quotation.*thesis/i,
    /no quotation.*final/i,
    /topic.*conclusion/i,
    /put.*topic.*conclusion/i,
    /assignment.*write/i
  ],
  precision: [
    ...CONCISION_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    ...CLARITY_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    ...CONVENTIONS_LABELS.map((label) => new RegExp(escapeRegex(label), "i")),
    /unnecessary/i,
    /wordy/i,
    /imprecise/i,
    /vague/i,
    /pronoun/i,
    /antecedent/i,
    /avoid.*\b(people|human|society|universe|reality|life|truth)\b/i,
    /avoid.*\b(therefore|thereby|hence|thus)\b/i,
    /avoid.*\b(and)\b/i,
    /avoid.*\bwhich\b/i,
    /\bwe\b.*\bus\b.*\bour\b/i,
    /\bi\b.*\bwe\b/i,
    /reader/i,
    /audience/i,
    /personal pronoun/i,
    /contraction/i,
    /avoid refer/i,
    /avoid using.*word/i,
    /capitalize.*word/i,
    /qualify/i,
    /repetition/i,
    /tense/i,
    /uncountable/i
  ],
  other: [
    /^title$/i,  // Only exact "title" match
    /MLA/i,
    /works cited/i,
    /header/i,
    /follow.*process.*in-text/i,
    /article.*error/i
  ]
};

// Labels that contain variety-matching keywords (quotation, device) but are
// structurally cohesion issues — route to cohesion before variety can claim them
const COHESION_OVERRIDES = new Set([
  "avoid beginning a sentence with a quotation",
  "the topics in the thesis statement should be specific devices or strategies"
]);

// Labels that contain variety-matching keywords (citation) but are
// conventions issues — route to precision before variety can claim them
const PRECISION_OVERRIDES = new Set([
  "add parenthetical citation"
]);

/**
 * Determine which metric a label belongs to
 * @param {string} label - The issue label
 * @returns {string} - Metric ID (power, variety, cohesion, precision, other)
 */
export function getLabelMetric(label) {
  if (!label || typeof label !== "string") return "other";

  const normalizedLabel = label.trim().toLowerCase();

  // Explicit overrides — some labels match variety keywords but belong elsewhere
  if (COHESION_OVERRIDES.has(normalizedLabel)) return "cohesion";
  if (PRECISION_OVERRIDES.has(normalizedLabel)) return "precision";

  // Check each metric's matchers in priority order
  // Power first (most specific)
  for (const pattern of METRIC_MATCHERS.power) {
    if (pattern.test(normalizedLabel)) return "power";
  }

  // Variety
  for (const pattern of METRIC_MATCHERS.variety) {
    if (pattern.test(normalizedLabel)) return "variety";
  }

  // Cohesion (check BEFORE "other" to catch organizational issues)
  for (const pattern of METRIC_MATCHERS.cohesion) {
    if (pattern.test(normalizedLabel)) return "cohesion";
  }

  // Precision (most labels fall here)
  for (const pattern of METRIC_MATCHERS.precision) {
    if (pattern.test(normalizedLabel)) return "precision";
  }

  // Other (structural/formatting) - checked LAST
  // Only labels that don't fit any metric go here
  for (const pattern of METRIC_MATCHERS.other) {
    if (pattern.test(normalizedLabel)) return "other";
  }

  return "other";
}

/**
 * Get the metric object for a label
 * @param {string} label - The issue label
 * @returns {object} - Metric object with id, name, color, etc.
 */
export function getMetricForLabel(label) {
  const metricId = getLabelMetric(label);
  return METRICS[metricId] || METRICS.other;
}

/**
 * Group labels by metric
 * @param {Array<{label: string, count: number}>} entries - Label entries with counts
 * @returns {object} - Object with metric IDs as keys and arrays of entries as values
 */
export function groupLabelsByMetric(entries) {
  const grouped = {
    power: [],
    variety: [],
    cohesion: [],
    precision: [],
    other: []
  };

  entries.forEach((entry) => {
    const metricId = getLabelMetric(entry.label);
    grouped[metricId].push(entry);
  });

  return grouped;
}

/**
 * Intelligently abbreviate a label for display while preserving meaning
 * @param {string} label - The full label text
 * @returns {string} - Abbreviated label (no ellipses)
 */
export function shortenLabel(label) {
  if (!label) return "";

  // Aggressive abbreviation - preserve core meaning, remove filler
  let shortened = label
    // Remove common verbose prefixes
    .replace(/^Avoid using the words?\s+/i, "")
    .replace(/^Avoid referring to\s+/i, "")
    .replace(/^Avoid the vague term\s+/i, "Vague: ")
    .replace(/^Avoid the (?:word|phrase)\s+/i, "")
    .replace(/^Avoid using\s+/i, "")
    .replace(/^Avoid\s+/i, "")

    // Shorten common phrases
    .replace(/more than (once|twice) in a sentence/i, "$1/sent.")
    .replace(/in a sentence/i, "/sent.")
    .replace(/in an essay/i, "/essay")
    .replace(/, and /g, ", ")
    .replace(/\bparagraphs?\b/gi, "para.")
    .replace(/\bsentences?\b/gi, "sent.")
    .replace(/\bquotations?\b/gi, "quote")
    .replace(/\btransitions?\b/gi, "trans.")

    // Simplify
    .trim();

  // If still too long (>30 chars), extract key words only
  if (shortened.length > 30) {
    // Extract properly quoted words/phrases (skip possessive apostrophes)
    const quotedParts = [];
    const quoteRe = /(?:^|[\s,(])'([^']+?)'|"([^"]+?)"/g;
    let m;
    while ((m = quoteRe.exec(shortened)) !== null) {
      quotedParts.push(m[1] || m[2]);
    }
    if (quotedParts.length) return quotedParts.join(", ");

    // Otherwise keep first 30 chars, break at word boundary
    const words = shortened.split(/\s+/);
    let result = "";
    for (const word of words) {
      if ((result + " " + word).trim().length > 30) break;
      result += (result ? " " : "") + word;
    }
    return result || shortened.substring(0, 30);
  }

  return shortened;
}
