import { normalizeLabelTrim } from "./normalize";

/**
 * Rules that require multi-sentence or structural edits.
 * These issues route the student to the Preview editor instead of
 * offering a single-sentence rewrite box in the Revision panel.
 */
const PREVIEW_ONLY_RULES = [
  // Structural / Paragraph-Level
  "Every paragraph needs evidence",
  "Undeveloped paragraph",
  "Incomplete conclusion",
  "Floating quotation",
  "Follow the process for inserting evidence",
  "Explain the significance of evidence",
  "Off-topic",
  // Thesis / Introduction
  "Organization of thesis statement",
  "Use a closed thesis statement",
  "The topics in the thesis statement should be specific devices or strategies",
  "Put this topic in the thesis statement",
  "The first sentence should state the author's full name, genre and title",
  "Follow the organization of the thesis",
  // Paragraph Boundaries
  "Use a boundary statement when transitioning between paragraphs",
  "Final sentence of body paragraphs",
  "No quotations in the final sentence of a body paragraph",
  "No quotations in topic sentences",
  "Avoid quotations in the introduction",
  "Avoid quotations in the conclusion",
];

export const PREVIEW_ONLY_LABELS = new Set(
  PREVIEW_ONLY_RULES.map((r) => normalizeLabelTrim(r))
);

export function isPreviewOnlyLabel(label) {
  return PREVIEW_ONLY_LABELS.has(normalizeLabelTrim(label || ""));
}
