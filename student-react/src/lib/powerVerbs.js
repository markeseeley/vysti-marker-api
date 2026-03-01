const DEFAULT_CANDIDATE_URLS = ["/power_verbs_2025.json"];

export const POWER_VERBS_LABEL = "Avoid weak verbs";

const normalizeVerbEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { verb: entry.trim(), definition: "" };
  }
  const verb = String(entry.verb || "").trim();
  if (!verb) return null;
  return { verb, definition: String(entry.definition || "").trim() };
};

let cachedPowerVerbsPromise = null;
let cachedPowerVerbsResult = null;

export const loadPowerVerbs = async (candidateUrls = DEFAULT_CANDIDATE_URLS) => {
  if (cachedPowerVerbsResult) return cachedPowerVerbsResult;
  if (cachedPowerVerbsPromise) return cachedPowerVerbsPromise;

  cachedPowerVerbsPromise = (async () => {
    let lastErr = null;
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          lastErr = new Error(`Failed ${url} (${res.status})`);
          continue;
        }
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.map(normalizeVerbEntry).filter(Boolean)
          : [];
        const result = {
          list,
          map: new Map(list.map((entry) => [entry.verb.toLowerCase(), entry.definition])),
          source: url
        };
        cachedPowerVerbsResult = result;
        return result;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) {
      console.warn("Failed to load power verbs from all candidate URLs:", lastErr);
    }
    const result = { list: [], map: new Map(), source: "" };
    cachedPowerVerbsResult = result;
    return result;
  })();

  return cachedPowerVerbsPromise;
};

export const buildPowerVerbFormsSet = (list) => {
  const forms = new Set();
  (list || []).forEach((entry) => {
    const verb = String(entry?.verb || "").toLowerCase().trim();
    if (!verb) return;
    forms.add(verb);                          // stored form (3rd-person singular)
    const base = toBaseForm(verb);
    forms.add(base);                          // base form
    forms.add(conjugateVerb(base, "s"));      // 3rd-person singular
    forms.add(conjugateVerb(base, "ing"));    // present participle
    forms.add(conjugateVerb(base, "ed"));     // past tense
  });
  return forms;
};

export const shuffleList = (list) => {
  const arr = [...(list || [])];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const replaceSelectionInTextarea = (textarea, verb, savedSelection) => {
  if (!textarea || !verb) return false;
  let start = textarea.selectionStart ?? 0;
  let end = textarea.selectionEnd ?? 0;
  // Fall back to saved selection if the live selection was lost (e.g. React re-render)
  if (start === end && savedSelection && savedSelection.start !== savedSelection.end) {
    start = savedSelection.start;
    end = savedSelection.end;
  }
  // No text selected — nothing to replace
  if (start === end) return false;
  // Re-focus and restore selection (clicking the verb button blurs the textarea)
  textarea.focus();
  textarea.setSelectionRange(start, end);
  // execCommand('insertText') fires a native input event that React detects,
  // correctly updating controlled component state.
  const ok = document.execCommand("insertText", false, verb);
  if (!ok) {
    // Fallback: manual replacement with native setter
    const value = textarea.value || "";
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newValue = `${before}${verb}${after}`;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, newValue);
    } else {
      textarea.value = newValue;
    }
    textarea.setSelectionRange(start + verb.length, start + verb.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
};

export const replaceSelectionInContainer = (container, verb) => {
  if (!container || !verb) return false;
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer;
  if (!container.contains(anchor)) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(verb));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

// ── Verb conjugation: match the form of the highlighted weak verb ──

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const isVowel = (ch) => VOWELS.has(ch);
const isConsonant = (ch) => ch && /[a-z]/i.test(ch) && !isVowel(ch);

/**
 * Detect the morphological form of a verb word.
 * Returns "ing" | "ed" | "s" | "base"
 */
export const detectVerbForm = (word) => {
  const w = (word || "").toLowerCase().trim();
  if (!w) return "base";
  if (w.endsWith("ing") && w.length > 4) return "ing";
  if (w.endsWith("ied") && w.length > 4) return "ed";
  if (w.endsWith("ed") && w.length > 3) return "ed";
  // -es: watches, pushes, fixes — but not "uses" which ends in "ses"
  if (w.endsWith("ies") && w.length > 4) return "s";
  if (w.endsWith("es") && w.length > 3 && !w.endsWith("tes") && !w.endsWith("des") && !w.endsWith("les") && !w.endsWith("res") && !w.endsWith("nes")) return "s";
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return "s";
  return "base";
};

/**
 * Strip third-person singular suffix to recover the base form.
 * power_verbs_2025.json stores verbs in "-s"/"-es"/"-ies" form;
 * this reverses that so conjugateVerb() receives a true base.
 */
export const toBaseForm = (verb) => {
  const v = (verb || "").toLowerCase().trim();
  if (!v) return v;
  // Phrasal verbs: only transform the first word ("reacts to" → "react to")
  const spaceIdx = v.indexOf(" ");
  if (spaceIdx > 0) {
    return toBaseForm(v.slice(0, spaceIdx)) + v.slice(spaceIdx);
  }
  // -ies → -y  (intensifies → intensify)
  if (v.endsWith("ies") && v.length > 4) return v.slice(0, -3) + "y";
  // -sses → strip -es  (passes → pass, tosses → toss)
  if (v.endsWith("sses")) return v.slice(0, -2);
  // -shes → strip -es  (pushes → push)
  if (v.endsWith("shes")) return v.slice(0, -2);
  // -ches → strip -es  (watches → watch)
  if (v.endsWith("ches")) return v.slice(0, -2);
  // -xes → strip -es   (fixes → fix)
  if (v.endsWith("xes")) return v.slice(0, -2);
  // -zzes → strip -es  (buzzes → buzz)
  if (v.endsWith("zzes")) return v.slice(0, -2);
  // Default: strip -s  (jettisons → jettison, actualizes → actualize)
  if (v.endsWith("s") && v.length > 2) return v.slice(0, -1);
  return v;
};

// Words whose final syllable is stressed → double the final consonant.
// Only multi-syllable verbs that appear in our power-verbs list need to be here;
// monosyllabic CVC words (run, cut, hit …) are handled by the length check below.
const STRESSED_FINAL = new Set([
  "admit", "commit", "embed", "upset", "abet", "befit", "begin", "compel",
  "confer", "defer", "deter", "excel", "expel", "forget", "incur", "infer",
  "occur", "omit", "patrol", "permit", "prefer", "propel", "rebel", "recur",
  "refer", "regret", "remit", "repel", "submit", "transfer", "transmit"
]);

// Double the final consonant only when English rules require it:
// 1. Monosyllabic CVC words (3-4 chars): run → running, cut → cutting
// 2. Multi-syllable words with stress on the final syllable (whitelist)
const shouldDouble = (base) => {
  if (base.length < 3) return false;
  const last = base[base.length - 1];
  const penult = base[base.length - 2];
  const ante = base[base.length - 3];
  if (!isConsonant(last) || !isVowel(penult) || !isConsonant(ante)) return false;
  if (last === "w" || last === "x" || last === "y") return false;
  // Monosyllabic (3-4 chars): always double (run, stop, trim, grab …)
  if (base.length <= 4) return true;
  // Multi-syllable: only double if final syllable is stressed
  return STRESSED_FINAL.has(base);
};

/**
 * Conjugate a base-form verb to the target form.
 * Best-effort — works well for regular verbs (which most power verbs are).
 */
export const conjugateVerb = (base, form) => {
  const b = (base || "").toLowerCase().trim();
  if (!b || form === "base") return b;

  // Phrasal verbs: only conjugate the first word ("react to" → "reacting to")
  const spaceIdx = b.indexOf(" ");
  if (spaceIdx > 0) {
    return conjugateVerb(b.slice(0, spaceIdx), form) + b.slice(spaceIdx);
  }

  if (form === "ing") {
    if (b.endsWith("ie")) return b.slice(0, -2) + "ying";
    if (b.endsWith("ee")) return b + "ing";
    if (b.endsWith("e") && b.length > 2) return b.slice(0, -1) + "ing";
    if (shouldDouble(b)) return b + b[b.length - 1] + "ing";
    return b + "ing";
  }

  if (form === "ed") {
    if (b.endsWith("e")) return b + "d";
    if (b.endsWith("y") && b.length > 2 && isConsonant(b[b.length - 2])) {
      return b.slice(0, -1) + "ied";
    }
    if (shouldDouble(b)) return b + b[b.length - 1] + "ed";
    return b + "ed";
  }

  if (form === "s") {
    if (b.endsWith("y") && b.length > 2 && isConsonant(b[b.length - 2])) {
      return b.slice(0, -1) + "ies";
    }
    if (b.endsWith("s") || b.endsWith("sh") || b.endsWith("ch") || b.endsWith("x") || b.endsWith("z")) {
      return b + "es";
    }
    return b + "s";
  }

  return b;
};

export const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};
