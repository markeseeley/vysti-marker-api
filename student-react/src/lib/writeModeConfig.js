/**
 * Per-mode config for the Write product (Phase 1).
 *
 * Same-shape modes (Analytic essay, Frame essay, Reader response, Research
 * paper) reuse the existing 6-stage guide with stage description tweaks.
 * Foundation modes cap which stages are reachable. Mini-essay (PEEL) and
 * Argumentation need their own guide architecture — deferred to Phase 2
 * (excluded from the picker for now).
 *
 * Each entry:
 *   key:          mode value used in the API (matches config.js MODES)
 *   label:        student-facing dropdown label
 *   summary:      one-line "what this is" for the picker dropdown
 *   maxStage:     1..6 — last reachable stage; null means full 6 stages
 *   stageOverrides: optional per-stage description override keyed by step.id
 *                  (first-sentence, closed-thesis, intro-summary,
 *                   topic-sentence, body-evidence, conclusion)
 *   firstSentenceExample: optional override for Stage 1's example line
 */

export const WRITE_MODE_TEXTUAL_ANALYSIS = "textual_analysis";
export const WRITE_MODE_ANALYTIC_FRAME = "analytic_frame";
export const WRITE_MODE_READER_RESPONSE = "reader_response";
export const WRITE_MODE_RESEARCH_PAPER = "research_paper";
export const WRITE_MODE_FOUNDATION_1 = "foundation_1";
export const WRITE_MODE_FOUNDATION_2 = "foundation_2";
export const WRITE_MODE_FOUNDATION_3 = "foundation_3";
export const WRITE_MODE_FOUNDATION_4 = "foundation_4";
export const WRITE_MODE_FOUNDATION_5 = "foundation_5";

export const WRITE_MODE_DEFAULT = WRITE_MODE_TEXTUAL_ANALYSIS;

/** Groups for the picker — keeps Foundation steps visually separated. */
export const WRITE_MODE_GROUPS = [
  {
    label: "Analytic essay variants",
    options: [
      WRITE_MODE_TEXTUAL_ANALYSIS,
      WRITE_MODE_ANALYTIC_FRAME,
      WRITE_MODE_READER_RESPONSE,
      WRITE_MODE_RESEARCH_PAPER,
    ],
  },
  {
    label: "Foundation steps (one stage at a time)",
    options: [
      WRITE_MODE_FOUNDATION_1,
      WRITE_MODE_FOUNDATION_2,
      WRITE_MODE_FOUNDATION_3,
      WRITE_MODE_FOUNDATION_4,
      WRITE_MODE_FOUNDATION_5,
    ],
  },
];

export const WRITE_MODE_CONFIG = {
  [WRITE_MODE_TEXTUAL_ANALYSIS]: {
    label: "Analytic essay",
    summary: "A formal third-person analysis of an author's literary techniques.",
    maxStage: 6,
    stageOverrides: {},
  },
  [WRITE_MODE_ANALYTIC_FRAME]: {
    label: "Frame essay",
    summary: "Analyze a text through a theoretical or critical framework introduced up front.",
    maxStage: 6,
    stageOverrides: {
      "intro-summary":
        "Now go back between your first sentence and your thesis. Introduce the theoretical or critical framework you'll use — a short quotation establishing the lens is welcome. Then write a sentence per device situating the reader where the technique appears.",
    },
  },
  [WRITE_MODE_READER_RESPONSE]: {
    label: "Reader response",
    summary: "Analytical structure with a personal voice — first person and contractions are welcome.",
    maxStage: 6,
    stageOverrides: {
      "first-sentence":
        "State the author's full name, the genre, the title of the text (properly formatted), and a concrete summary using a power verb. You may write in the first person here if it helps frame your response.",
      "topic-sentence":
        "Write a boundary statement to transition into the body. Begin each body paragraph with a topic sentence that names the device or strategy. You can connect each device to your personal reaction — what struck you about it?",
    },
  },
  [WRITE_MODE_RESEARCH_PAPER]: {
    label: "Research paper",
    summary: "Formal academic paper with MLA citations; thesis can be broader than device-naming.",
    maxStage: 6,
    stageOverrides: {
      "closed-thesis":
        "End your introduction with a thesis. A research paper thesis doesn't have to name specific literary devices — focus on the claim your paper will defend. Use precise language and avoid weak verbs.",
      "topic-sentence":
        "Write a boundary statement after your introduction. Each body paragraph should begin with a topic sentence that advances one part of your thesis (devices, sources, or sub-claims are all valid organizing principles).",
      "body-evidence":
        "Support each topic sentence with evidence: provide context, integrate a quotation or paraphrase, explain its significance, and relate it back to your thesis. Use MLA parenthetical citations for each source.",
    },
  },
  [WRITE_MODE_FOUNDATION_1]: {
    label: "Step One — First sentence only",
    summary: "Practice writing just the opening sentence of an analytic essay.",
    maxStage: 1,
    stageOverrides: {},
  },
  [WRITE_MODE_FOUNDATION_2]: {
    label: "Step Two — First sentence + thesis",
    summary: "First sentence followed by a closed thesis.",
    maxStage: 2,
    stageOverrides: {},
  },
  [WRITE_MODE_FOUNDATION_3]: {
    label: "Step Three — Full introduction",
    summary: "Full intro paragraph: first sentence, situating sentences per device, then the thesis.",
    maxStage: 3,
    stageOverrides: {},
  },
  [WRITE_MODE_FOUNDATION_4]: {
    label: "Step Four — Intro + topic sentence",
    summary: "Full intro plus a boundary statement and your first topic sentence.",
    maxStage: 4,
    stageOverrides: {},
  },
  [WRITE_MODE_FOUNDATION_5]: {
    label: "Step Five — Intro + body",
    summary: "Full intro, topic sentence, and at least one developed body paragraph.",
    maxStage: 5,
    stageOverrides: {},
  },
};

/** Resolve a mode value to its config, falling back to the default safely. */
export function getWriteModeConfig(mode) {
  return WRITE_MODE_CONFIG[mode] || WRITE_MODE_CONFIG[WRITE_MODE_DEFAULT];
}

/** True if the mode is one of the Foundation-N variants. */
export function isFoundationMode(mode) {
  return typeof mode === "string" && mode.startsWith("foundation_");
}
