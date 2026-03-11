import { useEffect, useMemo, useState } from "react";
import {
  STAGE_EMPTY,
  STAGE_FIRST_SENTENCE,
  STAGE_CLOSED_THESIS,
  STAGE_INTRO_SUMMARY,
  STAGE_TOPIC_SENTENCE,
  STAGE_BODY_EVIDENCE,
  STAGE_CONCLUSION,
  STAGE_ORDER,
} from "../lib/writingStage";
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
  "transcript", "interview",
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
      doneAfter: null,
    },
  ];
}

const COMPONENT_NAMES = {
  has_author: "the author\u2019s full name",
  has_title: "a properly formatted title",
  has_genre: "the genre",
  has_summary_verb: "a summary verb (e.g., depicts, examines, explores)",
};

function formatList(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function getStepStatus(step, stage) {
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

  // Client-side genre detection from the first sentence of the essay
  const clientGenreDetected = useMemo(() => {
    const trimmed = (essayText || "").trim();
    if (!trimmed) return false;
    // Get the first sentence (up to first sentence-ending punctuation)
    const firstSentMatch = trimmed.match(/^[^.!?]+[.!?]/);
    const firstSent = firstSentMatch ? firstSentMatch[0] : trimmed;
    return textContainsGenre(firstSent);
  }, [essayText]);

  const missingParts = useMemo(() => {
    const parts = [];
    if (missingComponents) {
      for (const [k, label] of Object.entries(COMPONENT_NAMES)) {
        if (k === "has_genre") {
          // Prefer client-side genre check (faster, works before API responds)
          if (!missingComponents[k] && !clientGenreDetected) parts.push(label);
        } else {
          if (!missingComponents[k]) parts.push(label);
        }
      }
    } else if (!clientGenreDetected && essayText?.trim().length > 20) {
      // Before API has responded, still check genre client-side
      parts.push(COMPONENT_NAMES.has_genre);
    }
    return parts;
  }, [missingComponents, clientGenreDetected, essayText]);

  const filledDevices = thesisDevices.filter((d) => d.trim());

  // Report device count to parent so resolveStage can gate promotion
  useEffect(() => {
    onDeviceCountChange?.(filledDevices.length);
  }, [filledDevices.length, onDeviceCountChange]);

  // Expected: 1 (first sentence) + N (one per device) + 1 (thesis) = N + 2
  const introSentencesNeeded = filledDevices.length + 2;
  const needsMoreIntro = filledDevices.length > 0 && (sentenceCount || 0) < introSentencesNeeded;

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
                    {step.id === "intro-summary" && filledDevices.length > 0 && (
                      <>
                        <ul className="intro-device-list">
                          {filledDevices.map((d, idx) => (
                            <li key={idx} className="intro-device-item">
                              <strong>{d}</strong>
                              <span>
                                {" "}&mdash; Write a sentence placing the reader where
                                this appears in the text.
                              </span>
                            </li>
                          ))}
                        </ul>
                        {needsMoreIntro && (
                          <p className="step-missing">
                            Did you adequately introduce both the text and your thesis?
                          </p>
                        )}
                      </>
                    )}
                    {step.id === "topic-sentence" && (
                      <TopicSentenceHelper devices={thesisDevices} />
                    )}
                    {step.id === "body-evidence" && (
                      <BodyEvidenceHelper bodyParaStats={bodyParaStats} devices={filledDevices} thesisSentence={thesisSentence} />
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
    </div>
  );
}
