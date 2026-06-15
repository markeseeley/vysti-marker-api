/**
 * Device validation utility for the ThesisPlanner.
 *
 * Validates student-entered device names against the canonical lexicon
 * in thesis_devices.txt (compiled to thesisDeviceLookup.json at build time).
 *
 * Provides exact match, fuzzy match (Levenshtein), and substring suggestions.
 */

import lookup from "../data/thesisDeviceLookup.json";

// Build a Set of all known terms (lowercase) for fast exact matching
const KNOWN_TERMS = new Set(Object.keys(lookup));

// Unique canonical device names (for suggestion display)
const CANONICAL_DEVICES = [...new Set(Object.values(lookup))].sort();

/**
 * Simple Levenshtein distance for short strings.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
    }
  }
  return dp[m][n];
}

/**
 * Validate a device string entered by the student.
 *
 * @param {string} input - Raw device text from the input field
 * @returns {{ status: "empty"|"valid"|"close"|"unknown", canonical: string|null, suggestions: string[] }}
 */
export function validateDevice(input) {
  const trimmed = (input || "").trim().toLowerCase();
  if (!trimmed) return { status: "empty", canonical: null, suggestions: [] };

  // Exact match (including synonyms)
  if (KNOWN_TERMS.has(trimmed)) {
    return { status: "valid", canonical: lookup[trimmed], suggestions: [] };
  }

  // Check if input is a substring of any known term or vice versa
  const substringMatches = [];
  for (const term of KNOWN_TERMS) {
    if (term.includes(trimmed) || trimmed.includes(term)) {
      const canonical = lookup[term];
      if (!substringMatches.includes(canonical)) {
        substringMatches.push(canonical);
      }
    }
  }

  // Fuzzy match: find closest canonical devices by Levenshtein distance
  const fuzzyMatches = [];
  const maxDist = Math.max(2, Math.floor(trimmed.length * 0.35));
  for (const canonical of CANONICAL_DEVICES) {
    const dist = levenshtein(trimmed, canonical);
    if (dist <= maxDist) {
      fuzzyMatches.push({ canonical, dist });
    }
  }
  fuzzyMatches.sort((a, b) => a.dist - b.dist);

  // Merge suggestions: substring matches first, then fuzzy, deduplicated
  const suggestions = [...substringMatches];
  for (const { canonical } of fuzzyMatches) {
    if (!suggestions.includes(canonical)) suggestions.push(canonical);
  }

  if (suggestions.length > 0) {
    return { status: "close", canonical: null, suggestions: suggestions.slice(0, 3) };
  }

  return { status: "unknown", canonical: null, suggestions: [] };
}

/**
 * Get all canonical device names (for autocomplete or reference).
 */
export function getCanonicalDevices() {
  return CANONICAL_DEVICES;
}
