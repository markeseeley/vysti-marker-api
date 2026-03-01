export const LABEL_BUCKETS = [
  {
    id: "thesis_org",
    name: "Thesis & Organization",
    matchers: [
      /thesis/i,
      /topic sentence/i,
      /organization/i,
      /transition/i,
      /boundary statement/i,
      /introduction/i,
      /conclusion/i,
      /paragraph/i,
      /structure/i
    ]
  },
  {
    id: "evidence_integration",
    name: "Evidence & Integration",
    matchers: [
      /quote/i,
      /quotation/i,
      /evidence/i,
      /citation/i,
      /\bcite\b/i,
      /works cited/i,
      /power verbs/i,
      /support/i
    ]
  },
  {
    id: "voice_audience",
    name: "Voice & Audience",
    matchers: [
      /personal pronoun/i,
      /\bI\b/i,
      /\bwe\b/i,
      /\byou\b/i,
      /reader/i,
      /audience/i
    ]
  },
  {
    id: "style_clarity",
    name: "Style & Clarity",
    matchers: [
      /contraction/i,
      /\bwhich\b/i,
      /\bfact\b/i,
      /\bprove\b/i,
      /weak verb/i,
      /article/i,
      /vague/i,
      /people/i,
      /human/i,
      /word choice/i,
      /avoid using the word/i,
      /more than once in a sentence/i
    ]
  },
  {
    id: "grammar_mechanics",
    name: "Grammar & Mechanics",
    matchers: [
      /subject[- ]verb/i,
      /agreement/i,
      /tense/i,
      /comma/i,
      /punctuation/i,
      /spelling/i,
      /apostrophe/i
    ]
  },
  {
    id: "formatting",
    name: "Formatting & Conventions",
    matchers: [
      /MLA/i,
      /header/i,
      /format/i,
      /title/i,
      /author/i
    ]
  },
  { id: "other", name: "Other", matchers: [] }
];

export const BUCKET_OVERRIDES = {
  "Avoid quotations in the conclusion": "evidence_integration",
  "Avoid quotations in the introduction": "evidence_integration",
  "Clarify pronouns and antecedents": "grammar_mechanics",
  "Avoid weak verbs": "evidence_integration"
};

// Shared bucket color palette (same order as LABEL_BUCKETS)
// Thesis maroon, Evidence blue, Voice green, Style yellow, Grammar purple, Formatting red, Other teal
export const BUCKET_COLORS = [
  "rgba(169, 13, 34, 1)",    // maroon - Thesis & Organization
  "rgba(52, 152, 219, 1)",   // blue - Evidence & Integration
  "rgba(46, 204, 113, 1)",   // green - Voice & Audience
  "rgba(241, 196, 15, 1)",   // yellow - Style & Clarity
  "rgba(155, 89, 182, 1)",   // purple - Grammar & Mechanics
  "rgba(231, 76, 60, 1)",    // red - Formatting & Conventions
  "rgba(26, 188, 156, 1)"    // teal - Other
];

export function getBucketColor(bucketId, alpha = 1.0) {
  const bucketIndex = LABEL_BUCKETS.findIndex((bucket) => bucket.id === bucketId);
  if (bucketIndex === -1) {
    const otherIndex = LABEL_BUCKETS.findIndex((bucket) => bucket.id === "other");
    const baseColor =
      BUCKET_COLORS[otherIndex >= 0 ? otherIndex : BUCKET_COLORS.length - 1];
    return baseColor.replace("1)", `${alpha})`);
  }
  const baseColor = BUCKET_COLORS[bucketIndex];
  return baseColor.replace("1)", `${alpha})`);
}

export function getBucketIdForLabel(label) {
  if (!label) return "other";
  if (BUCKET_OVERRIDES[label]) return BUCKET_OVERRIDES[label];
  for (const bucket of LABEL_BUCKETS) {
    if (bucket.id === "other") continue;
    if (bucket.matchers.some((rx) => rx.test(label))) return bucket.id;
  }
  return "other";
}
