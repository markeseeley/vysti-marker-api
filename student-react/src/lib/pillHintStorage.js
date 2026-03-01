const PILL_HINT_SESSION_PREFIX = "vysti_pill_hint_shown_v3__";

const storageKey = (key) => `${PILL_HINT_SESSION_PREFIX}${String(key || "").trim()}`;

export const wasPillHintShown = (key) => {
  if (!key) return false;
  try {
    return sessionStorage.getItem(storageKey(key)) === "1";
  } catch (err) {
    return false;
  }
};

export const setPillHintShown = (key) => {
  if (!key) return;
  try {
    sessionStorage.setItem(storageKey(key), "1");
  } catch (err) {}
};
