const VERSION = 1;
const MAX_CHARS = 200000;

const safeSegment = (value) =>
  String(value || "")
    .replace(/[:\n\r\t]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);

export function makeDraftKey({ userId, fileName, mode }) {
  const safeFile = safeSegment(fileName);
  const safeMode = safeSegment(mode);
  return `vysti:draft:${userId || "anon"}:${safeFile}:${safeMode}`;
}

export function loadDraft({ userId, fileName, mode }) {
  try {
    const key = makeDraftKey({ userId, fileName, mode });
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.text || !parsed?.savedAt) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function saveDraft({ userId, fileName, mode, text }) {
  try {
    const key = makeDraftKey({ userId, fileName, mode });
    const payload = {
      text,
      savedAt: new Date().toISOString(),
      version: VERSION
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return payload;
  } catch (err) {
    return null;
  }
}

export function deleteDraft({ userId, fileName, mode }) {
  try {
    const key = makeDraftKey({ userId, fileName, mode });
    localStorage.removeItem(key);
  } catch (err) {}
}

export function shouldAutosave(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length < 40) return false;
  if (trimmed.length > MAX_CHARS) return false;
  return true;
}

export function throttle(fn, ms) {
  let lastCall = 0;
  let timeoutId = null;

  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
      return;
    }
    if (timeoutId) return;
    timeoutId = window.setTimeout(() => {
      lastCall = Date.now();
      timeoutId = null;
      fn(...args);
    }, remaining);
  };
}
