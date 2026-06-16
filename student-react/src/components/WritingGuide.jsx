import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STAGE_EMPTY,
  STAGE_FIRST_SENTENCE,
  STAGE_CLOSED_THESIS,
  STAGE_INTRO_SUMMARY,
  STAGE_TOPIC_SENTENCE,
  STAGE_BODY_EVIDENCE,
  STAGE_CONCLUSION,
  STAGE_COMPLETE,
  STAGE_ORDER,
} from "../lib/writingStage";
import { extractThesisDevices, extractContentWords } from "../lib/extractThesisDevices";
import ThesisPlanner from "./ThesisPlanner";
import TopicSentenceHelper from "./TopicSentenceHelper";
import BodyEvidenceHelper from "./BodyEvidenceHelper";
import ConclusionHelper from "./ConclusionHelper";

// ── Genre detection ──
// Lowercase terms checked against the first sentence via word boundaries.
const GENRE_TERMS = [
  // Fiction / Literature
  "novel", "novella", "short story", "play", "tragedy", "comedy", "drama",
  "fable", "parable", "allegory", "epic", "saga", "romance", "thriller", "mystery",
  // Poetry
  "poem", "sonnet", "ode", "elegy", "ballad", "haiku", "epic poem",
  "villanelle", "sestina", "pantoum",
  // Nonfiction
  "essay", "memoir", "autobiography", "biography", "article", "editorial",
  "op-ed", "letter", "speech", "sermon", "manifesto", "journal", "diary",
  // Academic / Informational
  "report", "study", "review", "critique", "analysis", "dissertation", "thesis",
  // Media / Visual
  "advertisement", "infographic", "cartoon", "comic", "graphic novel",
  "documentary", "film", "photograph", "poster",
  // Other
  "monologue", "soliloquy", "satire", "narrative", "myth", "legend",
  "folk tale", "fairy tale", "anthem", "hymn", "vignette", "prose",
  "transcript", "interview", "dialogue", "treatise", "pamphlet",
  "chapter", "address", "letter", "lecture", "sermon",
  // Common student shorthand
  "story", "book",
];

// Pre-build regex patterns (sorted longest-first so "short story" matches before "story")
const GENRE_PATTERNS = GENRE_TERMS
  .sort((a, b) => b.length - a.length)
  .map((t) => new RegExp(`\\b${t.replace(/\s+/g, "\\s+")}\\b`, "i"));

function textContainsGenre(text) {
  if (!text) return false;
  return GENRE_PATTERNS.some((re) => re.test(text));
}

function buildSteps(authorName, textTitle, textIsMinor) {
  const hasAuthor = Boolean(authorName?.trim());
  const hasTitle = Boolean(textTitle?.trim());
  const author = hasAuthor ? authorName.trim() : null;
  const title = hasTitle ? textTitle.trim() : null;
  const lastName = author ? author.split(/\s+/).pop() : null;

  // Personalized first-sentence description
  let firstSentenceDesc;
  if (hasAuthor && hasTitle) {
    firstSentenceDesc = `It looks like you\u2019re analyzing ${author}\u2019s ${textIsMinor ? `\u201C${title}\u201D` : title}. Start with a sentence that states the author\u2019s full name, the genre, the properly formatted title, and a concrete summary using a power verb.`;
  } else if (hasAuthor) {
    firstSentenceDesc = `You\u2019re working with ${author}. State the author\u2019s full name, the genre, the title of the text (properly formatted), and a concrete summary using a power verb.`;
  } else {
    firstSentenceDesc = "State the author\u2019s full name, the genre, the title of the text (properly formatted), and a concrete summary using a power verb.";
  }

  // Personalized thesis description
  const thesisDesc = hasAuthor
    ? `End your introduction with a closed thesis that names the literary devices or strategies your essay will analyze. Tell the reader exactly what ${lastName} does and how you will prove it.`
    : "End your introduction with a closed thesis that names the literary devices or strategies your essay will analyze. A closed thesis tells the reader exactly what to expect in the body.";

  return [
    {
      id: "first-sentence",
      title: "First Sentence",
      description: firstSentenceDesc,
      example: (
        <>
          Toni Morrison's novel <em>Beloved</em> depicts Sethe's struggle with
          the trauma of slavery and the devastating choices she makes to protect
          her children.
        </>
      ),
      doneAfter: STAGE_FIRST_SENTENCE,
    },
    {
      id: "closed-thesis",
      title: "Closed Thesis",
      description: thesisDesc,
      example: (
        <>
          Through <strong>a symbol of trees</strong>, <strong>an image of water</strong>, and{" "}
          <strong>a nonlinear narrative structure</strong>, Morrison illustrates how
          the past haunts Sethe and her family.
        </>
      ),
      doneAfter: STAGE_CLOSED_THESIS,
    },
    {
      id: "intro-summary",
      title: "Intro Summary",
      description:
        "Now go back between your first sentence and your thesis. For each device in your thesis, write a sentence that situates the reader in the moment of the text where that technique appears. Introduce the text through its techniques\u2014don\u2019t name the devices directly. Your introduction should flow: first sentence \u2192 summary sentences \u2192 thesis.",
      example: null,
      doneAfter: STAGE_INTRO_SUMMARY,
    },
    {
      id: "topic-sentence",
      title: "Topic Sentences",
      description:
        "After your introduction, write a boundary statement to transition into the body. A boundary statement repeats a key word from the end of your previous paragraph in the opening of your next. Begin each body paragraph with a topic sentence that names the device and connects it to the thesis.",
      example: null,
      doneAfter: STAGE_TOPIC_SENTENCE,
    },
    {
      id: "body-evidence",
      title: "Body Evidence",
      description: hasTitle
        ? `Support each topic sentence with evidence from ${textIsMinor ? `\u201C${title}\u201D` : title}: provide context, integrate a quotation (shorten, modify, or insert), explain its significance, and relate it back to your thesis.`
        : "Support each topic sentence with evidence: provide context, integrate a quotation (shorten, modify, or insert), explain its significance, and relate it back to your thesis.",
      example: null,
      doneAfter: STAGE_BODY_EVIDENCE,
    },
    {
      id: "conclusion",
      title: "Conclusion & Title",
      description: hasTitle
        ? `Write a conclusion that summarizes your analysis of ${textIsMinor ? `\u201C${title}\u201D` : title} without introducing new evidence. Then add a properly formatted title using the pattern: \u201CQuotation\u201D: Topic in Title.`
        : "Write a conclusion that summarizes your analysis without introducing new evidence. Then add a properly formatted title using the pattern: \u201CQuotation\u201D: Topic in Title.",
      example: null,
      doneAfter: STAGE_CONCLUSION,
    },
  ];
}

const COMPONENT_NAMES = {
  has_author: "the author\u2019s full name",
  has_title: "a properly formatted title",
  has_genre: "the genre",
  has_summary_verb: "a summary verb (e.g., depicts, examines, explores)",
};

// ── Client-side first-sentence component detection ──
// Mirrors the backend logic in marker.py so we can give instant feedback
// before the API responds (2.7s debounce + network).

const SUMMARY_VERBS = new Set([
  // Thesis verbs
  "argue", "argues", "arguing", "claim", "claims", "claiming",
  "suggest", "suggests", "suggesting", "show", "shows", "showing",
  "demonstrate", "demonstrates", "demonstrating", "reveal", "reveals", "revealing",
  "explore", "explores", "exploring", "emphasize", "emphasizes", "emphasizing",
  "illustrate", "illustrates", "illustrating", "highlight", "highlights", "highlighting",
  "contend", "contends", "contending", "assert", "asserts", "asserting",
  "imply", "implies", "implying", "maintain", "maintains", "maintaining",
  "propose", "proposes", "proposing", "present", "presents", "presenting",
  "explain", "explains", "explaining", "convey", "conveys", "conveying",
  "portray", "portrays", "portraying",
  // Summary-only verbs
  "describe", "describes", "describing", "depict", "depicts", "depicting",
  "examine", "examines", "examining", "analyze", "analyzes", "analyzing",
  "focus", "focuses", "focusing", "discuss", "discusses", "discussing",
  "encounter", "encounters", "encountering", "navigate", "navigates", "navigating",
  "recount", "recounts", "recounting", "reflect", "reflects", "reflecting",
  "address", "addresses", "addressing", "chronicle", "chronicles", "chronicling",
  "capture", "captures", "capturing", "confront", "confronts", "confronting",
  "grapple", "grapples", "grappling", "contemplate", "contemplates", "contemplating",
  "consider", "considers", "considering", "critique", "critiques", "critiquing",
  "challenge", "challenges", "challenging", "investigate", "investigates", "investigating",
  "uncover", "uncovers", "uncovering", "document", "documents", "documenting",
  "detail", "details", "detailing", "trace", "traces", "tracing",
  "express", "expresses", "expressing", "articulate", "articulates", "articulating",
  "expose", "exposes", "exposing",
]);

const TITLE_QUOTE_RE = /["""][^"""]+["""]/;

/**
 * Detect first-sentence components entirely client-side.
 * Returns { has_author, has_genre, has_title, has_summary_verb }.
 */
function detectFirstSentenceComponents(firstSentence, authorName, textTitle) {
  const result = { has_author: false, has_genre: false, has_title: false, has_summary_verb: false };
  if (!firstSentence) return result;

  const sent = firstSentence.trim();

  // Author: check that the name entered in the Author field appears in the sentence.
  // Works for multi-word names ("Toni Morrison") and single-word names ("Plato").
  // "Morrison's" alone won't pass when the full name is "Toni Morrison".
  if (authorName?.trim()) {
    result.has_author = sent.toLowerCase().includes(authorName.trim().toLowerCase());
  } else {
    // No author entered yet — look for a capitalized proper noun as heuristic
    // Matches "Plato's", "Toni Morrison's", "George Orwell", etc.
    result.has_author = /[A-Z][a-z]+'s\b/.test(sent) || /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(sent);
  }

  // Genre: reuse the existing GENRE_PATTERNS
  result.has_genre = textContainsGenre(sent);

  // Title: check for quoted text or if the entered title appears
  if (TITLE_QUOTE_RE.test(sent)) {
    result.has_title = true;
  } else if (textTitle?.trim()) {
    // Check for italicized title (plain text match — italics are in the DOM, not text)
    result.has_title = sent.toLowerCase().includes(textTitle.trim().toLowerCase());
  }

  // Summary verb: the sentence should contain a concrete action verb (not just
  // a linking verb like "is/was/are"). Rather than maintaining an exhaustive
  // allow-list, we check that the sentence has a verb beyond bare copulas.
  // If the sentence has author + title + genre and ends with a period,
  // it almost certainly has a summary — but "X is about Y" is too vague.
  const lowerSent = sent.toLowerCase();
  const wordsArr = lowerSent.split(/\s+/).map((w) => w.replace(/[.,;:!?'"]+$/, ""));
  const WEAK_VERBS = new Set(["is", "was", "are", "were", "be", "been", "being", "has", "had", "have"]);
  // Check if any word is a known strong summary verb (fast path)
  const hasStrongVerb = wordsArr.some((w) => SUMMARY_VERBS.has(w));
  if (hasStrongVerb) {
    result.has_summary_verb = true;
  } else {
    // Fallback: flag as missing only if the only verbs present are weak/linking
    // Common pattern: "Morrison's novel Beloved is about..." — "is about" is too vague
    const hasAnyNonWeakVerb = wordsArr.some(
      (w) => !WEAK_VERBS.has(w) && /^[a-z]{3,}(s|es|ed|ing|tes|ses|zes)$/.test(w)
    );
    result.has_summary_verb = hasAnyNonWeakVerb;
  }

  return result;
}

function formatList(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function getStepStatus(step, stage) {
  // When the essay is complete, all steps are done
  if (stage === STAGE_COMPLETE) return "done";

  const stageIdx = STAGE_ORDER.indexOf(stage);
  const doneIdx = step.doneAfter ? STAGE_ORDER.indexOf(step.doneAfter) : -1;

  if (doneIdx >= 0 && stageIdx > doneIdx) return "done";
  if (
    (step.id === "first-sentence" && (stage === STAGE_EMPTY || stage === STAGE_FIRST_SENTENCE)) ||
    (step.id === "closed-thesis" && stage === STAGE_CLOSED_THESIS) ||
    (step.id === "intro-summary" && stage === STAGE_INTRO_SUMMARY) ||
    (step.id === "topic-sentence" && stage === STAGE_TOPIC_SENTENCE) ||
    (step.id === "body-evidence" && stage === STAGE_BODY_EVIDENCE) ||
    (step.id === "conclusion" && stage === STAGE_CONCLUSION)
  ) {
    return "current";
  }
  return "upcoming";
}

export default function WritingGuide({ stage, missingComponents, authorName, textTitle, textIsMinor, onTextIsMinorChange, sentenceCount, onDeviceCountChange, bodyParaStats, thesisSentence, onSkipStage, essayText }) {
  const [thesisDevices, setThesisDevices] = useState([""]);
  const STEPS = buildSteps(authorName, textTitle, textIsMinor);

  // Extract the first sentence from the essay text
  const firstSentence = useMemo(() => {
    const trimmed = (essayText || "").trim();
    if (!trimmed) return "";
    const match = trimmed.match(/^[^.!?]+[.!?]/);
    return match ? match[0] : trimmed;
  }, [essayText]);

  // Instant client-side detection of all four first-sentence components.
  // This gives feedback as the student types — no API roundtrip needed.
  const clientComponents = useMemo(
    () => detectFirstSentenceComponents(firstSentence, authorName, textTitle),
    [firstSentence, authorName, textTitle]
  );

  // Merge: prefer client-side (instant) over API (delayed).
  // A component is "present" if EITHER source says so.
  const mergedComponents = useMemo(() => {
    const api = missingComponents || {};
    return {
      has_author: clientComponents.has_author || Boolean(api.has_author),
      has_genre: clientComponents.has_genre || Boolean(api.has_genre),
      has_title: clientComponents.has_title || Boolean(api.has_title),
      has_summary_verb: clientComponents.has_summary_verb || Boolean(api.has_summary_verb),
    };
  }, [clientComponents, missingComponents]);

  const missingParts = useMemo(() => {
    // Don't show missing parts until there's some text
    if (!firstSentence || firstSentence.length < 15) return [];
    const parts = [];
    for (const [k, label] of Object.entries(COMPONENT_NAMES)) {
      if (!mergedComponents[k]) parts.push(label);
    }
    return parts;
  }, [mergedComponents, firstSentence]);

  const filledDevices = thesisDevices.filter((d) => d.trim());

  // Auto-detect devices from the actual thesis sentence text
  const detectedDevices = useMemo(
    () => extractThesisDevices(thesisSentence),
    [thesisSentence]
  );

  // Track devices the student dismissed (e.g., "parallel" detected as
  // parallelism when the student meant the adjective). Reset whenever
  // the underlying detection set changes (thesis edited).
  const [dismissedDevices, setDismissedDevices] = useState(new Set());
  const lastDetectedKey = useRef("");
  useEffect(() => {
    const key = detectedDevices.join("|");
    if (key !== lastDetectedKey.current) {
      lastDetectedKey.current = key;
      // Keep dismissals only for devices that still exist in the new detection
      setDismissedDevices((prev) => {
        const next = new Set();
        for (const d of prev) if (detectedDevices.includes(d)) next.add(d);
        return next;
      });
    }
  }, [detectedDevices]);

  const dismissDevice = useCallback((device) => {
    setDismissedDevices((prev) => {
      const next = new Set(prev);
      next.add(device);
      return next;
    });
  }, []);

  // Use planner devices if the student filled them in, otherwise fall back
  // to auto-detected devices from the thesis text (minus any dismissed).
  const activeDevices = filledDevices.length > 0
    ? filledDevices
    : detectedDevices.filter((d) => !dismissedDevices.has(d));

  // Extract boundary words from the last sentence of the intro paragraph
  // (useful for topic-sentence boundary-statement suggestions)
  const introBoundaryWords = useMemo(() => {
    const trimmed = (essayText || "").trim();
    if (!trimmed) return [];
    const paragraphs = trimmed.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (paragraphs.length === 0) return [];
    const intro = paragraphs[0];
    // Get the last sentence of the intro (the thesis)
    const sentences = intro.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length === 0) return [];
    return extractContentWords(sentences[sentences.length - 1]);
  }, [essayText]);

  // Report device count to parent so resolveStage can gate promotion
  useEffect(() => {
    onDeviceCountChange?.(activeDevices.length);
  }, [activeDevices.length, onDeviceCountChange]);

  // Expected: 1 (first sentence) + N (one per device) + 1 (thesis) = N + 2
  const introSentencesNeeded = activeDevices.length + 2;
  const needsMoreIntro = activeDevices.length > 0 && (sentenceCount || 0) < introSentencesNeeded;

  return (
    <div className="writing-guide">
      <h3 className="writing-guide-title">Writing Guide</h3>
      <div className="writing-guide-steps">
        {STEPS.map((step, i) => {
          const status = getStepStatus(step, stage);
          return (
            <div
              key={step.id}
              className={`writing-guide-step step-${status}`}
            >
              <div className="step-indicator">
                {status === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7.5L5.5 10.5L11.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="step-number">{i + 1}</span>
                )}
              </div>
              <div className="step-content">
                <p className="step-title">{step.title}</p>
                {status === "current" && (
                  <>
                    <p className="step-description">{step.description}</p>
                    {step.id === "first-sentence" && (
                      <div className="text-type-selector">
                        <p className="text-type-label">What type of text are you analyzing?</p>
                        <label className="text-type-option">
                          <input
                            type="radio"
                            name="textType"
                            checked={textIsMinor}
                            onChange={() => onTextIsMinorChange(true)}
                          />
                          <span>
                            Minor work <em className="text-type-hint">(essay, poem, short story, speech)</em>
                            {" "}&mdash; title in &ldquo;double quotes&rdquo;
                          </span>
                        </label>
                        <label className="text-type-option">
                          <input
                            type="radio"
                            name="textType"
                            checked={!textIsMinor}
                            onChange={() => onTextIsMinorChange(false)}
                          />
                          <span>
                            Major work <em className="text-type-hint">(novel, play, memoir, anthology)</em>
                            {" "}&mdash; title in <em>italics</em>
                          </span>
                        </label>
                      </div>
                    )}
                    {step.id === "first-sentence" && missingParts.length > 0 && (
                      <p className="step-missing">
                        It seems you are missing {formatList(missingParts)}.
                      </p>
                    )}
                    {step.example && (
                      <p className="step-example">
                        <strong>Example:</strong> {step.example}
                      </p>
                    )}
                    {step.id === "closed-thesis" && (
                      <ThesisPlanner
                        authorName={authorName}
                        devices={thesisDevices}
                        onDevicesChange={setThesisDevices}
                      />
                    )}
                    {step.id === "intro-summary" && activeDevices.length > 0 && (
                      <>
                        <p className="intro-detected-note">
                          It looks like the techniques you will analyze are
                          {filledDevices.length === 0 ? " (click × to remove a false match):" : ":"}
                        </p>
                        <p className="intro-detected-guidance">
                          For each one, write a sentence that situates the
                          reader where the technique appears. Don&rsquo;t name
                          the device directly&mdash;let the reader feel it.
                        </p>
                        <ul className="intro-device-list">
                          {activeDevices.map((d, idx) => (
                            <li key={idx} className="intro-device-item">
                              <strong>{d}</strong>
                              {filledDevices.length === 0 && (
                                <button
                                  type="button"
                                  className="intro-device-dismiss"
                                  onClick={() => dismissDevice(d)}
                                  aria-label={`Remove ${d} from detected techniques`}
                                  title="Not actually one of my techniques"
                                >
                                  &times;
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        {needsMoreIntro && (
                          <p className="step-missing">
                            Your introduction needs at least {introSentencesNeeded} sentences:
                            a first sentence, one summary sentence per device, and your thesis.
                          </p>
                        )}
                      </>
                    )}
                    {step.id === "topic-sentence" && (
                      <TopicSentenceHelper
                        devices={activeDevices.length > 0 ? activeDevices : thesisDevices.filter(d => d.trim())}
                        boundaryWords={introBoundaryWords}
                        thesisSentence={thesisSentence}
                      />
                    )}
                    {step.id === "body-evidence" && (
                      <BodyEvidenceHelper bodyParaStats={bodyParaStats} devices={activeDevices} thesisSentence={thesisSentence} />
                    )}
                    {step.id === "conclusion" && (
                      <ConclusionHelper textTitle={textTitle} />
                    )}
                    {step.id !== "conclusion" && onSkipStage && (
                      <button
                        type="button"
                        className="writing-guide-skip"
                        onClick={onSkipStage}
                      >
                        Skip to next step &rarr;
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {stage === STAGE_COMPLETE && (
        <div className="writing-guide-complete">
          <div className="complete-icon">&#x2714;</div>
          <p className="complete-heading">Essay complete</p>
          <p className="complete-body">
            Your essay has all the structural elements: title, introduction,
            body paragraphs, and conclusion. Review any remaining issues in the
            sidebar, then download your essay or run it through Revise for
            detailed feedback.
          </p>
          <div className="complete-actions">
            <a href="/student_react.html" className="complete-link">
              Open in Revise &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
