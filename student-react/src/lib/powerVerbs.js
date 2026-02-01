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

export const loadPowerVerbs = async (candidateUrls = DEFAULT_CANDIDATE_URLS) => {
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
      return {
        list,
        map: new Map(list.map((entry) => [entry.verb.toLowerCase(), entry.definition])),
        source: url
      };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.warn("Failed to load power verbs from all candidate URLs:", lastErr);
  }
  return { list: [], map: new Map(), source: "" };
};

export const buildPowerVerbFormsSet = (list) => {
  const forms = new Set();
  (list || []).forEach((entry) => {
    const verb = String(entry?.verb || "").toLowerCase().trim();
    if (!verb) return;
    forms.add(verb);
    if (verb.endsWith("s")) forms.add(verb.slice(0, -1));
    if (verb.endsWith("es")) forms.add(verb.slice(0, -2));
    if (verb.endsWith("ed")) forms.add(verb.slice(0, -2));
    if (verb.endsWith("ing")) forms.add(verb.slice(0, -3));
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

export const replaceSelectionInTextarea = (textarea, verb) => {
  if (!textarea || !verb) return false;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value || "";
  const before = value.slice(0, start);
  const after = value.slice(end);
  textarea.value = `${before}${verb}${after}`;
  const cursor = before.length + verb.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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

export const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};
