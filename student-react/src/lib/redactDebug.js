const SENSITIVE_KEY_PATTERN = /key|secret|token|anonkey|authorization/i;

const redactString = (value, mode = "full") => {
  const text = String(value || "");
  if (!text) return "[REDACTED]";
  if (mode === "partial" && text.length >= 8) {
    return `${text.slice(0, 4)}…${text.slice(-4)}`;
  }
  return "[REDACTED]";
};

const shouldRedactKey = (key) => {
  if (!key) return false;
  return SENSITIVE_KEY_PATTERN.test(String(key));
};

const redactValue = (value, key) => {
  if (key === "supabaseAnonKey") {
    return redactString(value, "partial");
  }
  if (shouldRedactKey(key)) {
    return redactString(value);
  }
  return value;
};

const deepRedact = (input) => {
  if (Array.isArray(input)) {
    return input.map((entry) => deepRedact(entry));
  }
  if (!input || typeof input !== "object") {
    return input;
  }
  const output = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value && typeof value === "object") {
      output[key] = deepRedact(value);
    } else {
      output[key] = redactValue(value, key);
    }
  });
  return output;
};

export function redactDebugPayload(payload) {
  return deepRedact(payload);
}
