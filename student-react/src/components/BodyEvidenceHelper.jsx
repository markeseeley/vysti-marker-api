/**
 * Interactive helper shown at Step 5 (Body Evidence).
 *
 * Guides students through inserting evidence: Context → Evidence →
 * Explanation → Clarification → Relate.  Each step maps to rules the
 * marker already checks (floating quotations, explain significance,
 * etc.) so the guidance matches what gets flagged.
 *
 * Shows per-paragraph progress: how many quotations found, whether the
 * paragraph is developed (5+ sentences, 2+ quotations).
 */
import { useState } from "react";
import EvidencePlanner from "./EvidencePlanner";

const MIN_SENTENCES = 5;
const MIN_QUOTES = 2;

function paraStatus(stat) {
  if (stat.sentences < MIN_SENTENCES) return "undeveloped";
  if (stat.quotePairs < MIN_QUOTES) return "needs-evidence";
  return "developed";
}

function paraMessage(stat, index, deviceLabel) {
  const status = paraStatus(stat);
  const label = `Body paragraph ${index + 1}${deviceLabel}`;
  if (status === "undeveloped") {
    const needed = MIN_SENTENCES - stat.sentences;
    return (
      <>
        <strong>{label}:</strong> {stat.sentences} of {MIN_SENTENCES}+ sentences
        {" "}&mdash; add {needed} more sentence{needed !== 1 ? "s" : ""} to develop this paragraph.
        {stat.quotePairs < MIN_QUOTES && (
          <> You also need {MIN_QUOTES - stat.quotePairs} more quotation{MIN_QUOTES - stat.quotePairs !== 1 ? "s" : ""}.</>
        )}
      </>
    );
  }
  if (status === "needs-evidence") {
    const needed = MIN_QUOTES - stat.quotePairs;
    return (
      <>
        <strong>{label}:</strong> {stat.quotePairs} of {MIN_QUOTES} quotations found
        {" "}&mdash; insert {needed} more piece{needed !== 1 ? "s" : ""} of evidence following the steps below.
      </>
    );
  }
  return (
    <>
      <strong>{label}:</strong> {stat.sentences} sentences, {stat.quotePairs} quotations &mdash; looking good!
    </>
  );
}

export default function BodyEvidenceHelper({ bodyParaStats, devices, thesisSentence }) {
  const stats = bodyParaStats || [];
  const deviceNames = (devices || []).filter(d => d.trim());
  const expectedParas = deviceNames.length || 0;
  const needsMore = expectedParas > 0 && stats.length < expectedParas;
  const [plannerOpen, setPlannerOpen] = useState(false);

  // Determine which evidence number to show in the planner.
  // Find the first body paragraph that still needs evidence.
  let evidenceLabel = "";
  if (stats.length > 0) {
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];
      if (s.quotePairs < MIN_QUOTES) {
        const paraNum = i + 1;
        const evNum = s.quotePairs + 1;
        evidenceLabel = `(BP${paraNum}, evidence ${evNum} of ${MIN_QUOTES})`;
        break;
      }
    }
  }

  return (
    <div className="body-evidence-helper">
      <p className="evidence-helper-intro">
        Each body paragraph should follow these steps <strong>twice</strong> with
        two different pieces of evidence. A developed paragraph has at
        least {MIN_SENTENCES} sentences and {MIN_QUOTES} quotations. Your
        paragraph structure:
      </p>
      <p className="evidence-helper-structure">
        Topic sentence &rarr; <em>steps 1&ndash;5</em> &rarr; <em>steps 1&ndash;5</em> &rarr;
        Final sentence (relate back to thesis)
      </p>

      {!plannerOpen ? (
        <>
          <ol className="evidence-helper-steps">
            <li className="evidence-step">
              <strong>Context</strong>{" "}
              <span>&mdash; Set up the quotation. Who is speaking? What is happening?</span>
            </li>
            <li className="evidence-step">
              <strong>Evidence</strong>{" "}
              <span>&mdash; Integrate a short quotation (five words or fewer) into your own sentence. A shorter quotation is easier to weave in and analyze.</span>
            </li>
            <li className="evidence-step">
              <strong>Explanation</strong>{" "}
              <span>&mdash; Explain the significance of the evidence. What does it reveal? Avoid ending a sentence on a quotation.</span>
            </li>
            <li className="evidence-step">
              <strong>Clarification</strong>{" "}
              <span>&mdash; Deepen your analysis. How does this connect to the author&rsquo;s purpose or the broader meaning of the text?</span>
            </li>
            <li className="evidence-step">
              <strong>Relate</strong>{" "}
              <span>&mdash; Connect the evidence back to your thesis and the device you named in the topic sentence.</span>
            </li>
          </ol>
          <button
            className="evidence-planner-toggle"
            onClick={() => setPlannerOpen(true)}
          >Plan your evidence?</button>
        </>
      ) : (
        <EvidencePlanner
          evidenceNumber={evidenceLabel}
          thesisSentence={thesisSentence}
          onClose={() => setPlannerOpen(false)}
        />
      )}

      {expectedParas > 0 && (
        <p className="evidence-para-expectation">
          Your thesis names <strong>{expectedParas}</strong> technique{expectedParas !== 1 ? "s" : ""}
          {" "}&mdash; you need <strong>{expectedParas}</strong> body paragraph{expectedParas !== 1 ? "s" : ""},
          {" "}one for each:{" "}
          {deviceNames.map((d, i) => (
            <span key={i}>
              {i > 0 && (i === deviceNames.length - 1 ? " and " : ", ")}
              <strong>{d}</strong>
            </span>
          ))}.
        </p>
      )}

      {stats.length > 0 && (
        <ul className="evidence-para-status">
          {stats.map((stat, i) => {
            const deviceLabel = deviceNames[i] ? ` (${deviceNames[i]})` : "";
            return (
              <li key={i} className={`evidence-para-item para-${paraStatus(stat)}`}>
                {paraMessage(stat, i, deviceLabel)}
              </li>
            );
          })}
        </ul>
      )}

      {needsMore && (
        <p className="evidence-next-para-prompt">
          Start your next body paragraph on{" "}
          <strong>{deviceNames[stats.length]}</strong>.
          {" "}Press Enter to create a new paragraph, then write a topic sentence
          that names this technique and connects it to your thesis.
        </p>
      )}

      <p className="evidence-helper-tip">
        Avoid beginning a sentence with a quotation or placing one in the final
        sentence of a body paragraph.
      </p>
    </div>
  );
}