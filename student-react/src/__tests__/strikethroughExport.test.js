import { describe, it, expect, beforeEach } from "vitest";
import { applyRedStrikethrough } from "../components/PreviewToolbar";
import { extractTextWithTeacherAnnotations } from "../lib/previewText";

/**
 * Regression test for the bug where striking multiple whole paragraphs (e.g. the
 * bottom half of an essay flagged as AI-written) caused that text to be DELETED
 * from the downloaded .docx instead of exported as red strikethrough.
 *
 * Root cause was in applyRedStrikethrough's catch fallback: a cross-paragraph
 * selection was wrapped via range.extractContents() into a single inline <span>,
 * which either collapsed the paragraphs or (when the selection started at a
 * paragraph boundary) left the content in a container-level <span> that the
 * serializer — which only harvests p/li/leaf-div text — dropped entirely.
 */
describe("multi-paragraph strikethrough export", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML =
      "<p>First paragraph stays intact.</p>" +
      "<p>Second paragraph is AI generated.</p>" +
      "<p>Third paragraph is also AI generated.</p>";
    document.body.appendChild(container);
  });

  function selectAcrossParagraphs(startP, endP) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    // Start at the very beginning of startP's text, end at the end of endP's text
    range.setStart(startP.firstChild, 0);
    range.setEnd(endP.firstChild, endP.firstChild.data.length);
    sel.addRange(range);
    return range;
  }

  it("preserves all struck text as {x:...} markers when whole paragraphs are struck", () => {
    const paras = container.querySelectorAll("p");
    selectAcrossParagraphs(paras[1], paras[2]);

    applyRedStrikethrough(container, () => {});

    const out = extractTextWithTeacherAnnotations(container);

    // The first paragraph is untouched
    expect(out).toContain("First paragraph stays intact.");
    // Neither struck paragraph is lost
    expect(out).toContain("Second paragraph is AI generated.");
    expect(out).toContain("Third paragraph is also AI generated.");
    // Both struck paragraphs are marked as strikethrough
    expect(out).toContain("{x:Second paragraph is AI generated.}");
    expect(out).toContain("{x:Third paragraph is also AI generated.}");
    // Paragraph structure between the two struck paragraphs is preserved
    expect(out).toContain("\n\n");
  });

  it("still strikes a partial selection within a single paragraph", () => {
    const paras = container.querySelectorAll("p");
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    // "Second paragraph is AI generated." → strike "AI generated"
    const textNode = paras[1].firstChild;
    const startIdx = textNode.data.indexOf("AI generated");
    range.setStart(textNode, startIdx);
    range.setEnd(textNode, startIdx + "AI generated".length);
    sel.addRange(range);

    applyRedStrikethrough(container, () => {});

    const out = extractTextWithTeacherAnnotations(container);
    expect(out).toContain("{x:AI generated}");
    expect(out).toContain("Second paragraph is");
  });
});
