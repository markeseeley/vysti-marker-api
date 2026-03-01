import {
  clearHighlights,
  findBestMatchBlock,
  scrollAndFlash,
  stripVystiInlineArtifacts
} from "./previewNavigator";

export function applyRewriteToPreview({
  containerEl,
  originalSentence,
  rewrite,
  paragraphIndex,
  shouldScroll = true
}) {
  if (!containerEl) return { ok: false, message: "Preview not ready." };

  const orig = stripVystiInlineArtifacts(String(originalSentence || "")).trim();
  const rw = String(rewrite || "").trim();

  if (!orig) return { ok: false, message: "Missing original sentence." };
  if (!rw) return { ok: false, message: "Missing rewrite text." };

  clearHighlights(containerEl);

  const match = findBestMatchBlock(
    containerEl,
    { sentence: orig, paragraph_index: Number.isFinite(paragraphIndex) ? paragraphIndex : undefined },
    { clearExisting: false }
  );

  if (!match?.hits?.length) {
    if (shouldScroll && match?.el) scrollAndFlash(match.el);
    return {
      ok: false,
      message:
        "Could not apply rewrite to the current Preview text. Try 'Find in preview' and verify the sentence exists."
    };
  }

  const hits = match.hits;
  const first = hits[0];
  const last = hits[hits.length - 1];

  try {
    const range = document.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    range.deleteContents();

    const rewriteSpan = document.createElement("span");
    rewriteSpan.className = "vysti-applied-rewrite";
    rewriteSpan.textContent = rw;

    range.insertNode(rewriteSpan);

    // caret after rewrite
    range.setStartAfter(rewriteSpan);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    try {
      containerEl.normalize();
    } catch (_) {}
    clearHighlights(containerEl);

    if (shouldScroll) scrollAndFlash(rewriteSpan);
    return { ok: true, message: "Applied." };
  } catch (err) {
    return { ok: false, message: "Failed to apply rewrite. Please paste manually." };
  }
}
