export const UNNECESSARY_LABELS = [
  "Avoid referring to the reader or audience unless necessary",
  "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
  "Use the author’s name instead of 'the author'"
];

export const WORDY_LABELS = [
  "Avoid the word 'which'",
  "Avoid using the word 'and' more than twice in a sentence",
  "Shorten, modify, and integrate quotations"
];

export const IMPRECISE_LABELS = [
  "Avoid overly general words like 'society', 'universe', 'reality', 'life', and 'truth'",
  "Clarify pronouns and antecedents",
  "Do not refer to the text as a text; refer to context instead",
  "Avoid absolute language like 'always' or 'never'"
];

export const METRIC_INFO = {
  power: {
    title: "Power",
    body: "Power measures how specific your verb choices are (avoiding weak verbs like show/use).",
    tips: [
      "Swap show/use for precise verbs (illustrates, highlights, underscores).",
      "Avoid repeating the same verb across sentences.",
      "Aim for verbs that express analysis, not reporting."
    ]
  },
  variety: {
    title: "Variety",
    body: "Variety measures analytical depth across techniques, evidence, development, and structure.",
    tips: [
      "Use 3+ unique devices per body paragraph.",
      "Add 2+ short quotes per body paragraph.",
      "Build paragraphs to 4+ sentences with varied starts."
    ]
  },
  cohesion: {
    title: "Cohesion",
    body:
      "Cohesion measures how well ideas connect within paragraphs (sentence boundaries) and across paragraph breaks (paragraph boundaries). You earn the most points from boundary statements—repeating key content words or word families.",
    tips: [
      "Carry a thesis noun into each paragraph’s topic sentence.",
      "Repeat a key noun/verb/adjective or its word family (race → racial).",
      "Use occasional within-paragraph transitions, but avoid repeats."
    ]
  },
  precision: {
    title: "Precision",
    body: "Precision measures unnecessary, wordy, and imprecise language that can weaken analysis.",
    tips: [
      "Unnecessary: remove filler, reader/audience, banned connectors, and \"the author\".",
      "Wordy: cut which-clauses, too-many-and chains, and long quotations.",
      "Imprecise: avoid vague terms, unclear pronouns, text-as-text, and absolutes."
    ]
  }
};

const WEAK_VERBS = new Set([
  "show","shows","showed","shown","showing",
  "use","uses","used","using",
  "make","makes","made","making",
  "do","does","did","doing",
  "get","gets","got","getting",
  "have","has","had","having"
]);

const WEAK_VERB_FORM_TO_BASE = new Map([
  ["show", "show"],
  ["shows", "show"],
  ["showed", "show"],
  ["shown", "show"],
  ["showing", "show"],
  ["use", "use"],
  ["uses", "use"],
  ["used", "use"],
  ["using", "use"],
  ["make", "make"],
  ["makes", "make"],
  ["made", "make"],
  ["making", "make"],
  ["do", "do"],
  ["does", "do"],
  ["did", "do"],
  ["doing", "do"],
  ["get", "get"],
  ["gets", "get"],
  ["got", "get"],
  ["getting", "get"],
  ["have", "have"],
  ["has", "have"],
  ["had", "have"],
  ["having", "have"]
]);

const WEAK_STARTERS = new Set([
  "this","that","these","those","it","they","he","she","we","i","you","there"
]);

const SENTENCE_STARTER_SKIPS = new Set([
  "the","a","an","and","or","but","if","then","so","because","since","as","while","when",
  "after","before","though","although","however","therefore","thus","moreover","furthermore",
  "additionally","also","likewise","similarly","from","into","onto","with","within","without",
  "of","to","in","on","at","by","for","about","over","under","between","through","during",
  "is","are","was","were","be","been","being","am","have","has","had","do","does","did",
  "doing","that","this","these","those","it","its","their","they","them","he","she","his",
  "her","we","our","us","you","your","i","me","my","mine","yours","ours","theirs","not","no",
  "yes","can","could","would","should","may","might","must","will","just","very","really",
  "more","most","less","least","such","than","too","each","every","some","any","all","both",
  "either","neither","nor","own","same","other","another","there","here","then","now","who",
  "whom","which","what","where","why","how","up","down","out","off","again","further","once"
]);

const STOP_WORDS = new Set([
  ...SENTENCE_STARTER_SKIPS,
  "essay","text","story","novel","poem","poetry","author","writer","reader","audience",
  "character","quote","quotation","example","evidence","paragraph","sentence","chapter"
]);

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const normalizeTypography = (text) =>
  String(text || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-");

const normalizeTypographyPreserveParagraphs = (text) =>
  normalizeTypography(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const stripQuotedText = (text) => String(text || "").replace(/"[^"]+"/g, " ");

const tokenizeWords = (text) =>
  (String(text || "").toLowerCase().match(/[a-z']+/g) || []).filter(Boolean);

const splitParagraphsSimple = (text) =>
  normalizeTypographyPreserveParagraphs(text)
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

const splitSentencesSimple = (text) =>
  normalizeTypography(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const getSentenceStarterWord = (sentence) => {
  const tokens = tokenizeWords(sentence);
  if (!tokens.length) return "";
  let idx = 0;
  while (idx < tokens.length && SENTENCE_STARTER_SKIPS.has(tokens[idx])) idx += 1;
  return tokens[idx] || tokens[0] || "";
};

const countShortQuotesInParagraph = (paragraph) => {
  const matches = String(paragraph || "").match(/"[^"]{2,140}"/g);
  return matches ? matches.length : 0;
};

const getEssayParagraphsForVariety = (text) => {
  const rawParagraphs = splitParagraphsSimple(text);
  const filteredParagraphs = rawParagraphs.filter((p) => tokenizeWords(p).length >= 5);
  return { rawParagraphs, filteredParagraphs };
};

const getBodyParagraphIndices = (paragraphs) => {
  if (paragraphs.length <= 2) return paragraphs.map((_, idx) => idx);
  return paragraphs.slice(1, -1).map((_, idx) => idx + 1);
};

const sumLabelCounts = (labels, counts) =>
  labels.reduce((sum, label) => sum + (Number(counts?.[label]) || 0), 0);

const powerVerbTargetForWordCount = (wc) => {
  const n = Number(wc) || 0;
  if (n < 200) return 0;
  if (n <= 500) return 5;
  if (n <= 800) return 10;
  return 10 + 5 * Math.ceil((n - 800) / 300);
};

const isTheUseOf = (words, idx) => {
  if (words[idx] !== "use" && words[idx] !== "uses") return false;
  return words[idx - 1] === "the" && words[idx + 1] === "of";
};

const isNotOnlyAuxDo = (words, idx) => {
  if (!["do", "does", "did"].includes(words[idx])) return false;
  return words[idx - 1] === "only" && words[idx - 2] === "not";
};

const normalizeToken = (token) => {
  const t = String(token || "").toLowerCase();
  return t.replace(/'s$/g, "").replace(/'/g, "");
};

const contentTokens = (sentence) => {
  const tokens = tokenizeWords(sentence).map(normalizeToken);
  return tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t));
};

const computeCohesionParagraphAware = (paragraphs) => {
  const details = {
    sentenceBoundaryHits: 0,
    sentenceBoundaryDenom: 0,
    paragraphBoundaryHits: 0,
    paragraphBoundaryDenom: 0,
    transitionsWithinCount: 0,
    transitionsWithinUnique: 0,
    paragraphStartTransitionsCount: 0,
    issues: { weakTransitions: [] },
    sourceText: paragraphs.join("\n\n")
  };

  const transitionStarts = new Set([
    "however","therefore","thus","moreover","furthermore","additionally","also","likewise",
    "similarly","instead","meanwhile","consequently","finally","overall","nevertheless"
  ]);
  const seenTransitions = new Set();

  const sentenceTokens = [];
  paragraphs.forEach((para) => {
    const sentences = splitSentencesSimple(para);
    sentences.forEach((sentence) => {
      const tokens = contentTokens(sentence);
      sentenceTokens.push(tokens);
      if (tokens.length) {
        const starter = tokens[0];
        if (transitionStarts.has(starter)) {
          details.transitionsWithinCount += 1;
          if (!seenTransitions.has(starter)) {
            seenTransitions.add(starter);
            details.transitionsWithinUnique += 1;
          } else {
            details.issues.weakTransitions.push({
              reason: "Repeated transition",
              token: starter
            });
          }
        }
      }
    });
  });

  for (let i = 0; i < sentenceTokens.length - 1; i += 1) {
    details.sentenceBoundaryDenom += 1;
    const left = new Set(sentenceTokens[i]);
    const right = sentenceTokens[i + 1] || [];
    const hit = right.some((token) => left.has(token));
    if (hit) details.sentenceBoundaryHits += 1;
  }

  for (let i = 0; i < paragraphs.length - 1; i += 1) {
    const last = splitSentencesSimple(paragraphs[i]).slice(-1)[0] || "";
    const first = splitSentencesSimple(paragraphs[i + 1])[0] || "";
    const left = new Set(contentTokens(last));
    const right = contentTokens(first);
    details.paragraphBoundaryDenom += 1;
    const hit = right.some((token) => left.has(token));
    if (hit) details.paragraphBoundaryHits += 1;
  }

  const sentenceRate = details.sentenceBoundaryDenom
    ? details.sentenceBoundaryHits / details.sentenceBoundaryDenom
    : 0;
  const paragraphRate = details.paragraphBoundaryDenom
    ? details.paragraphBoundaryHits / details.paragraphBoundaryDenom
    : 0;
  const transitionBonus = Math.min(details.transitionsWithinUnique * 2, 10);
  const cohesionScore = clamp(Math.round(100 * (0.7 * sentenceRate + 0.3 * paragraphRate) + transitionBonus), 0, 100);

  return {
    cohesionScore,
    cohesionSub: "",
    details
  };
};

const parseThesisDevicesLexicon = (text) => {
  const entries = new Map();
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const [termRaw, canonicalRaw] = line.split(",").map((s) => s?.trim());
      if (!termRaw) return;
      const term = termRaw.toLowerCase();
      const canonical = (canonicalRaw || termRaw).toLowerCase();
      entries.set(term, canonical);
    });
  return entries;
};

export const loadThesisDevicesLexicon = async (candidateUrls) => {
  const urls = candidateUrls?.length
    ? candidateUrls
    : ["/thesis_devices.txt", "./thesis_devices.txt", "/assets/thesis_devices.txt"];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`Failed ${url} (${res.status})`);
        continue;
      }
      const text = await res.text();
      return { lexicon: parseThesisDevicesLexicon(text), source: url };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.warn("Failed to load thesis devices lexicon:", lastErr);
  }
  return { lexicon: new Map(), source: "" };
};

const getCanonicalDevicesInParagraph = (paragraph, lexicon) => {
  if (!lexicon || !lexicon.size) return new Set();
  const text = String(paragraph || "").toLowerCase();
  const devices = new Set();
  for (const [term, canonical] of lexicon.entries()) {
    if (text.includes(term)) devices.add(canonical);
  }
  return devices;
};

export const computeMetricsFromText = (
  text,
  mode,
  { labelCounts, markEventId, powerVerbFormsSet, thesisDevicesLexicon } = {}
) => {
  const cleanForCohesion = normalizeTypographyPreserveParagraphs(text || "");
  const cleanForCounts = stripQuotedText(normalizeTypography(text || ""));
  const cleanLower = cleanForCounts.toLowerCase().replace(/\s+/g, " ").trim();
  const words = tokenizeWords(cleanLower);
  const totalWords = words.length;

  const weakByBase = { show: 0, use: 0, make: 0, do: 0, get: 0, have: 0 };
  let weakCount = 0;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (!WEAK_VERBS.has(w)) continue;
    if (isTheUseOf(words, i)) continue;
    if (isNotOnlyAuxDo(words, i)) continue;
    weakCount += 1;
    const base = WEAK_VERB_FORM_TO_BASE.get(w);
    if (base && weakByBase[base] !== undefined) weakByBase[base] += 1;
  }

  let powerCount = 0;
  let powerTarget = powerVerbTargetForWordCount(totalWords);
  if (powerVerbFormsSet && powerTarget > 0) {
    const uniq = new Set();
    for (const w of words) {
      if (WEAK_VERBS.has(w)) continue;
      if (powerVerbFormsSet.has(w)) uniq.add(w);
    }
    powerCount = uniq.size;
  }
  const weakRatePer100 = totalWords ? (weakCount / totalWords) * 100 : 0;
  const weakScore = clamp(Math.round(100 - weakRatePer100 * 8), 0, 100);
  const powerVerbScore =
    powerTarget === 0 ? 100 : clamp(Math.round((powerCount / powerTarget) * 100), 0, 100);
  const powerScore = clamp(Math.round(weakScore * 0.6 + powerVerbScore * 0.4), 0, 100);

  const { rawParagraphs, filteredParagraphs } = getEssayParagraphsForVariety(cleanForCohesion);
  const paragraphs = filteredParagraphs;
  const paragraphSentences = paragraphs.map((p) => splitSentencesSimple(p));
  const sentences = paragraphSentences.flat();
  const totalSentenceCount = sentences.length;

  const bodyParagraphIndices = getBodyParagraphIndices(paragraphs);
  const bodyParagraphs = bodyParagraphIndices.map((idx) => paragraphs[idx] || "");
  const bodyParagraphCount = bodyParagraphs.length;

  const techniqueFailures = [];
  const evidenceFailures = [];
  const undevelopedParagraphs = [];
  const weakStartSentences = [];

  let techniqueOkCount = 0;
  let evidenceOkCount = 0;
  let undevelopedCount = 0;
  let weakStartCount = 0;

  const techniquesAvailable = Boolean(thesisDevicesLexicon && thesisDevicesLexicon.size);

  bodyParagraphs.forEach((para, idx) => {
    const paraIndex = bodyParagraphIndices[idx];
    const sentenceCount = paragraphSentences[paraIndex]?.length || 0;
    if (sentenceCount < 4) {
      undevelopedCount += 1;
      undevelopedParagraphs.push(paraIndex);
    }
    const shortQuoteCount = countShortQuotesInParagraph(para);
    if (shortQuoteCount >= 2) {
      evidenceOkCount += 1;
    } else {
      evidenceFailures.push(paraIndex);
    }
    if (!techniquesAvailable) return;
    const canonicalDevices = getCanonicalDevicesInParagraph(para, thesisDevicesLexicon);
    if (canonicalDevices.size >= 3) {
      techniqueOkCount += 1;
    } else {
      techniqueFailures.push(paraIndex);
    }
  });

  if (!techniquesAvailable) {
    techniqueOkCount = bodyParagraphCount;
  }

  const structureFailures = [];
  let structureOkCount = 0;

  bodyParagraphIndices.forEach((paraIndex) => {
    const sentenceList = paragraphSentences[paraIndex] || [];
    let weakInPara = 0;
    sentenceList.forEach((sentence) => {
      const starter = getSentenceStarterWord(sentence);
      if (starter && WEAK_STARTERS.has(starter)) {
        weakInPara += 1;
        weakStartCount += 1;
        weakStartSentences.push({ sentence, paragraph_index: paraIndex });
      }
    });
    if (weakInPara > 1) structureFailures.push(paraIndex);
    else structureOkCount += 1;
  });

  const techRatio = bodyParagraphCount ? techniqueOkCount / bodyParagraphCount : 1;
  const evidenceRatio = bodyParagraphCount ? evidenceOkCount / bodyParagraphCount : 1;
  const devRatio = bodyParagraphCount ? 1 - undevelopedCount / bodyParagraphCount : 1;
  const structureRatio = bodyParagraphCount ? structureOkCount / bodyParagraphCount : 1;
  const varietyScore = clamp(
    Math.round(100 * (0.35 * techRatio + 0.35 * evidenceRatio + 0.2 * devRatio + 0.1 * structureRatio)),
    0,
    100
  );

  const cohesionCalc = computeCohesionParagraphAware(paragraphs);
  const cohesionScore = cohesionCalc.cohesionScore;

  const counts = labelCounts && typeof labelCounts === "object" ? labelCounts : {};
  const hasPrecisionCounts = markEventId !== null && markEventId !== undefined;
  let precisionScore = null;
  let precisionDetails = {
    unnecessaryCount: 0,
    wordyCount: 0,
    impreciseCount: 0,
    hasCounts: false
  };
  if (hasPrecisionCounts) {
    const unnecessaryCount = sumLabelCounts(UNNECESSARY_LABELS, counts);
    const wordyCount = sumLabelCounts(WORDY_LABELS, counts);
    const impreciseCount = sumLabelCounts(IMPRECISE_LABELS, counts);
    const penalty = unnecessaryCount * 3 + wordyCount * 2 + impreciseCount * 3;
    precisionScore = clamp(100 - penalty, 0, 100);
    precisionDetails = {
      unnecessaryCount,
      wordyCount,
      impreciseCount,
      hasCounts: true
    };
  }

  return {
    power: {
      score: powerScore,
      sub: "",
      details: { weakCount, weakByBase, powerCount, powerTarget }
    },
    variety: {
      score: varietyScore,
      sub: "",
      details: {
        bodyParagraphCount,
        bodyParagraphIndices,
        paragraphsFiltered: paragraphs,
        techniqueOkCount,
        techniqueFailures,
        evidenceOkCount,
        evidenceFailures,
        undevelopedCount,
        undevelopedParagraphs,
        structureOkCount,
        structureFailures,
        weakStartCount,
        weakStartSentences,
        totalSentenceCount,
        techniquesUnavailable: !techniquesAvailable
      }
    },
    cohesion: {
      score: cohesionScore,
      sub: cohesionCalc.cohesionSub,
      details: cohesionCalc.details
    },
    precision: {
      score: precisionScore,
      sub: "",
      details: precisionDetails
    },
    meta: {
      paragraphs: rawParagraphs.length,
      sentences: totalSentenceCount,
      mode: mode || ""
    }
  };
};
