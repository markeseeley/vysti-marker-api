/**
 * IB Paper 1 Scoring — maps Vysti labels to IB Criteria A–D
 * and computes recommended criterion scores (0–5 each, /20 total).
 *
 * This is a derived output only. Vysti meters remain unchanged.
 */

import { getLabelMetric } from "@student/lib/labelToMetric";

// ── Criterion A: Understanding & Interpretation ──────────────────
// Structural indicators of comprehension depth.
// These labels are reclassified from other meters for IB purposes.
const A_PATTERNS = [
  { re: /one.sentence summary/i, weight: 2.0 },
  { re: /incomplete conclusion/i, weight: 1.5 },
  { re: /undeveloped paragraph/i, weight: 1.0 },
  { re: /closed thesis/i, weight: 1.5 },
  { re: /specific devices or strategies/i, weight: 1.5 },
];
const A_MAX = 8;

// ── Criterion B: Analysis & Evaluation ───────────────────────────
// Mapped from the Analysis (variety) meter.
function getBWeight(label) {
  const l = label.toLowerCase();
  if (/floating quotation/.test(l)) return 1.5;
  if (/explain.*significance/.test(l)) return 1.5;
  if (/every paragraph needs evidence/.test(l)) return 1.5;
  if (/follow the process.*evidence/.test(l)) return 1.0;
  return 0.5;
}
const B_MAX = 10;

// ── Criterion C: Focus & Organization ────────────────────────────
// Mapped from the Cohesion meter (minus labels moved to A).
function getCWeight(label) {
  const l = label.toLowerCase();
  if (/off.topic/.test(l)) return 2.0;
  if (/follow the organization/.test(l)) return 2.0;
  if (/put this topic/.test(l)) return 1.0;
  if (/boundary statement/.test(l)) return 0.5;
  if (/beginning.*sentence.*quotation/.test(l)) return 0.25;
  return 0.5;
}
const C_MAX = 8;

// ── Criterion D: Language ────────────────────────────────────────
// Weighted density: Precision conventions > Precision clarity > Power.
// Power labels (weak verbs) indicate limited vocabulary range but
// shouldn't dominate. Precision conventions (grammar, spelling, tense)
// are the strongest IB D signals.
const D_MAX_DENSITY = 10.0; // weighted issues per 100 words

function getDWeight(label) {
  const l = label.toLowerCase();
  // Precision: conventions (direct grammar/accuracy) — strongest D signal
  if (/article error/.test(l)) return 1.5;
  if (/subject.verb agreement/.test(l)) return 1.5;
  if (/spelling error/.test(l)) return 1.5;
  if (/commonly confused/.test(l)) return 1.5;
  if (/comma after/.test(l)) return 1.0;
  if (/possessive apostrophe/.test(l)) return 1.5;
  if (/present tense/.test(l)) return 1.0;
  if (/uncountable noun/.test(l)) return 1.5;
  // Precision: register (academic voice)
  if (/no contractions/.test(l)) return 1.0;
  if (/no.*[''"]i[''"].*we.*us|academic writing/.test(l)) return 0.75;
  if (/subjective language/.test(l)) return 0.75;
  // Precision: clarity/vocabulary precision
  if (/clarify pronouns/.test(l)) return 1.0;
  if (/noun repetition/.test(l)) return 0.75;
  if (/avoid.*vague|avoid the word|avoid the phrase/.test(l)) return 0.5;
  if (/unnecessary language/.test(l)) return 0.5;
  if (/qualify language/.test(l)) return 0.5;
  if (/absolute language/.test(l)) return 0.5;
  // Precision: other
  if (/avoid.*'which'/.test(l)) return 0.25;
  if (/avoid.*'and'/.test(l)) return 0.25;
  if (/avoid.*therefore|thereby|hence|thus/.test(l)) return 0.25;
  // Default precision label
  return 0.5;
}

// ── Helpers ──────────────────────────────────────────────────────
function getAWeight(label) {
  for (const { re, weight } of A_PATTERNS) {
    if (re.test(label)) return weight;
  }
  return 0;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getBand(score) {
  if (score >= 4) return "strong";
  if (score >= 2) return "developing";
  return "weak";
}

// ── Compute IB Criterion Scores ──────────────────────────────────
export function computeIBScores(labelCounts, wordCount) {
  let penaltyA = 0;
  let penaltyB = 0;
  let penaltyC = 0;
  let dWeighted = 0;

  for (const [label, count] of Object.entries(labelCounts || {})) {
    const n = Number(count) || 0;
    if (n <= 0) continue;

    // Criterion A labels first (reclassified)
    const aWeight = getAWeight(label);
    if (aWeight > 0) {
      penaltyA += n * aWeight;
      continue;
    }

    // Route remaining labels by Vysti meter
    const meter = getLabelMetric(label);
    switch (meter) {
      case "variety":
        penaltyB += n * getBWeight(label);
        break;
      case "cohesion":
        penaltyC += n * getCWeight(label);
        break;
      case "power":
        // Weak verbs indicate limited vocabulary range but shouldn't dominate
        dWeighted += n * 0.25;
        break;
      case "precision":
        dWeighted += n * getDWeight(label);
        break;
      default:
        break;
    }
  }

  // Floor of 1: IB awards 0 only when there is no response
  const floor = (wordCount && wordCount > 0) ? 1 : 0;

  const a = Math.max(floor, Math.round(5 * Math.max(0, 1 - penaltyA / A_MAX)));
  const b = Math.max(floor, Math.round(5 * Math.max(0, 1 - penaltyB / B_MAX)));
  const c = Math.max(floor, Math.round(5 * Math.max(0, 1 - penaltyC / C_MAX)));

  // Criterion D: weighted density (normalised across essay lengths)
  const wc = Math.max(wordCount || 1, 1);
  const density = (dWeighted / wc) * 100;
  const d = Math.max(floor, Math.round(5 * Math.max(0, 1 - density / D_MAX_DENSITY)));

  return { a, b, c, d, total: a + b + c + d };
}

// ── IB Examiner Comment Bank ─────────────────────────────────────
// Generalized, examiner-style comments. Never expose specific rules.

const IB_COMMENTS = {
  a: {
    strong: [
      "Thorough engagement with the text throughout.",
      "Clear and well-developed understanding of the work.",
      "Ideas are fully explored with genuine interpretive depth.",
      "Strong comprehension demonstrated across the response.",
      "The text is explored with insight and detail.",
    ],
    developing: [
      "Develop your ideas further to demonstrate fuller understanding of the text.",
      "Your engagement with the text needs more depth \u2014 expand on your interpretations.",
      "There is room for deeper exploration of the text\u2019s meaning and purpose.",
      "Strengthen your response by developing each point more thoroughly.",
      "Push beyond surface-level engagement to explore the text\u2019s complexities.",
    ],
    weak: [
      "The response needs significantly more development to show understanding.",
      "Limited engagement with the text \u2014 ensure each idea is fully explored.",
      "Much greater depth is needed to demonstrate comprehension of the work.",
      "Your ideas need substantial expansion to address the text meaningfully.",
      "The treatment of the text is too brief to convey genuine understanding.",
    ],
  },
  b: {
    strong: [
      "Effective use of evidence to support the analysis.",
      "Well-chosen examples integrated with clear analytical purpose.",
      "Evidence is used purposefully to develop the argument.",
      "Strong connection between textual evidence and analytical claims.",
      "Good analytical follow-through on the evidence presented.",
    ],
    developing: [
      "Ensure every piece of evidence is followed by clear analysis of its effect.",
      "Your evidence needs stronger analytical follow-through.",
      "Move beyond identifying features to evaluating their effect on meaning.",
      "Integrate evidence more effectively \u2014 explain why each example matters.",
      "Strengthen the link between your evidence and your analytical claims.",
    ],
    weak: [
      "The analysis relies too heavily on assertion without supporting evidence.",
      "Significant improvement needed in how evidence is selected and analysed.",
      "Evidence is either absent or insufficiently developed throughout.",
      "Each analytical claim must be grounded in specific textual evidence.",
      "The response lacks the evidence-based analysis expected at this level.",
    ],
  },
  c: {
    strong: [
      "Well-structured response with clear focus throughout.",
      "Logical organisation that supports the development of ideas.",
      "Clear focus maintained with strong cohesion between paragraphs.",
      "Effective structure with purposeful progression of argument.",
      "The argument is well-organised and easy to follow.",
    ],
    developing: [
      "Strengthen the connection between your thesis and body paragraphs.",
      "Your response would benefit from a clearer organising structure.",
      "Ensure each paragraph connects logically to your central argument.",
      "The focus of your argument could be sharpened \u2014 stay close to your thesis.",
      "Work on the flow between ideas to create a more cohesive response.",
    ],
    weak: [
      "The response lacks a clear organising principle or focused argument.",
      "Establish a clear thesis and follow it consistently throughout.",
      "The argument needs a coherent framework to guide the reader.",
      "Focus and organisation require substantial improvement.",
      "Without a clear structure, the analysis cannot develop effectively.",
    ],
  },
  d: {
    strong: [
      "Precise and effective language throughout.",
      "Clear command of academic register and expression.",
      "Language choices are deliberate and well-suited to the task.",
      "Confident, accurate expression that supports the argument.",
      "Language is used with clarity and precision.",
    ],
    developing: [
      "Tighten your language \u2014 replace vague terms with precise references.",
      "Your expression could be more precise and academically rigorous.",
      "Stronger word choices would sharpen the analysis throughout.",
      "Work on clarity and precision in your expression.",
      "Some lapses in register and accuracy \u2014 aim for more deliberate language.",
    ],
    weak: [
      "Language lacks the clarity and precision needed for effective analysis.",
      "Significant improvement needed in accuracy and register.",
      "Vague and imprecise language weakens the analysis throughout.",
      "The quality of expression hinders communication of ideas.",
      "Work on building a more precise academic vocabulary.",
    ],
  },
};

// ── Generate examiner-style comments for areas needing work ──────
export function generateIBComments(scores) {
  const comments = [];
  const CRITERIA = ["a", "b", "c", "d"];
  const LABELS = { a: "A", b: "B", c: "C", d: "D" };

  for (const key of CRITERIA) {
    const score = scores[key];
    if (score <= 3) {
      const band = getBand(score);
      comments.push({
        criterion: LABELS[key],
        text: pickRandom(IB_COMMENTS[key][band]),
        score,
      });
    }
  }

  // If all criteria are 4+, give one brief positive for the weakest
  if (comments.length === 0) {
    const weakest = CRITERIA.reduce((min, key) =>
      scores[key] < scores[min] ? key : min
    );
    comments.push({
      criterion: LABELS[weakest],
      text: pickRandom(IB_COMMENTS[weakest].strong),
      score: scores[weakest],
    });
  }

  return comments;
}

// ── Format IB scores for plain-text output (copy/download) ───────
export function formatIBScores(scores) {
  if (!scores) return "";
  return `IB Paper 1: ${scores.total}/20 (A:${scores.a} B:${scores.b} C:${scores.c} D:${scores.d})`;
}
