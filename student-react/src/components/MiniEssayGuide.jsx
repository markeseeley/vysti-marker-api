import { useMemo } from "react";
import deviceLookup from "../data/thesisDeviceLookup.json";

/**
 * Mini-essay guide — single-paragraph 5-stage walkthrough.
 *
 * Stages (no acronym shown to students):
 *   1. Context        — set up the situation + make your claim, using an
 *                       argumentative verb (Analysis mode also names a
 *                       technique here)
 *   2. Evidence       — short integrated quotation (Analysis: required,
 *                       ≤5 words) or a specific example/statistic (Argument)
 *   3. Explanation    — show HOW the evidence supports your claim
 *   4. Clarification  — sharpen or nuance what you just said
 *   5. Refer          — circle back to the claim with a fresh angle
 *
 * The tone is intentionally warmer than the analytic guide — Mini-essays
 * are often the first analytical-paragraph teachers assign middle schoolers,
 * and a friendlier voice keeps students moving instead of stalling.
 *
 * Two sub-modes via writeModeConfig.subMode:
 *   "analysis" — Evidence MUST be a short quote; Context must include a
 *                technique drawn from the device lexicon
 *   "argument" — Evidence is encouraged but not enforced; no technique
 *                requirement (Context just needs an argumentative verb)
 */

// Argumentative + summary verbs mirrors marker.py THESIS_VERB_LEMMAS +
// SUMMARY_VERB_LEMMAS. Either family signals a real claim in Context.
const ARG_VERBS = new Set([
  "argues", "argue", "arguing",
  "claims", "claim", "claiming",
  "suggests", "suggest", "suggesting",
  "shows", "show", "showing",
  "demonstrates", "demonstrate", "demonstrating",
  "reveals", "reveal", "revealing",
  "explores", "explore", "exploring",
  "emphasizes", "emphasize", "emphasizing",
  "illustrates", "illustrate", "illustrating",
  "highlights", "highlight", "highlighting",
  "contends", "contend", "contending",
  "asserts", "assert", "asserting",
  "implies", "imply", "implying",
  "maintains", "maintain", "maintaining",
  "proposes", "propose", "proposing",
  "presents", "present", "presenting",
  "explains", "explain", "explaining",
  "conveys", "convey", "conveying",
  "portrays", "portray", "portraying",
  "challenges", "challenge", "challenging",
  "critiques", "critique", "critiquing",
  "examines", "examine", "examining",
  "depicts", "depict", "depicting",
  "captures", "capture", "capturing",
  "confronts", "confront", "confronting",
  "articulates", "articulate", "articulating",
  "addresses", "address", "addressing",
  "chronicles", "chronicle", "chronicling",
  "documents", "document", "documenting",
  "traces", "trace", "tracing",
  "uncovers", "uncover", "uncovering",
  "investigates", "investigate", "investigating",
  "describes", "describe", "describing",
]);

// Quote regex covers ASCII straight " (") plus left/right curly
// double quotes (“ / ”). Earlier version missed straight quotes.
const QUOTE_RE = /["“”]([^"“”]+)["“”]/g;

// Mini-essay technique detection: look up any device term ANYWHERE in the
// sentence (not just before the verb, the way extractThesisDevices does
// for analytic-essay thesis sentences). Sorted longest-first so
// "internal monologue" matches before "monologue".
const TECHNIQUE_TERMS = Object.keys(deviceLookup)
  .filter((t) => t.length >= 4)
  .sort((a, b) => b.length - a.length);

function detectTechniqueInSentence(sentence) {
  if (!sentence) return null;
  const lower = sentence.toLowerCase();
  for (const term of TECHNIQUE_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return deviceLookup[term];
  }
  return null;
}

/**
 * Split text into sentences, treating quoted spans as atomic so a period
 * INSIDE a quote (English convention: "brutal and unending.") doesn't get
 * mistaken for a sentence boundary. Recognizes ASCII straight " and curly
 * “ ” quotes.
 */
function splitSentences(text) {
  if (!text) return [];
  const out = [];
  let cur = "";
  let inQuote = false;
  // Track which char opened the quote so curly ” doesn't close after “.
  let openChar = null;
  const flush = () => {
    const trimmed = cur.trim();
    if (trimmed) out.push(trimmed);
    cur = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    cur += c;

    if (c === "“") { inQuote = true; openChar = "”"; continue; }
    if (c === "”" && openChar === "”") {
      inQuote = false;
      openChar = null;
      // English convention: ." or .” ends the outer sentence too.
      const prev = cur.length >= 2 ? cur[cur.length - 2] : "";
      if (prev === "." || prev === "!" || prev === "?") flush();
      continue;
    }
    if (c === '"') {
      if (inQuote && openChar === '"') {
        inQuote = false;
        openChar = null;
        const prev = cur.length >= 2 ? cur[cur.length - 2] : "";
        if (prev === "." || prev === "!" || prev === "?") flush();
      } else if (!inQuote) {
        inQuote = true;
        openChar = '"';
      }
      continue;
    }
    if (!inQuote && (c === "." || c === "!" || c === "?")) {
      // Pick up an immediately-following closing quote with this sentence
      // (defensive — covers cases where the quote was opened in a
      // previous sentence and closed here).
      const next = text[i + 1];
      if (next === '"' || next === "”") {
        cur += next;
        i += 1;
      }
      flush();
    }
  }
  // Trailing in-progress sentence (no terminal punctuation yet) — still
  // surface it so the guide advances optimistically as students type.
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

function hasArgVerb(sentence) {
  if (!sentence) return false;
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/);
  return words.some((w) => ARG_VERBS.has(w));
}

function shortQuoteIn(sentence) {
  if (!sentence) return null;
  QUOTE_RE.lastIndex = 0;
  let m;
  while ((m = QUOTE_RE.exec(sentence)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    const wordCount = inner.split(/\s+/).filter(Boolean).length;
    return { text: inner, wordCount, isShort: wordCount <= 5 };
  }
  return null;
}

const STAGE_IDS = ["context", "evidence", "explanation", "clarification", "refer"];

/**
 * Decide which stage the student is currently on, based on how many
 * complete sentences they've written. Optimistic — credits a sentence
 * as "done" as soon as it has terminal punctuation, even if the next
 * stage check isn't satisfied yet (we surface the warning separately).
 */
function detectMiniStage(sentences) {
  const n = sentences.length;
  if (n <= 0) return "context";
  if (n === 1) return "context";
  if (n === 2) return "evidence";
  if (n === 3) return "explanation";
  if (n === 4) return "clarification";
  return "refer";
}

/** Word-overlap proxy: did the last sentence echo a meaningful word from the
 *  first? Used in the Refer stage to nudge the student to circle back. */
function lastSentenceRefersBack(sentences) {
  if (sentences.length < 2) return false;
  const STOP = new Set([
    "the", "and", "but", "for", "with", "that", "this", "is", "was", "are",
    "were", "be", "been", "have", "has", "had", "a", "an", "of", "to", "in",
    "on", "at", "by", "as", "it", "its", "their", "his", "her", "they", "them",
  ]);
  const meaningful = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z\s'-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w))
    );
  const first = meaningful(sentences[0]);
  const last = meaningful(sentences[sentences.length - 1]);
  for (const w of last) if (first.has(w)) return true;
  return false;
}

const STAGES = {
  context: {
    label: "Context",
    n: 1,
    intro: "Open with the situation and your claim. End with a strong verb so it actually argues something.",
  },
  evidence: {
    label: "Evidence",
    n: 2,
    intro: {
      analysis: "Slip in a short quotation — keep it to five words or fewer so it tucks into your sentence.",
      argument: "Now back up that claim. A specific example, a statistic, or a short quotation all work here.",
    },
  },
  explanation: {
    label: "Explanation",
    n: 3,
    intro: "Show how that evidence proves your claim. Don’t just repeat the quote—explain its effect.",
  },
  clarification: {
    label: "Clarification",
    n: 4,
    intro: "Sharpen what you just said. Add nuance, a counterpoint you can dismiss, or a richer reading.",
  },
  refer: {
    label: "Refer",
    n: 5,
    intro: "Close the loop. Echo a key word from your opening claim, then land somewhere new.",
  },
};

export default function MiniEssayGuide({ essayText, writeModeConfig }) {
  const subMode = writeModeConfig?.subMode === "argument" ? "argument" : "analysis";
  const isAnalysis = subMode === "analysis";

  const sentences = useMemo(() => splitSentences(essayText || ""), [essayText]);
  const currentStage = useMemo(() => detectMiniStage(sentences), [sentences]);

  // Stage 1 checks
  const stage1Sentence = sentences[0] || "";
  const stage1HasVerb = hasArgVerb(stage1Sentence);
  const stage1Technique = useMemo(
    () => (isAnalysis ? detectTechniqueInSentence(stage1Sentence) : null),
    [stage1Sentence, isAnalysis]
  );
  const stage1HasTechnique = !!stage1Technique;

  // Stage 2 checks
  const stage2Sentence = sentences[1] || "";
  const stage2Quote = useMemo(() => shortQuoteIn(stage2Sentence), [stage2Sentence]);
  // Analysis: explicit short quote required.
  // Argument: any signal of evidence (quote, number, proper noun) is enough.
  const stage2HasEvidence = isAnalysis
    ? !!(stage2Quote && stage2Quote.isShort)
    : Boolean(
        stage2Quote ||
          /\b\d/.test(stage2Sentence) || // numbers / statistics
          /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(stage2Sentence) || // proper noun pair
          stage2Sentence.length > 30 // any substantive sentence
      );

  // Stage 5 check
  const stage5Refers = useMemo(() => lastSentenceRefersBack(sentences), [sentences]);

  return (
    <div className="writing-guide mini-essay-guide">
      <h3 className="writing-guide-title">Mini-essay Guide</h3>
      <p className="mini-essay-encouragement">
        {sentences.length === 0
          ? "Take a deep breath—you’ve got this. One sentence at a time."
          : sentences.length < 3
            ? "Nice start. Keep going."
            : sentences.length < 5
              ? "Beautiful—you’re almost there."
              : "Read it through. Does it land?"}
      </p>

      <div className="writing-guide-steps">
        {STAGE_IDS.map((id, idx) => {
          const stage = STAGES[id];
          const stepNumber = idx + 1;
          const isCurrent = currentStage === id;
          const isDone = sentences.length > stage.n;
          const status = isDone ? "done" : isCurrent ? "current" : "upcoming";

          return (
            <div key={id} className={`writing-guide-step step-${status}`}>
              <div className="step-indicator">
                {status === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="step-number">{stepNumber}</span>
                )}
              </div>
              <div className="step-content">
                <p className="step-title">{stage.label}</p>
                {isCurrent && (
                  <>
                    <p className="step-description">
                      {typeof stage.intro === "string" ? stage.intro : stage.intro[subMode]}
                    </p>

                    {/* Stage 1 — Context checks */}
                    {id === "context" && stage1Sentence && (
                      <>
                        {!stage1HasVerb && (
                          <p className="step-missing">
                            Try a verb that actually argues: <em>argues</em>, <em>shows</em>, <em>reveals</em>, <em>demonstrates</em>, <em>challenges</em>…
                          </p>
                        )}
                        {stage1HasVerb && isAnalysis && !stage1HasTechnique && (
                          <p className="step-missing">
                            Name the technique you&rsquo;ll analyze—metaphor, irony, repetition, contrast… so the reader knows what to expect.
                          </p>
                        )}
                        {stage1HasVerb && (isAnalysis ? stage1HasTechnique : true) && (
                          <p className="step-good">
                            That&rsquo;s a real claim. {isAnalysis && stage1Technique ? <>You named <strong>{stage1Technique}</strong>— nice.</> : "Onward."}
                          </p>
                        )}
                      </>
                    )}

                    {/* Stage 2 — Evidence checks */}
                    {id === "evidence" && stage2Sentence && (
                      <>
                        {isAnalysis && !stage2Quote && (
                          <p className="step-missing">
                            Drop in a short quotation, in &ldquo;double quotes&rdquo;.
                          </p>
                        )}
                        {isAnalysis && stage2Quote && !stage2Quote.isShort && (
                          <p className="step-missing">
                            That quote is {stage2Quote.wordCount} words—trim it to 5 or fewer so it integrates into your sentence.
                          </p>
                        )}
                        {!isAnalysis && !stage2HasEvidence && (
                          <p className="step-missing">
                            Give us something concrete to point at—an example, a statistic, a quotation. Specificity is persuasive.
                          </p>
                        )}
                        {stage2HasEvidence && (
                          <p className="step-good">Solid evidence. Now make it work for you.</p>
                        )}
                      </>
                    )}

                    {/* Stage 3 — Explanation checks */}
                    {id === "explanation" && sentences[2] && (
                      <p className="step-good">Good—the &lsquo;so what&rsquo; is what makes analysis matter.</p>
                    )}

                    {/* Stage 4 — Clarification checks */}
                    {id === "clarification" && sentences[3] && (
                      <p className="step-good">Layered. The reader trusts you more with every nuance.</p>
                    )}

                    {/* Stage 5 — Refer checks */}
                    {id === "refer" && sentences[4] && (
                      <>
                        {!stage5Refers && (
                          <p className="step-missing">
                            Try echoing a key word from your opening claim so the paragraph feels closed.
                          </p>
                        )}
                        {stage5Refers && (
                          <p className="step-good">
                            You brought it home. Read it once aloud—if it sounds like you, you&rsquo;re done.
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

      {sentences.length >= 5 && stage5Refers && (
        <div className="writing-guide-complete">
          <div className="complete-icon">&#x2714;</div>
          <p className="complete-heading">Your paragraph is complete</p>
          <p className="complete-body">
            Read it through once more for rhythm and flow. When you&rsquo;re happy with it, download
            or run it through Revise for sentence-level feedback.
          </p>
        </div>
      )}
    </div>
  );
}
