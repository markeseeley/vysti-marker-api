/**
 * Writing-stage detection and issue filtering for the Write page.
 *
 * Detects how far the student has progressed through the Foundation 1-6
 * essay-building sequence and suppresses premature issues so the sidebar
 * only shows relevant feedback for the current stage.
 *
 * Foundation stages:
 *   1. First Sentence   — author, genre, title, concrete summary
 *   2. Closed Thesis     — first sentence + thesis naming 2-3 devices
 *   3. Intro Summary     — 3-4 sentence intro (gesture toward devices) + thesis
 *   4. Topic Sentence    — full intro + boundary statement + first body topic sentence
 *   5. Body Evidence     — intro + body paragraphs with evidence (context, quote, explain, relate)
 *   6. Conclusion & Title — full essay with conclusion and proper title
 */

// ── Stage constants (ordered by progression) ──
export const STAGE_EMPTY = "EMPTY";
export const STAGE_FIRST_SENTENCE = "FIRST_SENTENCE";      // Foundation 1
export const STAGE_CLOSED_THESIS = "CLOSED_THESIS";         // Foundation 2
export const STAGE_INTRO_SUMMARY = "INTRO_SUMMARY";         // Foundation 3
export const STAGE_TOPIC_SENTENCE = "TOPIC_SENTENCE";       // Foundation 4
export const STAGE_BODY_EVIDENCE = "BODY_EVIDENCE";         // Foundation 5
export const STAGE_CONCLUSION = "CONCLUSION";               // Foundation 6

// Backward-compat aliases — kept so existing imports still resolve.
// These map to the closest equivalent in the new 6-stage system.
export const STAGE_THESIS = STAGE_CLOSED_THESIS;
export const STAGE_BODY = STAGE_BODY_EVIDENCE;

/** Ordered array for index-based comparisons */
export const STAGE_ORDER = [
  STAGE_EMPTY,
  STAGE_FIRST_SENTENCE,
  STAGE_CLOSED_THESIS,
  STAGE_INTRO_SUMMARY,
  STAGE_TOPIC_SENTENCE,
  STAGE_BODY_EVIDENCE,
  STAGE_CONCLUSION,
];

/** Return the next stage after the given one, or null if already at the end. */
export function nextStage(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

// ── Label classification patterns ──

/** Labels relevant when only the first sentence has been written (Foundation 1) */
const FIRST_SENTENCE_PATTERNS = [
  /first sentence/i,
  /author.*full name/i,
  /author's name/i,
  /genre/i,
  /title.*text/i,
  /title.*minor works/i,
  /title.*major works/i,
  /concrete.*summary/i,
  /the author/i, // "Use the author's name instead of 'the author'"
];

/** Labels relevant during the thesis-writing stage (Foundation 2) */
const THESIS_PATTERNS = [
  /closed thesis/i,
  /quotation.*thesis/i,
  /thesis statement/i,
  /specific.*devices/i,
  /specific.*strategies/i,
  /topics.*thesis/i,
];

/** Labels relevant during the intro summary stage (Foundation 3) */
const INTRO_SUMMARY_PATTERNS = [
  /introduction/i,
  /introductory/i,
  /one-sentence summary/i,
  /quotation.*introduction/i,
  /avoid.*quotation.*intro/i,
];

/** Labels relevant when writing topic sentences & transitions (Foundation 4) */
const TOPIC_SENTENCE_PATTERNS = [
  /topic sentence/i,
  /boundary statement/i,
  /transition/i,
  /organization.*thesis/i,
  /off-topic/i,
  /put this topic/i,
];

/** Labels relevant during evidence/analysis in body paragraphs (Foundation 5) */
const EVIDENCE_PATTERNS = [
  /floating quotation/i,
  /process.*inserting.*evidence/i,
  /explain.*significance/i,
  /significance.*evidence/i,
  /shorten.*modify.*integrat/i,
  /cite.*quotation/i,
  /quotation.*topic sentence/i,
  /quotation.*final sentence/i,
  /begin.*sentence.*quotation/i,
  /undeveloped/i,
  /evidence.*development/i,
];

/** Labels relevant for conclusion & title (Foundation 6) */
const CONCLUSION_PATTERNS = [
  /conclusion/i,
  /essay title/i,
  /capitalize.*title/i,
  /title.*major works/i,
  /title.*minor works/i,
];

/** Conclusion-only labels that should NOT appear during body paragraph writing */
const CONCLUSION_ONLY_PATTERNS = [
  /conclusion/i,
  /essay title/i,
  /capitalize.*title/i,
];

// ── Sentence counting utility ──

/**
 * Count sentences in a block of text.
 * Matches sentence-ending punctuation followed by whitespace or end-of-string.
 * Skips common abbreviations (e.g., i.e., etc., vs.).
 */
export function countSentences(text) {
  const re = /[.!?](?:\s|$)/g;
  let count = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.substring(0, m.index + 1);
    if (/\b(?:e\.g|i\.e|etc|vs)\.$/.test(before)) continue;
    count++;
  }
  return count;
}

/**
 * Detect the writing stage from the raw text.
 *
 * This is a purely structural check — it looks at paragraph count,
 * sentence count, and text length to determine the minimum stage.
 * The resolveStage() function can then promote forward when issues clear.
 *
 * @param {string} text - The student's current text
 * @param {object} [opts] - Optional hints
 * @param {number} [opts.deviceCount] - Number of thesis devices (predicts body paragraph count)
 * @returns {string} One of the STAGE_* constants
 */
export function detectStage(text, { deviceCount = 0 } = {}) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length < 20) return STAGE_EMPTY;

  // Split into paragraphs
  const paragraphs = trimmed
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const paraCount = paragraphs.length;

  // ── Multi-paragraph: Foundation 4-6 territory ──
  if (paraCount >= 2) {
    // Determine minimum paragraphs before a conclusion is possible:
    // intro (1) + expected body paragraphs + conclusion (1).
    // If deviceCount is known, expect that many body paragraphs.
    // Otherwise default to at least 2 body paragraphs (4 total).
    const expectedBodyParas = deviceCount > 0 ? deviceCount : 2;
    const minParasForConclusion = expectedBodyParas + 2; // intro + body + conclusion

    if (paraCount >= minParasForConclusion) {
      // Check if ALL body paragraphs are substantial (not just one)
      const bodyParagraphs = paragraphs.slice(1, -1);
      const allBodySubstantial = bodyParagraphs.every(
        (p) => countSentences(p) >= 3
      );

      if (allBodySubstantial) {
        const lastPara = paragraphs[paraCount - 1];
        const lastSentences = countSentences(lastPara);
        // Conclusion paragraphs typically don't contain quotations
        const lastHasQuotes = /[""\u201C\u201D]/.test(lastPara);
        if (lastSentences >= 2 && !lastHasQuotes) {
          return STAGE_CONCLUSION;
        }
      }
    }

    // Check if body paragraphs have evidence (quotation marks suggest quotes)
    const bodyText = paragraphs.slice(1).join(" ");
    const hasQuotations = /[""\u201C\u201D]/.test(bodyText);
    const bodySentences = countSentences(bodyText);

    if (bodySentences >= 3 || hasQuotations) {
      return STAGE_BODY_EVIDENCE;
    }

    // 2+ paragraphs but body is short — likely just a topic sentence
    return STAGE_TOPIC_SENTENCE;
  }

  // ── Single paragraph: Foundation 1-3 territory ──
  const raw = paragraphs[0] || "";
  const sentenceCount = countSentences(raw);

  // 3+ sentences in a single paragraph — full intro summary
  if (sentenceCount >= 3) return STAGE_INTRO_SUMMARY;

  // 2 sentences — first sentence + thesis
  if (sentenceCount >= 2) return STAGE_CLOSED_THESIS;

  // 1 sentence or enough text to analyze
  if (sentenceCount >= 1 || trimmed.length >= 50) return STAGE_FIRST_SENTENCE;

  return STAGE_EMPTY;
}

// ── Label matching utility ──

/**
 * Check if a label matches any pattern in a list.
 */
function matchesAny(label, patterns) {
  return patterns.some((p) => p.test(label));
}

/**
 * Promote the structural stage when the current step's issues are resolved.
 *
 * Called with the RAW (unfiltered) issues from the API so we can tell whether
 * the backend flagged any problems for the current stage.
 *
 * @param {string} structuralStage - Stage from detectStage (text-only)
 * @param {Array}  rawIssues       - Unfiltered issues from the last /check_text response
 * @param {boolean} hasChecked     - True once the API has responded at least once
 * @param {Object}  [opts]         - Optional sentence/device counts for intro gate
 * @param {number}  [opts.sentenceCount] - Total sentences in current text
 * @param {number}  [opts.deviceCount]   - Number of filled thesis devices
 * @returns {string} Potentially promoted stage
 */
export function resolveStage(structuralStage, rawIssues, hasChecked, opts = {}) {
  const { sentenceCount = 0, deviceCount = 0 } = opts;
  if (!hasChecked) return structuralStage;

  const issues = rawIssues || [];

  // First sentence passes → advance guide to closed thesis
  if (structuralStage === STAGE_FIRST_SENTENCE) {
    const hasIssues = issues.some((i) =>
      matchesAny(i.label, FIRST_SENTENCE_PATTERNS)
    );
    if (!hasIssues) return STAGE_CLOSED_THESIS;
  }

  // Thesis written structurally → always advance guide to intro summary.
  // Thesis-quality issues still appear in the sidebar via filtering.
  if (structuralStage === STAGE_CLOSED_THESIS) {
    return STAGE_INTRO_SUMMARY;
  }

  // Intro summary passes → advance guide to topic sentence
  // Gate: if the user planned N devices, require N + 2 sentences
  // (first sentence + N device-summary sentences + thesis sentence)
  if (structuralStage === STAGE_INTRO_SUMMARY) {
    if (deviceCount > 0 && sentenceCount < deviceCount + 2) {
      return STAGE_INTRO_SUMMARY;
    }
    const hasThesisIssues = issues.some((i) =>
      matchesAny(i.label, THESIS_PATTERNS)
    );
    const hasIntroIssues = issues.some((i) =>
      matchesAny(i.label, INTRO_SUMMARY_PATTERNS)
    );
    if (!hasThesisIssues && !hasIntroIssues) return STAGE_TOPIC_SENTENCE;
  }

  // Topic sentence passes → advance guide to body evidence
  if (structuralStage === STAGE_TOPIC_SENTENCE) {
    const hasTopicIssues = issues.some((i) =>
      matchesAny(i.label, TOPIC_SENTENCE_PATTERNS)
    );
    if (!hasTopicIssues) return STAGE_BODY_EVIDENCE;
  }

  // Body evidence → conclusion: promote when expected body paragraphs
  // are developed (enough sentences and quotations) so the guide tells the
  // student to write a conclusion, even before detectStage sees one.
  //
  // When deviceCount is known, check exactly that many body paragraphs.
  // When unknown, check that at least one body paragraph is developed.
  // We only check the first N (expected) paragraphs so that a new
  // conclusion-in-progress paragraph doesn't pull the stage back down.
  if (structuralStage === STAGE_BODY_EVIDENCE && opts?.bodyParaStats) {
    const stats = opts.bodyParaStats;
    if (deviceCount > 0 && stats.length >= deviceCount) {
      const allDeveloped = stats.slice(0, deviceCount).every(
        (s) => s.sentences >= 5 && s.quotePairs >= 2
      );
      if (allDeveloped) return STAGE_CONCLUSION;
    } else if (deviceCount === 0 && stats.length > 0) {
      const anyDeveloped = stats.some(
        (s) => s.sentences >= 5 && s.quotePairs >= 2
      );
      if (anyDeveloped) return STAGE_CONCLUSION;
    }
  }

  return structuralStage;
}

/**
 * Determine if a label is allowed at the given stage.
 * Each stage inherits all labels from previous stages and adds its own.
 * Internal labels (prefixed with __) are never shown.
 */
function isLabelAllowedAtStage(label, stage) {
  // Never show internal labels (e.g., __title_checked:Strangers)
  if (label.startsWith("__")) return false;

  // Conclusion / full analysis — show everything
  if (stage === STAGE_CONCLUSION) return true;

  // Body evidence — show everything EXCEPT conclusion-only labels
  if (stage === STAGE_BODY_EVIDENCE) {
    return !matchesAny(label, CONCLUSION_ONLY_PATTERNS);
  }

  if (stage === STAGE_FIRST_SENTENCE) {
    return matchesAny(label, FIRST_SENTENCE_PATTERNS);
  }

  if (stage === STAGE_CLOSED_THESIS) {
    return (
      matchesAny(label, FIRST_SENTENCE_PATTERNS) ||
      matchesAny(label, THESIS_PATTERNS)
    );
  }

  if (stage === STAGE_INTRO_SUMMARY) {
    return (
      matchesAny(label, FIRST_SENTENCE_PATTERNS) ||
      matchesAny(label, THESIS_PATTERNS) ||
      matchesAny(label, INTRO_SUMMARY_PATTERNS)
    );
  }

  if (stage === STAGE_TOPIC_SENTENCE) {
    return (
      matchesAny(label, FIRST_SENTENCE_PATTERNS) ||
      matchesAny(label, THESIS_PATTERNS) ||
      matchesAny(label, INTRO_SUMMARY_PATTERNS) ||
      matchesAny(label, TOPIC_SENTENCE_PATTERNS)
    );
  }

  return false; // EMPTY — nothing shown
}

/**
 * Filter issues and labelCounts to only include stage-appropriate labels.
 *
 * @param {Array} issues - Array of { label, count, short_explanation, ... }
 * @param {Object} labelCounts - { labelString: count }
 * @param {string} stage - Current writing stage
 * @returns {{ issues: Array, labelCounts: Object, totalLabels: number }}
 */
export function filterByStage(issues, labelCounts, stage) {
  const filteredIssues = (issues || []).filter((issue) =>
    isLabelAllowedAtStage(issue.label, stage)
  );

  const filteredCounts = {};
  for (const [label, count] of Object.entries(labelCounts || {})) {
    if (isLabelAllowedAtStage(label, stage)) {
      filteredCounts[label] = count;
    }
  }

  const totalLabels = Object.values(filteredCounts).reduce((a, b) => a + b, 0);

  return { issues: filteredIssues, labelCounts: filteredCounts, totalLabels };
}