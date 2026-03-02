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
    debugPracticeNavigation: false,
    hardeningReact: false,
    cancelRequestsReact: false,
    strictFileValidationReact: false,
    statusToastsReact: false,
    debugHardening: false,
    autosaveDraftReact: false,
    revisionHistoryReact: false,
    debugAutosave: false,
    debugHistory: false,
    saveProgressReact: true
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
  const normalizedBase = getApiBaseUrl("");
  return {
    markUrl: `${normalizedBase}/mark`,
    markTextUrl: `${normalizedBase}/mark_text`
  };
};

export const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "analytic_frame", label: "Frame essay" },
  { value: "peel_paragraph", label: "Mini-essay" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" },
  { value: "research_paper", label: "Research paper" },
];

export const TEACHER_MODES = [
  { value: "textual_analysis", label: "Textual analysis" },
  { value: "peel_paragraph", label: "Mini-essay" },
  { value: "reader_response", label: "Reader response" },
  { value: "analytic_frame", label: "Frame essay" },
  { value: "argumentation", label: "Argumentation" },
  { value: "research_paper", label: "Research paper" },
  { value: "foundation_1", label: "Step One — First sentence only" },
  { value: "foundation_2", label: "Step Two — First sentence + thesis" },
  { value: "foundation_3", label: "Step Three — Full introduction" },
  { value: "foundation_4", label: "Step Four — Intro + topic sentence" },
  { value: "foundation_5", label: "Step Five — Intro + body" },
  { value: "sandbox", label: "Sandbox" },
];

export const TEACHER_MODE_RULE_DEFAULTS = {
  textual_analysis: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    description: "A formal and academic essay of analysis with all of Vysti's rules running.",
    details: "The analytic essay is a formal, objective, evidence-based essay written entirely in the third person and present tense. The introduction opens by identifying the author, genre, and title of the work, followed by a concise summary and a closed thesis that names the specific devices or strategies to be analyzed. Each body paragraph develops one claim from the thesis, supported by short, integrated quotations and thorough analysis. The tone is academic throughout\u2014precise verbs, no contractions, no vague language, and no direct address to the reader."
  },
  peel_paragraph: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    description: "One focused analytical paragraph following Vysti's rules.",
    details: "The mini-essay paragraph condenses the analytic essay into a single well-developed paragraph. The opening sentence introduces the author, title, and a focused claim supported by specific devices or strategies\u2014functioning like a thesis in miniature. The body of the paragraph provides quoted evidence, explains its significance, and builds a cohesive line of reasoning. All of the same academic conventions apply: third person, present tense, precise language, and properly integrated quotations."
  },
  reader_response: {
    allowI: true, allowAudience: true, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: true, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    description: "Personal voice with analytical structure and evidence.",
    details: "The reader response invites a personal reaction to a text while still expecting the structure and evidence of an analytic essay. Students may write in the first person and use contractions, giving the prose a more natural, conversational tone. However, the essay still needs a clear introduction that identifies the work, a closed thesis, and body paragraphs that support claims with quoted evidence. Think of it as a genuine response to a text, grounded in analysis rather than just opinion."
  },
  analytic_frame: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: true, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    description: "An analytic essay built on a theoretical or critical framework.",
    details: "The frame essay follows the same formal, evidence-based conventions as the analytic essay but introduces a theoretical or critical lens in the introductory summary. Quotations are permitted in the introduction to establish this framework before the thesis. The body paragraphs then analyze the primary text through that lens, with the same expectations for organization, evidence, and academic language. This mode is ideal for essays that apply a critical theory, philosophical concept, or secondary source as an interpretive backdrop."
  },
  argumentation: {
    allowI: true, allowAudience: true, enforceClosedThesis: false,
    requireBodyEvidence: false, allowIntroQuotes: true, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: false,
    description: "A persuasive essay that builds and defends an original argument.",
    details: "Argumentation moves beyond close reading of a single text into broader persuasive writing. Students may write in the first person, use past tense when appropriate, and draw on a wider range of evidence\u2014including personal experience, current events, or multiple sources. The emphasis is on constructing a logical, well-supported argument with clear reasoning and strong claims. While the mode is more open, Vysti still checks for precise language, concision, and grammatical conventions."
  },
  research_paper: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: false, allowLongQuotes: true,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    description: "A formal research paper with analytical rigor and extended evidence.",
    details: "The research paper follows the same academic conventions as the analytic essay\u2014formal tone, precise language, third person, and properly integrated evidence. The key difference is that longer quotations are permitted, allowing students to engage with extended passages from their sources. All other structural and style expectations remain in place."
  },
  sandbox: {
    allowI: true, allowAudience: true, enforceClosedThesis: false,
    requireBodyEvidence: false, allowIntroQuotes: true, allowLongQuotes: true,
    highlightDevices: false, allowContractions: true, allowWhich: true,
    disableWeakVerbs: true, disableFactRule: true, disableHumanRule: true,
    disableVagueGeneralRule: true, enforceSva: false, enforcePresentTense: false,
    description: "No automated rules \u2014 mark and comment on your own terms.",
    details: "Sandbox does not apply any of Vysti\u2019s rules. Use this mode if you want to make all of your own comments and markings."
  },
  foundation_1: {
    allowI: false, allowAudience: false, enforceClosedThesis: false,
    allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    tag: "Step One",
    description: "The first sentence.",
    details: "This assignment focuses on writing the opening sentence of an analytic essay. The sentence should identify the author\u2019s full name, the genre, and the title of the work, then present a concrete, general summary of the text\u2019s content. All academic conventions apply: third person, present tense, and precise language."
  },
  foundation_2: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    tag: "Step Two",
    description: "First sentence + a closed thesis.",
    details: "Building on Step One, this assignment adds a closed thesis statement. The first sentence introduces the author, genre, title, and summary; the thesis names the specific devices or strategies that will be analyzed in the essay. Together, these two elements frame the entire argument. Academic conventions apply throughout."
  },
  foundation_3: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    tag: "Step Three",
    description: "First sentence + intro summary + closed thesis.",
    details: "This assignment asks for a complete introduction: an opening sentence that identifies the work, a multi-sentence summary that contextualizes the text, and a closed thesis that establishes the analytical direction. The summary should be substantive but concise, bridging the general opening and the specific thesis. Academic conventions apply throughout."
  },
  foundation_4: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    tag: "Step Four",
    description: "Full intro + first body topic sentence.",
    details: "Building on the complete introduction from Step Three, this assignment adds the first body paragraph\u2019s topic sentence. That sentence should clearly state the first claim from the thesis, connecting the body of the essay back to the argument. Vysti checks that the topic aligns with the thesis and that all academic conventions are followed."
  },
  foundation_5: {
    allowI: false, allowAudience: false, enforceClosedThesis: true,
    requireBodyEvidence: true, allowIntroQuotes: false, allowLongQuotes: false,
    highlightDevices: false, allowContractions: false, allowWhich: false,
    disableWeakVerbs: false, disableFactRule: false, disableHumanRule: false,
    disableVagueGeneralRule: false, enforceSva: true, enforcePresentTense: true,
    tag: "Step Five",
    description: "Full intro + one body paragraph.",
    details: "The final step combines a complete introduction with a fully developed body paragraph. The body paragraph should open with a clear topic sentence, integrate quoted evidence, and explain the significance of that evidence in relation to the thesis. This is the closest step to a full analytic essay, requiring all of Vysti\u2019s academic conventions."
  },
};

export const MODE_RULE_DEFAULTS = {
  textual_analysis: {
    description: "A formal and academic essay of analysis with all of Vysti's rules running.",
    details: "The analytic essay is a formal, objective, evidence-based essay written entirely in the third person and present tense. Your introduction opens by identifying the author, genre, and title of the work, followed by a concise summary and a closed thesis that names the specific devices or strategies you will analyze. Each body paragraph develops one claim from your thesis, supported by short, integrated quotations and thorough analysis. The tone is academic throughout\u2014precise verbs, no contractions, no vague language, and no direct address to the reader."
  },
  peel_paragraph: {
    description: "One focused analytical paragraph following Vysti's rules.",
    details: "The mini-essay paragraph condenses the analytic essay into a single well-developed paragraph. Your opening sentence introduces the author, title, and a focused claim supported by specific devices or strategies\u2014functioning like a thesis in miniature. The body of the paragraph provides quoted evidence, explains its significance, and builds a cohesive line of reasoning. All of the same academic conventions apply: third person, present tense, precise language, and properly integrated quotations."
  },
  reader_response: {
    description: "Personal voice with analytical structure and evidence.",
    details: "The reader response invites your personal reaction to a text while still expecting the structure and evidence of an analytic essay. You may write in the first person and use contractions, giving your prose a more natural, conversational tone. However, you still need a clear introduction that identifies the work, a closed thesis, and body paragraphs that support your claims with quoted evidence. Think of it as your genuine response to a text, grounded in analysis rather than just opinion."
  },
  analytic_frame: {
    description: "An analytic essay built on a theoretical or critical framework.",
    details: "The frame essay follows the same formal, evidence-based conventions as the analytic essay but introduces a theoretical or critical lens in the introductory summary. Quotations are permitted in the introduction to establish this framework before the thesis. The body paragraphs then analyze the primary text through that lens, with the same expectations for organization, evidence, and academic language. This mode is ideal for essays that apply a critical theory, philosophical concept, or secondary source as an interpretive backdrop."
  },
  argumentation: {
    description: "A persuasive essay that builds and defends an original argument.",
    details: "Argumentation moves beyond close reading of a single text into broader persuasive writing. You may write in the first person, use past tense when appropriate, and draw on a wider range of evidence\u2014including personal experience, current events, or multiple sources. The emphasis is on constructing a logical, well-supported argument with clear reasoning and strong claims. While the mode is more open, Vysti still checks for precise language, concision, and grammatical conventions."
  },
  research_paper: {
    description: "A formal research paper with analytical rigor and extended evidence.",
    details: "The research paper follows the same academic conventions as the analytic essay\u2014formal tone, precise language, third person, and properly integrated evidence. The key difference is that longer quotations are permitted, allowing you to engage with extended passages from your sources. All other structural and style expectations remain in place."
  }
};
