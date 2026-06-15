/**
 * Interactive helper shown at Step 4 (Topic Sentences).
 *
 * Shows the thesis device order so the student knows which device to write
 * about next. Suggests boundary-statement words extracted from the thesis
 * sentence to help the student create a smooth transition from the
 * introduction into the body.
 */
export default function TopicSentenceHelper({
  devices = [],
  boundaryWords = [],
  thesisSentence = "",
}) {
  const filled = devices.filter((d) => d.trim());

  if (filled.length === 0) return null;

  return (
    <div className="topic-sentence-helper">
      <p className="topic-helper-intro">
        Write a <strong>boundary statement</strong> after your introduction to
        transition into the body. A boundary statement echoes a key word from
        the end of your introduction in the opening of your next paragraph.
      </p>

      {boundaryWords.length > 0 && (
        <div className="topic-boundary-suggestions">
          <p className="topic-boundary-label">
            Key terms from your thesis you can echo:
          </p>
          <div className="topic-boundary-chips">
            {boundaryWords.map((w, i) => (
              <span key={i} className="topic-boundary-chip">{w}</span>
            ))}
          </div>
          <p className="topic-boundary-hint">
            Repeat one of these words (or a synonym) near the start of your
            first body paragraph to create a seamless transition.
          </p>
        </div>
      )}

      <p className="topic-helper-order-label">
        Your body paragraphs should follow the order of your thesis:
      </p>
      <ol className="topic-helper-list">
        {filled.map((device, idx) => (
          <li key={idx} className="topic-helper-item">
            <span className="topic-helper-badge">Body {idx + 1}</span>
            <strong>{device}</strong>
            <span className="topic-helper-instruction">
              {idx === 0
                ? " \u2014 Start here. Name this device in your topic sentence and connect it to your thesis."
                : " \u2014 Name this device and connect it to your thesis."}
            </span>
          </li>
        ))}
      </ol>
      <p className="topic-helper-tip">
        Each topic sentence should clearly state which device or strategy you
        are analyzing in that paragraph. Use the same order as your thesis.
      </p>
    </div>
  );
}