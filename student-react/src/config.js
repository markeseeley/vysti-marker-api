const readBuildId = () => {
  const meta = document.querySelector('meta[name="app-build-id"]');
  return meta?.content?.trim() || "";
};

const DEFAULT_CONFIG = {
  apiBaseUrl: "https://vysti-rules.onrender.com",
  supabaseUrl: "https://divdfodsdtfbdwoqvsfy.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdmRmb2RzZHRmYmR3b3F2c2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjU1OTksImV4cCI6MjA4MTAwMTU5OX0.fnm_9qX5DqdR0j6y-2mRRkwr8Icm1uRNPbUo6lqzock",
  buildId: readBuildId(),
  featureFlags: {
    reactBeta: true
  }
};

let runtimeConfig = null;
let configError = null;

const normalizeConfig = (incoming) => {
  const merged = {
    ...DEFAULT_CONFIG,
    ...(incoming || {}),
    featureFlags: {
      ...DEFAULT_CONFIG.featureFlags,
      ...(incoming?.featureFlags || {})
    }
  };
  if (!merged.buildId) {
    merged.buildId = readBuildId();
  }
  return merged;
};

const validateConfig = (config) => {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.apiBaseUrl) {
    return new Error("Missing required app configuration.");
  }
  return null;
};

export const DEFAULT_ZOOM = 1.5;

export async function initConfig() {
  if (runtimeConfig) return runtimeConfig;
  try {
    const response = await fetch("/student-react-config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Config load failed (${response.status})`);
    }
    const json = await response.json();
    runtimeConfig = normalizeConfig(json);
  } catch (err) {
    configError = err;
    runtimeConfig = normalizeConfig();
  }
  const validationError = validateConfig(runtimeConfig);
  if (validationError) {
    configError = validationError;
  }
  return runtimeConfig;
}

export function getConfig() {
  return runtimeConfig || normalizeConfig();
}

export function getConfigError() {
  return configError;
}

export const getApiUrls = () => {
  const { apiBaseUrl } = getConfig();
  return {
    markUrl: `${apiBaseUrl}/mark`,
    markTextUrl: `${apiBaseUrl}/mark_text`
  };
};

export const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "peel_paragraph", label: "Mini-essay paragraph" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" }
];

export const MODE_RULE_DEFAULTS = {
  textual_analysis: {
    description: "A formal and academic essay of analysis with all Vysti Rules running.",
    details: [
      "No first-person allowed or personal pronouns",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  peel_paragraph: {
    description: "One focused analytical paragraph following the Vysti Rules.",
    details: [
      "The first sentence should state the author, genre, title, and summary.",
      "The first sentence should include devices and/or strategies like a closed thesis",
      "No first-person allowed or personal pronouns",
      "Requires quoted evidence in the body of the paragraph.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  reader_response: {
    description: "More personal voice allowed, but still needs argument + evidence.",
    details: [
      "Allows first-person and personal pronouns",
      "Allows contractions and 'which'",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  argumentation: {
    description: "Argumentation is more open mode beyond textual analysis.",
    details: [
      "Allows for past tense.",
      "Allows first-person and personal pronouns",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  }
};
