/**
 * Shared repetition highlighting logic.
 * Extracted from App.jsx so both student and teacher modes can reuse it.
 */

/**
 * Check if a text node is inside a Vysti label (should be skipped).
 */
function isInsideVystiLabel(textNode, blockEl) {
  const t = (textNode.textContent || "").trim();
  if (t.startsWith("\u2192")) return true;
  let el = textNode.parentElement;
  while (el && el !== blockEl) {
    if (el.tagName === "SPAN") {
      const spanText = (el.textContent || "").trim();
      if (spanText.startsWith("\u2192")) return true;
      const style = el.getAttribute("style") || "";
      if (style.includes("background") && style.includes("yellow")) return true;
      if (style.includes("background-color")) {
        const bgMatch = style.match(/background-color:\s*([^;]+)/);
        if (bgMatch && (bgMatch[1].includes("yellow") || bgMatch[1].includes("rgb(255, 255,") || bgMatch[1].includes("#ffff"))) {
          return true;
        }
      }
    }
    const cl = el.classList;
    if (cl && (cl.contains("vysti-label") || cl.contains("vysti-inline-label") || cl.contains("vysti-clickable-label"))) {
      return true;
    }
    if (el.hasAttribute && el.hasAttribute("data-vysti")) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Build quote ranges from block text (double-quote positions).
 */
function getQuoteRanges(text) {
  const ranges = [];
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
      if (!inQuote) { inQuote = true; start = i; }
      else { ranges.push([start, i]); inQuote = false; }
    }
  }
  return ranges;
}

function isInsideQuotes(charIdx, ranges) {
  for (const [s, e] of ranges) {
    if (charIdx >= s && charIdx <= e) return true;
  }
  return false;
}

/**
 * Highlight repeated nouns in a preview container.
 * @param {HTMLElement} container - The preview DOM container
 * @param {Array} repeatedNouns - [{lemma, count, forms, activeCount}, ...]
 * @param {Object} [options]
 * @param {Map} [options.thesisDevicesLexicon] - If provided, skip thesis device terms
 * @returns {{ total: number, hits: Array }}
 */
export function applyRepetitionHighlights(container, repeatedNouns, options = {}) {
  const { thesisDevicesLexicon = null } = options;

  if (!repeatedNouns?.length) return { total: 0, hits: [] };

  // Build a set of ALL forms and a form→lemma lookup
  const formToLemma = new Map();
  for (const n of repeatedNouns) {
    const lemma = n.lemma.toLowerCase();
    formToLemma.set(lemma, lemma);
    if (n.forms) {
      for (const f of n.forms) formToLemma.set(f.toLowerCase(), lemma);
    }
  }
  const formSet = new Set(formToLemma.keys());
  const blocks = Array.from(container.querySelectorAll("p, li"));
  const matches = [];

  // Thesis detection: skip nouns in the last sentence of the intro paragraph
  const isCentered = (block) => {
    const style = window.getComputedStyle(block);
    return style.textAlign === "center" || style.textAlign === "-webkit-center";
  };
  const nonCenteredBlocks = blocks.filter(b => !isCentered(b) && (b.textContent || "").trim().length > 0);
  let thesisBlock = null;
  let thesisStartPos = 0;
  let thesisEndPos = 0;
  if (nonCenteredBlocks.length >= 3) {
    const introBlock = nonCenteredBlocks[0];
    const introText = introBlock.textContent || "";
    const lastPunctPos = Math.max(introText.lastIndexOf('.'), introText.lastIndexOf('?'), introText.lastIndexOf('!'));
    if (lastPunctPos > 0) {
      const beforeLast = introText.substring(0, lastPunctPos);
      const secondLastPunctPos = Math.max(beforeLast.lastIndexOf('.'), beforeLast.lastIndexOf('?'), beforeLast.lastIndexOf('!'));
      thesisBlock = introBlock;
      thesisStartPos = secondLastPunctPos >= 0 ? secondLastPunctPos + 1 : 0;
      thesisEndPos = introText.length;
    }
  }

  for (const block of blocks) {
    const blockText = block.textContent || "";
    const quoteRanges = getQuoteRanges(blockText);

    // Build char-offset map
    const nodeOffsets = new Map();
    let charOffset = 0;
    const offsetWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let oNode;
    while ((oNode = offsetWalker.nextNode())) {
      nodeOffsets.set(oNode, charOffset);
      charOffset += (oNode.textContent || "").length;
    }

    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (isInsideVystiLabel(node, block)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let textNode;
    while ((textNode = walker.nextNode())) {
      const text = textNode.textContent || "";
      const nodeStart = nodeOffsets.get(textNode) || 0;
      const wordRe = /\b([a-zA-Z]+)\b/g;
      let m;
      while ((m = wordRe.exec(text))) {
        const word = m[1].toLowerCase();
        if (!formSet.has(word)) continue;

        // Skip capitalized words (proper nouns)
        if (m[1][0] && m[1][0] !== m[1][0].toLowerCase()) continue;

        // Skip thesis device terms
        if (thesisDevicesLexicon && thesisDevicesLexicon.has(word)) continue;

        // Skip words inside double quotes
        const absCharIdx = nodeStart + m.index;
        if (quoteRanges.length && isInsideQuotes(absCharIdx, quoteRanges)) continue;

        // Skip words inside the assumed thesis (last sentence of intro paragraph)
        if (thesisBlock && block === thesisBlock && absCharIdx >= thesisStartPos && absCharIdx < thesisEndPos) continue;

        matches.push({
          node: textNode,
          start: m.index,
          end: m.index + m[1].length,
          lemma: formToLemma.get(word) || word,
          blockEl: block
        });
      }
    }
  }

  // Filter out lemmas with fewer than 3 visible matches — twice is not problematic
  const lemmaCounts = new Map();
  for (const m of matches) {
    lemmaCounts.set(m.lemma, (lemmaCounts.get(m.lemma) || 0) + 1);
  }
  const filteredMatches = matches.filter(m => (lemmaCounts.get(m.lemma) || 0) >= 3);

  // Wrap matches
  const byNode = new Map();
  for (const m of filteredMatches) {
    if (!byNode.has(m.node)) byNode.set(m.node, []);
    byNode.get(m.node).push(m);
  }

  const hits = [];
  for (const [node, nodeMatches] of byNode) {
    nodeMatches.sort((a, b) => b.start - a.start);
    let curNode = node;
    for (const m of nodeMatches) {
      try {
        const curText = curNode.textContent || "";
        if (m.start >= curText.length) continue;
        const actualEnd = Math.min(m.end, curText.length);
        if (actualEnd < curText.length) curNode.splitText(actualEnd);
        const targetNode = m.start > 0 ? curNode.splitText(m.start) : curNode;

        const span = document.createElement("span");
        span.className = "vysti-noun-repetition-hit";
        targetNode.parentNode.insertBefore(span, targetNode);
        span.appendChild(targetNode);
        hits.push({ span, lemma: m.lemma, blockEl: m.blockEl });
      } catch (e) {
        // Skip if DOM manipulation fails
      }
    }
  }

  return { total: hits.length, hits };
}

/**
 * Remove all repetition highlight spans from a container.
 * @param {HTMLElement} container
 */
export function clearRepetitionHighlights(container) {
  container.querySelectorAll(".vysti-noun-repetition-hit").forEach((span) => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    }
  });
}
