import { clearHighlights, findBestMatchBlock } from "./previewNavigator";

const normalizeWhitespace = (text) => (text || "").replace(/\s+/g, " ").trim();

const hasInlineHighlight = (el) => {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.style && (el.style.backgroundColor || el.style.background)) return true;
  return Boolean(el.querySelector("*[style*='background']"));
};

const clearInlineHighlight = (el) => {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
  if (el.style) {
    el.style.backgroundColor = "";
    el.style.background = "";
  }
  el.querySelectorAll("*").forEach((child) => {
    if (child.style) {
      child.style.backgroundColor = "";
      child.style.background = "";
    }
  });
};

const findBlockForExample = (containerEl, example) => {
  const match = findBestMatchBlock(containerEl, {
    sentence: example?.sentence || "",
    paragraph_index: example?.paragraph_index
  });
  return match?.blockEl || match?.el || null;
};

export function removeIssueLabelAndHighlight(
  label,
  example,
  {
    containerEl,
    scroll = true,
    allowParagraphFallback = false,
    silent = false
  } = {}
) {
  if (!containerEl || !containerEl.innerText.trim()) {
    return { ok: false, message: 'Click "Mark my essay" to load the preview first.' };
  }

  const blockEl = findBlockForExample(containerEl, example);
  if (!blockEl) {
    return { ok: false, message: "Couldn't locate the sentence in the preview." };
  }

  const sentenceText = normalizeWhitespace(example?.sentence || "");
  if (!allowParagraphFallback && sentenceText && !normalizeWhitespace(blockEl.innerText).includes(sentenceText.slice(0, 40))) {
    return {
      ok: false,
      message: "Couldn't isolate the exact sentence in preview. Try Find in preview first."
    };
  }

  if (scroll) {
    blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const arrowCandidates = Array.from(blockEl.querySelectorAll("span, a")).filter((el) => {
    const text = normalizeWhitespace(el.textContent);
    return text.startsWith("→") && text.includes(label);
  });

  if (!arrowCandidates.length) {
    return { ok: false, message: "Couldn't find the issue label in the preview." };
  }

  // When the example carries a found_value (e.g. the specific repeated
  // word that triggered the arrow), prefer the arrow whose nearest
  // highlighted preceding element matches that word. This matters when
  // a single paragraph has multiple arrows with the same label (e.g.
  // multiple "→ Avoid unnecessary repetition", one per repeated lemma).
  // Without this, arrowCandidates[0] removes the wrong arrow and the
  // re-applying useEffect cascades into removing all of them.
  let selectedLabelEl = arrowCandidates[0];
  const foundValue = normalizeWhitespace(example?.found_value || "").toLowerCase();
  if (foundValue && arrowCandidates.length > 1) {
    const better = arrowCandidates.find((arrowEl) => {
      let s = arrowEl.previousSibling;
      // Walk back over text-node whitespace to the previous element
      while (s && s.nodeType !== Node.ELEMENT_NODE) s = s.previousSibling;
      if (!s) return false;
      if (!hasInlineHighlight(s)) return false;
      const sib = normalizeWhitespace(s.textContent).toLowerCase();
      return sib === foundValue || sib.includes(foundValue);
    });
    if (better) selectedLabelEl = better;
  }
  const removalTarget =
    selectedLabelEl.parentElement &&
    selectedLabelEl.parentElement.tagName === "SPAN" &&
    normalizeWhitespace(selectedLabelEl.parentElement.textContent) ===
      normalizeWhitespace(selectedLabelEl.textContent)
      ? selectedLabelEl.parentElement
      : selectedLabelEl;

  let sibling = removalTarget.previousSibling;
  while (sibling) {
    if (sibling.nodeType !== Node.ELEMENT_NODE) break;
    const el = sibling;
    if (!hasInlineHighlight(el)) break;
    clearInlineHighlight(el);
    sibling = sibling.previousSibling;
  }

  removalTarget.remove();
  clearHighlights(containerEl);
  containerEl.normalize();

  return {
    ok: true,
    message: silent
      ? ""
      : "Dismissed from preview. (This will stay dismissed after Recheck.)",
    blockEl
  };
}

export function applyDismissalsToPreviewDOM(containerEl, dismissedIssues, fileName) {
  if (!containerEl || !fileName) return;
  const records = (dismissedIssues || []).filter(
    (record) => record?.file_name === fileName
  );
  if (!records.length) return;
  records.forEach((record) => {
    removeIssueLabelAndHighlight(record?.label || "", record, {
      containerEl,
      scroll: false,
      allowParagraphFallback: true,
      silent: true
    });
  });
}
