/**
 * Teacher Quick-Stamp Phrases
 *
 * Pre-configured comment phrases that apply as Word margin comments
 * (reuses the existing comment infrastructure). Teachers can customize
 * the list; preferences persist in localStorage.
 */

export const DEFAULT_STAMPS = [
  "Cite your source",
  "Expand this point",
  "Run-on sentence",
  "Fragment",
  "Awkward phrasing",
  "Good transition",
  "Strong evidence",
  "Needs analysis",
  "Show, don't tell",
  "Vague",
];

const STAMPS_KEY = "vysti:teacher-stamps";

function makeKey(userId) {
  return `${STAMPS_KEY}:${userId || "anon"}`;
}

export function loadStamps(userId) {
  try {
    const raw = localStorage.getItem(makeKey(userId));
    if (!raw) return [...DEFAULT_STAMPS];
    return JSON.parse(raw);
  } catch {
    return [...DEFAULT_STAMPS];
  }
}

export function saveStamps(userId, stamps) {
  try {
    localStorage.setItem(makeKey(userId), JSON.stringify(stamps));
  } catch {}
}

export function resetStamps(userId) {
  const stamps = [...DEFAULT_STAMPS];
  saveStamps(userId, stamps);
  return stamps;
}
