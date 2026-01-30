export const API_BASE = "https://vysti-rules.onrender.com";
export const MARK_URL = `${API_BASE}/mark`;
export const MARK_TEXT_URL = `${API_BASE}/mark_text`;
export const DEFAULT_ZOOM = 1.5;

export const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "peel_paragraph", label: "Mini-essay paragraph" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" }
];

export const MODE_RULE_DEFAULTS = {
  textual_analysis: {
    description: "A formal and academic essay of analysis with all Vysti Rules running.",
    details: [
      "No first-person allowed or personal pronouns",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  peel_paragraph: {
    description: "One focused analytical paragraph following the Vysti Rules.",
    details: [
      "The first sentence should state the author, genre, title, and summary.",
      "The first sentence should include devices and/or strategies like a closed thesis",
      "No first-person allowed or personal pronouns",
      "Requires quoted evidence in the body of the paragraph.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  reader_response: {
    description: "More personal voice allowed, but still needs argument + evidence.",
    details: [
      "Allows first-person and personal pronouns",
      "Allows contractions and 'which'",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  argumentation: {
    description: "Argumentation is more open mode beyond textual analysis.",
    details: [
      "Allows for past tense.",
      "Allows first-person and personal pronouns",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  }
};
