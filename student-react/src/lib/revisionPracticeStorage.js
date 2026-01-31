const buildStorageKey = ({ userId, fileName }) => {
  const safeUser = String(userId || "anon");
  const safeFile = String(fileName || "unknown");
  return `vysti_revision_practice_${safeUser}_${safeFile}`;
};

export function loadRevisionPracticeState({ userId, fileName }) {
  const key = buildStorageKey({ userId, fileName });
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function saveRevisionPracticeState({ userId, fileName, state }) {
  const key = buildStorageKey({ userId, fileName });
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch (err) {}
}
