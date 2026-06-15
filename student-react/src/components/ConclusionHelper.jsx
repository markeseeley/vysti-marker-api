/**
 * Interactive helper shown at Step 6 (Conclusion & Title).
 *
 * Guides the student through writing a conclusion and formatting
 * their essay title using the "Quotation": Topic in Title pattern.
 */
export default function ConclusionHelper({ textTitle }) {
  const title = textTitle?.trim() || "";

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
          {title && (
            <p className="conclusion-title-preview">
              <strong>Example:</strong>{" "}
              &ldquo;A Short Quote&rdquo;: Analysis of{" "}
              <em>{title}</em>
            </p>
          )}
        </div>
        <p className="conclusion-helper-tip">
          Capitalize every major word in your title. Do not underline, bold,
          or enlarge it.
        </p>
      </div>
    </div>
  );
}