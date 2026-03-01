export const CONCISION_LABELS = [
  "Avoid referring to the reader or audience unless necessary",
  "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
  "Use the author's name instead of 'the author'",
  "No 'I', 'we', 'us', 'our' or 'you' in academic writing",
  "No contractions in academic writing",
  "Avoid the word 'which'",
  "Avoid using the word 'and' more than twice in a sentence"
];

export const CLARITY_LABELS = [
  "Avoid the vague term 'society'",
  "Avoid the vague term 'universe'",
  "Avoid the vague term 'reality'",
  "Avoid the vague term 'life'",
  "Avoid the vague term 'truth'",
  "Clarify pronouns and antecedents",
  "Do not refer to the text as a text; refer to context instead",
  "Avoid absolute language like 'always' or 'never'",
  "Article error",
  "Avoid the word 'ethos'",
  "Avoid the word 'pathos'",
  "Avoid the word 'logos'",
  "Avoid the word 'very'",
  "Avoid the phrase 'a lot'",
  "Avoid the vague term 'human'",
  "Avoid the vague term 'people'",
  "Avoid the vague term 'everyone'",
  "Avoid the vague term 'individual'",
  "Avoid the word 'fact'",
  "Avoid the word 'proof'",
  "Avoid the word 'prove'",
  "Noun repetition"
];

export const DEVELOPMENT_LABELS = [
  "Floating quotation",
  "Follow the process for inserting evidence",
  "Explain the significance of evidence",
  "Shorten, modify, and integrate quotations",
  "Only cite a quotation once",
  "No quotations in thesis statements",
  "No quotations in topic sentences",
  "No quotations in the final sentence of a body paragraph",
  "Avoid quotations in the introduction",
  "Avoid quotations in the conclusion",
  "Undeveloped paragraph",
  "Every paragraph needs evidence"
];

// Cohesion label severity tiers — Critical issues are fundamental structural
// failures, Moderate are significant but recoverable, Minor are stylistic.
export const COHESION_CRITICAL_LABELS = [
  "Off-topic",
  "Follow the organization of the thesis",
  "Use a closed thesis statement",
  "The topics in the thesis statement should be specific devices or strategies"
];

export const COHESION_MODERATE_LABELS = [
  "Put this topic in the thesis statement",
  "Incomplete conclusion"
];

export const COHESION_MINOR_LABELS = [
  "Avoid beginning a sentence with a quotation",
  "Use a boundary statement when transitioning between paragraphs"
];

// Combined arrays — used by labelToMetric.js for routing, PreviewMetrics for pills
export const PARAGRAPH_LABELS = [
  ...COHESION_CRITICAL_LABELS,
  ...COHESION_MODERATE_LABELS,
  "Avoid beginning a sentence with a quotation"
];

export const TRANSITION_LABELS = [
  "Use a boundary statement when transitioning between paragraphs"
];

export const CONVENTIONS_LABELS = [
  "Qualify language",
  "Essay title format",
  "Capitalize the words in the title",
  "The title of major works should be italicized",
  "The title of minor works should be inside double quotation marks",
  "Write out the numbers one through ten",
  "Check subject-verb agreement",
  "Spelling error",
  "Commonly confused word",
  "Comma after introductory word",
  "Possessive apostrophe",
  "Write in the present tense",
  "Uncountable noun",
  "A one-sentence summary is always insufficient",
  "Do not use 'etc.' at the end of a list",
  "Is this the author's full name?",
  "Is this the correct title?",
  "Add parenthetical citation"
];

// ── Overall score ceiling tiers ─────────────────────────────────────
// Cross-metric severity tiers that cap the overall score.
// Critical = not following directions (60s), Moderate = trying but failing (70s).
// Labels not listed here are Minor (no ceiling — refinement issues).
export const OVERALL_CRITICAL_LABELS = [
  ...COHESION_CRITICAL_LABELS,                       // Off-topic, thesis org, closed thesis, specific topics
];

export const OVERALL_MODERATE_LABELS = [
  ...COHESION_MODERATE_LABELS,                       // Put topic in thesis, incomplete conclusion, no quotes in final sentence
  "Floating quotation",                              // Variety: significant evidence failure
  "Follow the process for inserting evidence",       // Variety: significant evidence failure
  "Explain the significance of evidence",            // Variety: significant evidence failure
];

/**
 * Determine the overall score ceiling based on the worst issue tier present.
 * @param {object} labelCounts - { "label": count }
 * @returns {number} 69, 79, or 100
 */
export const getScoreCeiling = (labelCounts) => {
  if (!labelCounts) return 100;
  const hasCritical = OVERALL_CRITICAL_LABELS.some(
    (l) => (Number(labelCounts[l]) || 0) > 0
  );
  if (hasCritical) return 69;
  const hasModerate = OVERALL_MODERATE_LABELS.some(
    (l) => (Number(labelCounts[l]) || 0) > 0
  );
  if (hasModerate) return 79;
  return 100;
};

export const METRIC_INFO = {
  power: {
    title: "Power",
    body: "Power measures the specificity and strength of your verb choices. Vysti rewards verbs that express precise analytical actions rather than overused verbs like show, use, demonstrate, emphasize, represent, state, and symbolize.",
    tips: [
      "Replace overused verbs (show, demonstrate, state) with analytical verbs that capture your exact meaning—illustrates, employs, critiques, reveals, underscores, interrogates.",
      "Vary your verb choices across sentences to maintain reader interest and demonstrate vocabulary range.",
      "Choose verbs that convey analysis and interpretation rather than simple observation or reporting.",
      "Click the Power Verbs dictionary for targeted suggestions when revising weak verbs in your preview.",
      "Click Repetition to highlight repeated nouns across your essay—use synonyms or pronouns to improve vocabulary range."
    ]
  },
  variety: {
    title: "Analysis",
    body: "Analysis measures your analytical depth through three dimensions: rhetorical or literary techniques, evidence and development, and sentence structure. It checks that quotations are properly cited, integrated, and explained.",
    tips: [
      "Identify multiple unique rhetorical devices or literary techniques in each body paragraph—aim for at least three distinct devices to show thorough analysis.",
      "Each body paragraph needs at least two short quotations AND at least four sentences—cite evidence and develop your analysis of it.",
      "After every quotation, explain its significance: what does this evidence show, and why does it matter to your argument?",
      "Vary how each sentence begins to create dynamic, readable prose—avoid starting too many sentences with unclarified pronouns."
    ]
  },
  cohesion: {
    title: "Cohesion",
    body:
      "Cohesion measures how smoothly your ideas flow within paragraphs, across paragraph breaks, and through the overall organization of your thesis. It checks sentence connections, paragraph transitions, and thesis structure.",
    tips: [
      "Echo a central noun from your thesis in each body paragraph's topic sentence to maintain focus on your argument.",
      "Repeat key content words across sentence and paragraph boundaries—or use their word families (race → racial, symbol → symbolic) to create cohesive links.",
      "Use transition words sparingly and strategically within paragraphs, but avoid repeating the same transition multiple times.",
      "Follow the organization of your thesis and use boundary statements to transition between paragraphs."
    ]
  },
  precision: {
    title: "Precision",
    body: "Precision measures how clean and effective your prose is across three dimensions: concision, clarity, and conventions.",
    tips: [
      "Be concise: cut filler phrases, avoid addressing the reader directly, eliminate banned connectors (therefore, thereby, hence, thus), use the author's name instead of 'the author,' replace which-clauses with tighter phrasing, and limit 'and' to twice per sentence.",
      "Be clear: replace vague abstractions (society, reality, life) with specific terms, clarify all pronoun references, avoid meta-textual references, and eliminate absolute language (always, never).",
      "Follow conventions: format your essay title correctly, italicize major works, use quotation marks for minor works, write out numbers one through ten, and check grammar and spelling."
    ]
  }
};

export const WEAK_VERBS = new Set([
  "show","shows","showed","shown","showing",
  "use","uses","used","using",
  "demonstrate","demonstrates","demonstrated","demonstrating",
  "emphasize","emphasizes","emphasized","emphasizing",
  "represent","represents","represented","representing",
  "state","states","stated","stating",
  "symbolize","symbolizes","symbolized","symbolizing"
]);

// ── Title detection (used by PreviewMetrics for paragraph filtering) ──

const hasSentenceEnding = (paragraph) => /[.!?]["'\u201D\u2019)]*\s*$/.test(String(paragraph || "").trim());

// Words exempt from capitalization in Title Case
const TITLE_SMALL_WORDS = new Set([
  "a","an","the","and","but","or","nor","for","so","yet",
  "of","in","on","at","by","to","up","from","into","onto","over","under",
  "with","within","without","about","between","before","after","as","than","via"
]);

export const looksLikeTitle = (text) => {
  const trimmed = String(text || "").trim();
  if (hasSentenceEnding(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 40) return false;
  // Short lines (≤ 5 words) without sentence punctuation are almost certainly titles
  if (words.length <= 5) return true;
  // Creative title pattern: "Quote": Topic "Title" or "Quote" Topic "Title"
  // (after normalizeTypography, quotes are straight ")
  if (/^"[^"]+"\s*:?\s+.+"[^"]+"/.test(trimmed)) return true;
  // Title Case: majority of significant words (not articles/prepositions) start uppercase
  let caps = 0;
  let sig = 0;
  for (let i = 0; i < words.length; i++) {
    const clean = words[i].replace(/^[^a-zA-Z]+/, "");
    if (!clean) continue;
    if (i > 0 && TITLE_SMALL_WORDS.has(clean.toLowerCase())) continue;
    sig += 1;
    if (/^[A-Z]/.test(clean)) caps += 1;
  }
  return sig >= 2 && caps / sig >= 0.5;
};

// ── Thesis devices lexicon (used by App.jsx for technique highlighting) ──

const parseThesisDevicesLexicon = (text) => {
  const entries = new Map();
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const [termRaw, canonicalRaw] = line.split(",").map((s) => s?.trim());
      if (!termRaw) return;
      const term = termRaw.toLowerCase();
      const canonical = (canonicalRaw || termRaw).toLowerCase();
      entries.set(term, canonical);
    });
  return entries;
};

export const loadThesisDevicesLexicon = async (candidateUrls) => {
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const urls = candidateUrls?.length
    ? candidateUrls
    : [
        "/thesis_devices.txt",
        "./thesis_devices.txt",
        "/assets/thesis_devices.txt",
        "/thesis_device.txt",
        "/assets/thesis_device.txt"
      ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`Failed ${url} (${res.status})`);
        continue;
      }
      const text = await res.text();
      const lexicon = parseThesisDevicesLexicon(text);
      if (isDev && lexicon.size === 0) {
        console.warn("[thesis devices] lexicon loaded empty", { source: url });
      }
      return { lexicon, source: url };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.warn("Failed to load thesis devices lexicon:", lastErr);
  }
  return { lexicon: new Map(), source: "" };
};
