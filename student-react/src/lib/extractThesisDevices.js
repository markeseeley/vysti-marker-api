/**
 * Extract literary devices from a thesis sentence by scanning against
 * the canonical device lexicon (thesisDeviceLookup.json).
 *
 * Returns devices in the order they appear in the text, deduplicated
 * by canonical name. This lets the Writing Guide show auto-detected
 * devices even when the student hasn't used the ThesisPlanner.
 */

import lookup from "../data/thesisDeviceLookup.json";

// Build a sorted-by-length-descending list of known terms so longer
// multi-word phrases match before their substrings (e.g., "pathetic fallacy"
// before "fallacy").
const TERMS_BY_LENGTH = Object.keys(lookup).sort(
  (a, b) => b.length - a.length
);

// Argumentative verbs that typically separate devices from the argument
// in a thesis sentence. Mirrors THESIS_VERB_LEMMAS from marker.py.
const THESIS_VERBS = new Set([
  "argues", "claims", "suggests", "shows", "demonstrates", "reveals",
  "explores", "emphasizes", "illustrates", "highlights", "contends",
  "asserts", "implies", "maintains", "proposes", "presents", "explains",
  "conveys", "portrays", "offers", "provides", "exposes", "challenges",
  "critiques", "examines", "depicts", "captures", "confronts",
  "articulates", "addresses", "chronicles", "documents", "traces",
  "uncovers", "investigates",
]);

/**
 * Find the character index of the first argumentative verb in the thesis.
 * Returns -1 if no verb is found.
 */
function findVerbBoundary(lower) {
  const words = lower.split(/\s+/);
  let pos = 0;
  for (const word of words) {
    const clean = word.replace(/[.,;:!?'"]+$/, "");
    if (THESIS_VERBS.has(clean)) {
      return pos;
    }
    pos += word.length + 1; // +1 for the space
  }
  return -1;
}

/**
 * Scan a thesis sentence and return an ordered array of canonical device names.
 *
 * Only returns devices that appear BEFORE the main argumentative verb, so
 * words like "process" in "Morrison offers an outline of the process..."
 * are not mistaken for literary devices.
 *
 * @param {string} thesis - The thesis sentence text
 * @returns {string[]} Canonical device names in order of first appearance
 */
export function extractThesisDevices(thesis) {
  if (!thesis?.trim()) return [];

  const lower = thesis.toLowerCase();
  const found = []; // { canonical, index }

  // Find the argumentative verb boundary — devices should come before it
  const verbBoundary = findVerbBoundary(lower);

  // Track which character ranges have been claimed so that
  // "pathetic fallacy" doesn't also match "fallacy" separately.
  const claimed = [];

  for (const term of TERMS_BY_LENGTH) {
    // Skip very short/generic terms that produce false positives
    if (term.length < 4) continue;

    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    let m;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index;
      const end = start + term.length;

      // Skip devices that appear AFTER the argumentative verb —
      // they are part of the argument, not the technique list
      if (verbBoundary >= 0 && start >= verbBoundary) continue;

      // Skip if this range overlaps with an already-claimed match
      if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;

      const canonical = lookup[term];
      claimed.push([start, end]);

      // Only add if this canonical device hasn't been found yet
      if (!found.some((f) => f.canonical === canonical)) {
        found.push({ canonical, index: start });
      }
    }
  }

  // Return in order of appearance
  found.sort((a, b) => a.index - b.index);
  return found.map((f) => f.canonical);
}

/**
 * Extract content words (nouns, verbs, adjectives, adverbs) from a sentence
 * for boundary-statement suggestions. Uses a stopword filter since we don't
 * have NLP on the client.
 *
 * @param {string} sentence - The sentence to extract from
 * @returns {string[]} Content words, deduplicated, max 8
 */
export function extractContentWords(sentence) {
  if (!sentence?.trim()) return [];

  const words = sentence
    .replace(/["""\u201C\u201D''`]/g, "") // strip quotes
    .replace(/[^a-zA-Z\s'-]/g, " ")       // strip punctuation except hyphens/apostrophes
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  const unique = [];
  const seen = new Set();
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOP_WORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    unique.push(w);
  }
  return unique.slice(0, 8);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Common English stopwords that aren't useful as boundary-statement terms
const STOP_WORDS = new Set([
  "the", "and", "but", "for", "nor", "not", "yet", "are", "was", "were",
  "been", "being", "have", "has", "had", "does", "did", "will", "would",
  "shall", "should", "may", "might", "must", "can", "could", "this", "that",
  "these", "those", "with", "from", "into", "through", "during", "before",
  "after", "above", "below", "between", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "which", "while", "who", "whom",
  "what", "how", "both", "each", "more", "most", "other", "some", "such",
  "than", "very", "just", "also", "about", "only", "over", "same", "they",
  "them", "their", "she", "her", "his", "its", "our", "your", "all", "any",
  "own", "too", "out", "off", "because", "until", "upon", "whether",
  "however", "although", "though", "also", "even", "still", "well",
  // Common verbs that don't help as boundary terms
  "use", "uses", "used", "using", "make", "makes", "made", "making",
  "show", "shows", "shown", "showing", "get", "gets", "got", "getting",
  "take", "takes", "took", "taking", "come", "comes", "came", "coming",
  "know", "knows", "knew", "knowing", "think", "thinks", "thought",
  "see", "sees", "saw", "seeing", "seem", "seems", "seemed", "seeming",
]);
