import { useEffect, useState } from "react";
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

const STEPS = [
  {
    id: "first-sentence",
    title: "First Sentence",
    description:
      "State the author\u2019s full name, the genre, the title of the text (properly formatted), and a concrete summary using a power verb.",
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
    description:
      "End your introduction with a closed thesis that names 2\u20133 literary devices or strategies. A closed thesis tells the reader exactly what to expect in the body.",
    example: (
      <>
        Through <strong>symbolism</strong>, <strong>imagery</strong>, and{" "}
        <strong>nonlinear narrative</strong>, Morrison illustrates how the past
        haunts Sethe and her family.
      </>
    ),
    doneAfter: STAGE_CLOSED_THESIS,
  },
  {
    id: "intro-summary",
    title: "Intro Summary",
    description:
      "For each device in your thesis, write a sentence that situates the reader in the moment of the text where that technique appears. Introduce the text through its techniques\u2014don\u2019t name the devices directly.",
    example: null,
    doneAfter: STAGE_INTRO_SUMMARY,
  },
  {
    id: "topic-sentence",
    title: "Topic Sentences",
    description:
      "After your introduction, write a boundary statement to transition into the body. Begin each body paragraph with a topic sentence that names the device and connects it to the thesis using word repetition, synonyms, or antonyms.",
    example: null,
    doneAfter: STAGE_TOPIC_SENTENCE,
  },
  {
    id: "body-evidence",
    title: "Body Evidence",
    description:
      "Support each topic sentence with evidence: provide context, integrate a quotation (shorten, modify, or insert), explain its significance, and relate it back to your thesis.",
    example: null,
    doneAfter: STAGE_BODY_EVIDENCE,
  },
  {
    id: "conclusion",
    title: "Conclusion & Title",
    description:
      "Write a conclusion that summarizes your analysis without introducing new evidence. Then add a properly formatted title using the pattern: \u201CQuotation\u201D: Topic in Title.",
    example: null,
    doneAfter: null, // final step — never fully "done"
  },
];

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

export default function WritingGuide({ stage, missingComponents, authorName, sentenceCount, onDeviceCountChange }) {
  const [thesisDevices, setThesisDevices] = useState(["", "", ""]);

  const missingParts = missingComponents?.missing
    ? Object.entries(COMPONENT_NAMES)
        .filter(([k]) => !missingComponents[k])
        .map(([, v]) => v)
    : [];

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
