const buildStorageKey = ({ userId, fileName }) => {
  const safeUser = String(userId || "anon");
  const safeFile = String(fileName || "unknown");
  return `vysti_revision_practice_${safeUser}_${safeFile}`;
};

const readStorage = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch (err) {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (err) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (innerErr) {
      return false;
    }
  }
};

const removeStorage = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (err) {}
  try {
    localStorage.removeItem(key);
  } catch (err) {}
};

export function loadRevisionPracticeState({ userId, fileName }) {
  const key = buildStorageKey({ userId, fileName });
  try {
    const raw = readStorage(key) ?? localStorage.getItem(key);
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
    writeStorage(key, JSON.stringify(state));
  } catch (err) {}
}

export function clearRevisionPracticeState({ userId, fileName }) {
  const key = buildStorageKey({ userId, fileName });
  removeStorage(key);
}
