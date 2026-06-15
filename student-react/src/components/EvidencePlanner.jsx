import { useState, useCallback } from "react";

/**
 * Guided evidence planner shown inside BodyEvidenceHelper.
 *
 * Progressive disclosure: shows one step at a time. Steps only advance
 * when the user clicks "Next →". Completed steps collapse to a compact
 * summary (click to re-edit). Steps 1-3 build one integrated sentence;
 * steps 4-5 are follow-up sentences.
 *
 * Color-coded grammar:
 *   Phrase (blue) → Main clause with "quotation" (maroon) → Phrase (amber)
 */

const MAX_QUOTE_WORDS = 5;

/** Count words inside quotation marks in the evidence clause. */
function countQuotedWords(text) {
  const matches = (text || "").match(/["\u201C]([^"\u201D]*)["\u201D]/g);
  if (!matches) return 0;
  return matches.reduce((total, m) => {
    const inner = m.replace(/^["\u201C]+|["\u201D]+$/g, "").trim();
    return total + (inner ? inner.split(/\s+/).filter(Boolean).length : 0);
  }, 0);
}

/** Check whether the evidence clause contains at least one quotation. */
function hasQuotation(text) {
  return /["\u201C][^"\u201D]+["\u201D]/.test(text || "");
}

const SAMPLE_SENTENCES = [
  { ctx: "When turning toward the door", ev: 'Jack is both "stunned" and "paralyzed,"', expl: "suggesting his inability to process the moment" },
  { ctx: "After hearing the verdict", ev: 'she feels "hollow inside,"', expl: "revealing the emotional weight of the decision" },
  { ctx: "As the train pulls away", ev: 'the narrator describes a "sudden emptiness,"', expl: "emphasizing the finality of the departure" },
  { ctx: "Upon entering the room", ev: 'he notices "shadows gathering" in the corners,', expl: "hinting at the tension beneath the surface" },
  { ctx: "While recounting the memory", ev: 'the speaker admits to feeling "utterly lost,"', expl: "underscoring the confusion that defined the experience" },
];

function pickSample() {
  return SAMPLE_SENTENCES[Math.floor(Math.random() * SAMPLE_SENTENCES.length)];
}

export default function EvidencePlanner({ evidenceNumber, thesisSentence, onClose }) {
  const [sample] = useState(pickSample);
  const [context, setContext] = useState("");
  const [evidence, setEvidence] = useState("");
  const [explanation, setExplanation] = useState("");
  const [clarification, setClarification] = useState("");
  const [relate, setRelate] = useState("");
  const [copied, setCopied] = useState(false);
  // Only advances via "Next →"; clicking a collapsed step sets it back
  const [activeStep, setActiveStep] = useState(1);

  const quotedWords = countQuotedWords(evidence);
  const hasQuote = hasQuotation(evidence);
  const quoteOk = quotedWords > 0 && quotedWords <= MAX_QUOTE_WORDS;

  // Assemble the sentence: Phrase, main clause with "quotation," phrase.
  const ctxTrimmed = context.trim();
  const evTrimmed = evidence.trim();
  const explTrimmed = explanation.trim();

  let ceeSentence = "";
  if (ctxTrimmed && evTrimmed) {
    const ctxPart = ctxTrimmed.replace(/[,;.]$/, "");
    const evPart = evTrimmed.replace(/\.$/, "");
    const explPart = explTrimmed
      ? " " + explTrimmed.replace(/\.$/, "")
      : "";
    ceeSentence = `${ctxPart}, ${evPart}${explPart}.`;
  }

  // Full assembled text
  const clarTrimmed = clarification.trim();
  const relateTrimmed = relate.trim();

  let fullText = ceeSentence;
  if (clarTrimmed) {
    const clarFixed = clarTrimmed.endsWith(".") ? clarTrimmed : clarTrimmed + ".";
    fullText += " " + clarFixed;
  }
  if (relateTrimmed) {
    const relFixed = relateTrimmed.endsWith(".") ? relateTrimmed : relateTrimmed + ".";
    fullText += " " + relFixed;
  }
  fullText = fullText.trim();

  const canCopy = ceeSentence.length > 0;
  // Steps 4-5 are gated behind the sentence being formed
  const sentenceReady = ceeSentence.length > 0;

  const handleCopy = useCallback(async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback not needed for modern browsers
    }
  }, [fullText]);

  const handleReset = useCallback(() => {
    setContext("");
    setEvidence("");
    setExplanation("");
    setClarification("");
    setRelate("");
    setCopied(false);
    setActiveStep(1);
  }, []);

  /** Render a completed step in compact form */
  const renderDone = (num, label, value, colorClass) => (
    <div
      className={`evidence-step-done ${colorClass}`}
      onClick={() => setActiveStep(num)}
      title="Click to edit"
    >
      <div className="evidence-step-done-header">
        <span className="evidence-step-done-num">{num}.</span>
        <span className="evidence-step-done-label">{label}:</span>
      </div>
      <div className="evidence-step-done-value">{value}</div>
    </div>
  );

  return (
    <div className="evidence-planner">
      <div className="evidence-planner-header">
        <span className="evidence-planner-label">
          Plan evidence {evidenceNumber || ""}
        </span>
        <button
          className="evidence-planner-close"
          onClick={onClose}
          aria-label="Close planner"
        >&times;</button>
      </div>

      <p className="evidence-planner-voice">
        Let&rsquo;s build this sentence step by step.
      </p>

      <p className="evidence-planner-structure">
        <span className="color-phrase">Phrase</span>,{" "}
        <span className="color-main-clause">main clause with &ldquo;quotation,&rdquo;</span>{" "}
        <span className="color-explanation">phrase</span>.
      </p>
      <p className="evidence-planner-example">
        <span className="color-phrase">{sample.ctx}</span>,{" "}
        <span className="color-main-clause">{sample.ev}</span>{" "}
        <span className="color-explanation">{sample.expl}</span>.
      </p>

      <div className="evidence-planner-fields">
        {/* ── Step 1: Context ── */}
        {activeStep === 1 ? (
          <div className="evidence-planner-field">
            <label className="evidence-planner-field-label">
              <span className="color-phrase">1. Context</span>
              <span className="evidence-planner-hint"> &mdash; set the scene. What is happening?</span>
            </label>
            <input
              type="text"
              className="evidence-planner-input"
              placeholder="When the man sees the woman"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            {ctxTrimmed && (
              <button className="evidence-step-next" onClick={() => setActiveStep(2)}>
                Next &rarr;
              </button>
            )}
          </div>
        ) : ctxTrimmed && (
          renderDone(1, "Context", ctxTrimmed, "color-phrase")
        )}

        {/* ── Step 2: Evidence ── */}
        {activeStep === 2 ? (
          <div className="evidence-planner-field">
            <label className="evidence-planner-field-label">
              <span className="color-main-clause">2. Evidence</span>
              <span className="evidence-planner-hint"> &mdash; write a sentence that includes a short &ldquo;quotation&rdquo; (max {MAX_QUOTE_WORDS} words)</span>
            </label>
            <input
              type="text"
              className="evidence-planner-input"
              placeholder={'he is "distracted" and "unaware"'}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            {evTrimmed && !hasQuote && (
              <span className="evidence-planner-word-count word-count-over">
                Put your quotation in &ldquo;double quotes&rdquo;
              </span>
            )}
            {quotedWords > 0 && (
              <span className={`evidence-planner-word-count ${quoteOk ? "word-count-ok" : "word-count-over"}`}>
                {quotedWords} quoted word{quotedWords !== 1 ? "s" : ""}
                {quotedWords > MAX_QUOTE_WORDS && " — try to shorten the quotation"}
              </span>
            )}
            {evTrimmed && (
              <button className="evidence-step-next" onClick={() => setActiveStep(3)}>
                Next &rarr;
              </button>
            )}
          </div>
        ) : activeStep > 2 && evTrimmed && (
          renderDone(2, "Evidence", evTrimmed, "color-main-clause")
        )}

        {/* ── Step 3: Explanation ── */}
        {activeStep === 3 ? (
          <div className="evidence-planner-field">
            <label className="evidence-planner-field-label">
              <span className="color-explanation">3. Explanation</span>
              <span className="evidence-planner-hint"> &mdash; so what? What does this reveal?</span>
            </label>
            <input
              type="text"
              className="evidence-planner-input"
              placeholder="suggesting his discomfort in the moment"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
            {explTrimmed && (
              <button className="evidence-step-next" onClick={() => setActiveStep(4)}>
                Next &rarr;
              </button>
            )}
          </div>
        ) : activeStep > 3 && explTrimmed && (
          renderDone(3, "Explanation", explTrimmed, "color-explanation")
        )}

        {/* ── Steps 4-5 only appear after the sentence is formed ── */}
        {activeStep >= 4 && sentenceReady && (
          <>
            <div className="evidence-planner-divider" />

            <p className="evidence-planner-voice evidence-planner-voice-sm">
              Now develop the idea in 1&ndash;2 more sentences.
            </p>

            {/* ── Step 4: Clarification ── */}
            {activeStep === 4 ? (
              <div className="evidence-planner-field">
                <label className="evidence-planner-field-label">
                  4. Clarification
                  <span className="evidence-planner-hint"> &mdash; say the same thing in a different way. Why does this matter?</span>
                </label>
                <textarea
                  className="evidence-planner-textarea"
                  placeholder="This moment reveals how preconceived notions act as barriers to truly knowing another person."
                  rows={2}
                  value={clarification}
                  onChange={(e) => setClarification(e.target.value)}
                />
                {clarTrimmed && (
                  <button className="evidence-step-next" onClick={() => setActiveStep(5)}>
                    Next &rarr;
                  </button>
                )}
              </div>
            ) : activeStep > 4 && clarTrimmed && (
              renderDone(4, "Clarification", clarTrimmed, "")
            )}

            {/* ── Step 5: Relate ── */}
            {activeStep >= 5 && (
              <div className="evidence-planner-field">
                <label className="evidence-planner-field-label">
                  5. Relate
                  <span className="evidence-planner-hint"> &mdash; connect back to your thesis. Use a key word from it.</span>
                </label>
                {thesisSentence && (
                  <div className="evidence-planner-thesis-ref">
                    <span className="evidence-planner-thesis-label">Your thesis:</span>
                    <p className="evidence-planner-thesis-text">{thesisSentence}</p>
                  </div>
                )}
                <textarea
                  className="evidence-planner-textarea"
                  placeholder="Morrison uses this discomfort to illustrate the obstacles inherent in meeting someone new."
                  rows={2}
                  value={relate}
                  onChange={(e) => setRelate(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Full preview + copy */}
      {canCopy && (
        <div className="evidence-planner-full-preview">
          <span className="evidence-planner-preview-label">Your sentence:</span>
          <p className="evidence-planner-preview-text">{fullText}</p>
          <div className="evidence-planner-actions">
            <button
              className="evidence-planner-copy"
              onClick={handleCopy}
            >{copied ? "Copied!" : "Copy to editor"}</button>
            <button
              className="evidence-planner-reset"
              onClick={handleReset}
            >Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}