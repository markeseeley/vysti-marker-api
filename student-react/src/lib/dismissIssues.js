const DISMISS_NOASK_PREFIX = "vysti_dismiss_noask_v1__";

const normalizeForMatch = (text) =>
  String(text || "")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00AD/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function canonicalLabel(label) {
  return normalizeForMatch(String(label || "")).toLowerCase();
}

export function normalizeIssueId(label) {
  const slug = String(label || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "issue";
}

export function dismissNoAskKey(label) {
  return `${DISMISS_NOASK_PREFIX}${normalizeIssueId(label || "")}`;
}

export function loadDismissNoAsk(label) {
  try {
    return JSON.parse(localStorage.getItem(dismissNoAskKey(label)) || "null");
  } catch (err) {
    return null;
  }
}

export function saveDismissNoAsk(label, reason, otherText) {
  try {
    localStorage.setItem(
      dismissNoAskKey(label),
      JSON.stringify({ reason, other_text: otherText || null })
    );
  } catch (err) {}
}

export function getLocalRunKey({ markEventId, fileName }) {
  if (markEventId !== null && markEventId !== undefined && String(markEventId).trim() !== "") {
    return `mark_${markEventId}`;
  }
  return `file_${fileName || "nofile"}`;
}

export function currentDismissStorageKey({ markEventId, fileName }) {
  return `vysti_dismissed__${getLocalRunKey({ markEventId, fileName })}`;
}

export function loadDismissedIssuesFromStorage({ markEventId, fileName }) {
  const key = currentDismissStorageKey({ markEventId, fileName });
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load dismissed issues:", err);
    return [];
  }
}

export function saveDismissedIssuesToStorage({ markEventId, fileName, dismissedIssues }) {
  const key = currentDismissStorageKey({ markEventId, fileName });
  try {
    localStorage.setItem(key, JSON.stringify(dismissedIssues || []));
  } catch (err) {
    console.warn("Failed to save dismissed issues:", err);
  }
}

export function isDismissedIssueInstance(dismissedIssues, fileName, label, sentence) {
  if (!label || !sentence || !fileName) return false;
  const labelMatch = canonicalLabel(label);
  const sentenceMatch = normalizeForMatch(sentence);
  return (dismissedIssues || []).some((record) => {
    if (record?.file_name !== fileName) return false;
    return (
      canonicalLabel(record?.label) === labelMatch &&
      normalizeForMatch(record?.sentence) === sentenceMatch
    );
  });
}

export function filterDismissedExamples(examples, dismissedIssues, fileName, label) {
  return (examples || []).filter((ex) => {
    return !isDismissedIssueInstance(
      dismissedIssues,
      fileName,
      label || ex?.label || "",
      ex?.sentence || ""
    );
  });
}

export function applyDismissalsToLabelCounts(labelCounts, dismissedIssues, fileName) {
  const out = { ...(labelCounts || {}) };
  if (!fileName) return out;
  const countsToSubtract = {};
  (dismissedIssues || [])
    .filter((record) => record?.file_name === fileName)
    .forEach((record) => {
      const label = String(record?.label || "").trim();
      if (!label) return;
      countsToSubtract[label] = (countsToSubtract[label] || 0) + 1;
    });

  Object.entries(countsToSubtract).forEach(([label, sub]) => {
    const cur = Number(out[label] || 0);
    const next = Math.max(0, cur - sub);
    if (next === 0) delete out[label];
    else out[label] = next;
  });
  return out;
}
