/**
 * Interactive helper shown at Step 6 (Conclusion & Title).
 *
 * Guides the student through writing a conclusion and formatting
 * their essay title using the "Quotation": Topic in Title pattern.
 * If the student has written body paragraphs, picks one of their own
 * short quotations and a detected thesis device to personalize the
 * example.
 */

/** Capitalize every major word in a phrase, MLA-style. */
function titleCase(str) {
  const minor = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "yet", "so",
    "in", "on", "at", "to", "of", "by", "as", "is", "if",
  ]);
  return str
    .split(/\s+/)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && minor.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Pull the shortest in-text quotation (in straight or curly quotes) from
 * the student's essay body that isn't the work's title.
 */
function findShortQuotation(essayText, textTitle) {
  if (!essayText) return null;
  const title = (textTitle || "").trim().toLowerCase();
  // Match anything inside "..." or " ... " (straight or smart quotes)
  const re = /["“”]([^"“”\n]+)["“”]/g;
  let m;
  const candidates = [];
  while ((m = re.exec(essayText)) !== null) {
    // Strip trailing punctuation (commas, periods, etc.) that often sit
    // inside the closing quote per English convention.
    const inner = m[1].trim().replace(/[.,;:!?]+$/, "").trim();
    if (!inner) continue;
    if (title && inner.toLowerCase() === title) continue; // skip the work's title
    const wordCount = inner.split(/\s+/).length;
    if (wordCount > 6) continue; // short quotations only
    candidates.push({ text: inner, len: wordCount });
  }
  if (candidates.length === 0) return null;
  // Prefer 2-4 word quotations, otherwise shortest
  candidates.sort((a, b) => {
    const aSweet = a.len >= 2 && a.len <= 4 ? 0 : 1;
    const bSweet = b.len >= 2 && b.len <= 4 ? 0 : 1;
    if (aSweet !== bSweet) return aSweet - bSweet;
    return a.len - b.len;
  });
  return candidates[0].text;
}

export default function ConclusionHelper({ textTitle, textIsMinor, essayText, devices }) {
  const title = textTitle?.trim() || "";
  const quote = findShortQuotation(essayText, title);
  const device = (devices || []).find(Boolean) || null;

  // Build the personalized example if we have something to show
  let exampleNode = null;
  if (title) {
    const quoteText = quote || "A Short Quote";
    const topic = device ? titleCase(device) : "Analysis";
    const titleEl = textIsMinor
      ? <>&ldquo;{title}&rdquo;</>
      : <em>{title}</em>;
    exampleNode = (
      <p className="conclusion-title-preview">
        <strong>Example:</strong>{" "}
        &ldquo;{titleCase(quoteText)}&rdquo;: {topic} in {titleEl}
      </p>
    );
  }

  return (
    <div className="conclusion-helper">
      <div className="conclusion-helper-section">
        <p className="conclusion-helper-heading">Conclusion</p>
        <p className="conclusion-helper-text">
          Summarize your analysis without introducing new evidence or
          quotations. Restate how the devices work together to achieve the
          author&rsquo;s purpose.
        </p>
      </div>

      <div className="conclusion-helper-section">
        <p className="conclusion-helper-heading">Essay Title</p>
        <p className="conclusion-helper-text">
          Use a short quotation from the text, followed by a colon, then a
          phrase that captures the topic of your essay.
        </p>
        <div className="conclusion-title-example">
          <p className="conclusion-title-pattern">
            <strong>Pattern:</strong>{" "}
            &ldquo;Quotation&rdquo;: Topic in Title
          </p>
          {exampleNode}
        </div>
        <p className="conclusion-helper-tip">
          Capitalize every major word in your title. Do not underline, bold,
          or enlarge it.
        </p>
      </div>
    </div>
  );
}