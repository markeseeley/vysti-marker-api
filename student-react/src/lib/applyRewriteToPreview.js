import { findBestMatchBlock, scrollAndFlash } from "./previewNavigator";
import { normalizeForCompare } from "./normalize";

const escapeRegExp = (text) => String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildLooseRegex = (sentence) => {
  let pattern = escapeRegExp(sentence);
  pattern = pattern.replace(/\s+/g, "\\s+");
  pattern = pattern.replace(/["“”]/g, '["“”]');
  pattern = pattern.replace(/['’‘]/g, "['’‘]");
  return new RegExp(pattern, "i");
};

const collectTextNodes = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
};

const buildTextIndex = (nodes) => {
  let fullText = "";
  const ranges = nodes.map((node) => {
    const start = fullText.length;
    const value = node.nodeValue || "";
    fullText += value;
    return { node, start, end: fullText.length };
  });
  return { fullText, ranges };
};

const locateRangeFromMatch = (ranges, startIdx, endIdx) => {
  const startInfo = ranges.find((r) => startIdx >= r.start && startIdx <= r.end);
  const endInfo = ranges.find((r) => endIdx >= r.start && endIdx <= r.end);
  if (!startInfo || !endInfo) return null;
  const range = document.createRange();
  range.setStart(startInfo.node, Math.max(0, startIdx - startInfo.start));
  range.setEnd(endInfo.node, Math.max(0, endIdx - endInfo.start));
  return range;
};

export function applyRewriteToPreview({
  containerEl,
  originalSentence,
  rewrite,
  shouldScroll = true
}) {
  if (!containerEl || !originalSentence || !rewrite) {
    return { ok: false, message: "Missing preview or rewrite text." };
  }
  const match = findBestMatchBlock(containerEl, originalSentence);
  if (!match?.el) {
    return { ok: false, message: "Could not find that sentence in the preview." };
  }

  const el = match.el;
  const nodes = collectTextNodes(el);
  const { fullText, ranges } = buildTextIndex(nodes);
  if (!fullText.trim()) {
    return { ok: false, message: "Preview block is empty." };
  }

  const regex = buildLooseRegex(originalSentence);
  const matchResult = regex.exec(fullText);
  if (!matchResult) {
    const normalizedCurrent = normalizeForCompare(fullText);
    const normalizedOriginal = normalizeForCompare(originalSentence);
    if (!normalizedCurrent.includes(normalizedOriginal)) {
      return {
        ok: false,
        message: "Couldn't isolate that sentence. Paste manually if needed."
      };
    }
    return {
      ok: false,
      message: "Could not isolate the sentence boundaries. Paste manually."
    };
  }

  const startIdx = matchResult.index;
  const endIdx = startIdx + matchResult[0].length;
  const range = locateRangeFromMatch(ranges, startIdx, endIdx);
  if (!range) {
    return {
      ok: false,
      message: "Could not isolate the sentence range. Paste manually."
    };
  }

  range.deleteContents();
  const span = document.createElement("span");
  span.className = "vysti-applied-rewrite";
  span.textContent = rewrite;
  range.insertNode(span);

  if (shouldScroll) {
    scrollAndFlash(span);
  }
  return { ok: true };
}
