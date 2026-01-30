import {
  getApiBaseUrl,
  getBuildId,
  getConfig as getSharedConfig,
  initConfig as initSharedConfig
} from "@shared/runtimeConfig";

const DEFAULT_CONFIG = {
  apiBaseUrl: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
  buildId: "",
  featureFlags: {
    reactBeta: false,
    revisionPracticeReact: false,
    debugRevisionPractice: false,
    practiceNavigationReact: false,
    practiceHighlightReact: false,
    debugPracticeNavigation: false
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
    merged.buildId = getBuildId() || "dev";
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
    await initSharedConfig();
    const shared = getSharedConfig();
    runtimeConfig = normalizeConfig(shared);
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
  const base = apiBaseUrl || getApiBaseUrl("");
  const normalizedBase = base ? String(base).replace(/\/$/, "") : "";
  return {
    markUrl: normalizedBase ? `${normalizedBase}/mark` : "",
    markTextUrl: normalizedBase ? `${normalizedBase}/mark_text` : ""
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
