import { clearHighlights, findBestMatchBlock, getCandidateBlocks } from "./previewNavigator";

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
  const allBlocks = Array.from(containerEl.querySelectorAll("p, li"));
  const blocks = allBlocks.length ? allBlocks : getCandidateBlocks(containerEl);
  const idx = Number.isFinite(example?.paragraph_index) ? example.paragraph_index : null;
  if (idx !== null && blocks.length) {
    if (blocks[idx]) return blocks[idx];
    if (idx > 0 && blocks[idx - 1]) return blocks[idx - 1];
  }
  const match = findBestMatchBlock(containerEl, example?.sentence || "");
  return match?.el || null;
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

  let selectedLabelEl = arrowCandidates[0];
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
