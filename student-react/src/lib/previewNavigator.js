// Classic-derived preview navigation + highlighting for docx-preview DOM.
// Exports expected by App.jsx: clearHighlights, findBestMatchBlock, highlightAllMatches, scrollAndFlash

import { getLabelMetric, METRICS } from "./labelToMetric";

const REWRITE_TAG_RE = /^\s*\*\s*Rewrite this paragraph for practice\s*\*\s*$/i;

export function unwrapNode(el) {
  const parent = el?.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

export function clearHighlights(containerEl) {
  if (!containerEl) return;

  // unwrap sentence-hit spans (but NOT original marker labels which also have data-vysti-hit="1")
  const hitSpans = containerEl.querySelectorAll("span.vysti-preview-hit[data-vysti-hit='1']:not([data-vysti-original])");
  if (hitSpans?.length) {
    hitSpans.forEach(unwrapNode);
    try {
      containerEl.normalize();
    } catch (_) {}
  }

  // remove dynamically-added block classes, but preserve original marker labels
  const blocks = containerEl.querySelectorAll(
    ".vysti-preview-hit, .vysti-preview-hit-block, .vysti-preview-tech-block, .vysti-preview-variety-block"
  );
  blocks.forEach((el) => {
    // Original marker labels have data-vysti-original — keep .vysti-preview-hit on those
    const isOriginalLabel = el.hasAttribute("data-vysti-original");
    if (!isOriginalLabel) {
      el.classList.remove("vysti-preview-hit");
      el.removeAttribute("data-vysti-meter");
    }
    el.classList.remove(
      "vysti-preview-hit-block",
      "vysti-preview-tech-block",
      "vysti-preview-variety-block"
    );
  });

  // Remove focus mode (dimmed text) and active-label tags
  containerEl.classList.remove("vysti-highlight-focus-mode");
  containerEl.querySelectorAll(".vysti-focus-active-label").forEach((el) =>
    el.classList.remove("vysti-focus-active-label")
  );
}

export function enableFocusMode(containerEl, opts = {}) {
  if (!containerEl) return;
  containerEl.classList.add("vysti-highlight-focus-mode");

  // If a match result is provided, find and tag the associated original label
  const { match } = opts;
  if (!match) return;

  // Normalize a label for comparison (handle quote encoding differences)
  const normalizeLabel = (s) =>
    (s || "")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  // Get the label from the highlighted hit spans, the match element, or an
  // explicit label passed via opts (most reliable — comes straight from the
  // issue object, bypassing any DOM-attribute mismatches).
  const rawLabel = match.hits?.[0]?.getAttribute("data-vysti-label")
    || match.el?.getAttribute("data-vysti-label")
    || opts.label
    || "";
  if (!rawLabel) return;
  const label = normalizeLabel(rawLabel);

  // Arrow labels are placed INLINE — right after the flagged word, WITHIN the
  // sentence.  When wrapTextNodeSubstring wraps the whole sentence, the last
  // hit span can end up AFTER the inline arrow label.  So we use BOTH the
  // first and last hit spans to find a label that sits inside the sentence
  // range (between first hit and last hit) — that's always the correct one.
  const hits = match.hits || [];
  const firstHit = hits[0] || match.el;
  const lastHit = hits[hits.length - 1] || match.el;
  if (!firstHit) return;

  const originals = containerEl.querySelectorAll(
    "span.vysti-preview-hit[data-vysti-original][data-vysti-label]"
  );

  // Best: a label that is BETWEEN the first and last hit (inline in the sentence)
  let inlineBest = null;
  // Fallback: first following the last hit
  let closestFollowing = null;
  // Last resort: last preceding the first hit
  let closestPreceding = null;

  for (const orig of originals) {
    if (normalizeLabel(orig.getAttribute("data-vysti-label")) !== label) continue;

    const posVsFirst = firstHit.compareDocumentPosition(orig);
    const posVsLast = lastHit.compareDocumentPosition(orig);

    // Label is after the first hit AND before (or equal to) the last hit → inline
    const afterFirst = posVsFirst & Node.DOCUMENT_POSITION_FOLLOWING;
    const beforeLast = posVsLast & Node.DOCUMENT_POSITION_PRECEDING;

    if (afterFirst && beforeLast) {
      // First inline match is best
      if (!inlineBest) inlineBest = orig;
    } else if (posVsLast & Node.DOCUMENT_POSITION_FOLLOWING) {
      if (!closestFollowing) closestFollowing = orig;
    } else if (posVsFirst & Node.DOCUMENT_POSITION_PRECEDING) {
      closestPreceding = orig;
    }
  }

  const best = inlineBest || closestFollowing || closestPreceding;
  if (best) best.classList.add("vysti-focus-active-label");
}

export function clearDeviceHighlights(containerEl) {
  if (!containerEl) return;
  const deviceSpans = containerEl.querySelectorAll("span.vysti-device-hit[data-vysti-device='1']");
  if (!deviceSpans?.length) return;
  deviceSpans.forEach(unwrapNode);
  try {
    containerEl.normalize();
  } catch (_) {}
}

function normalizeCharForMatch(ch) {
  if (ch === "\u201C" || ch === "\u201D" || ch === "\u201E" || ch === "\u201F") return '"';
  if (ch === "\u2018" || ch === "\u2019" || ch === "\u201A" || ch === "\u201B") return "'";
  if (ch === "\u2013" || ch === "\u2014") return "-";
  if (ch === "\u00A0") return " ";
  if (ch === "\u00AD" || (ch >= "\u200B" && ch <= "\u200D") || ch === "\uFEFF") return "";
  if (/\s/.test(ch)) return " ";
  return ch;
}

function normalizeForMatch(text) {
  let out = "";
  let lastWasSpace = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = normalizeCharForMatch(s[i]);
    if (ch === "") continue;
    if (ch === " ") {
      if (!out.length || lastWasSpace) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    out += ch;
  }
  return out.trim();
}

function isVystiLabelTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;

  const text = (node.textContent || "").trim();
  if (text.startsWith("→")) return true;

  let current = node.parentElement;
  while (current && current.tagName !== "SPAN") current = current.parentElement;
  if (current?.tagName === "SPAN") {
    // Continuation spans of arrow labels are tagged by tagYellowLabels
    if (current.classList.contains("vysti-arrow-label")) return true;
    const spanText = (current.textContent || "").trim();
    if (spanText.startsWith("→")) return true;
  }
  return false;
}

function isVystiArtifactTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  if (isVystiLabelTextNode(node)) return true;

  const text = (node.textContent || "").trim();
  if (REWRITE_TAG_RE.test(text)) return true;

  // Skip text inside teacher annotation indicators (sup ✎, sp, ???, ☺, etc.)
  // and teacher-only elements so they don't leak into recheck text.
  const parent = node.parentElement;
  if (parent) {
    if (parent.hasAttribute("data-vysti-teacher-highlight") &&
        (parent.tagName === "SUP" || parent.hasAttribute("data-vysti-comment-indicator"))) {
      return true;
    }
    if (parent.hasAttribute("data-vysti-comment-indicator")) return true;
    if (parent.hasAttribute("data-vysti-positive-indicator") ||
        parent.hasAttribute("data-vysti-star-indicator") ||
        parent.hasAttribute("data-vysti-unhappy-indicator")) {
      return true;
    }
  }

  let current = parent;
  while (current && current.tagName !== "SPAN") current = current.parentElement;
  if (current?.tagName === "SPAN") {
    const spanText = (current.textContent || "").trim();
    if (REWRITE_TAG_RE.test(spanText)) return true;
  }
  return false;
}

export function stripVystiInlineArtifacts(text) {
  let s = String(text || "");
  s = s.replace(/\*\s*Rewrite this paragraph for practice\s*\*/gi, " ");
  s = s.replace(/\s*→\s*[^.!?\n]{0,180}/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function extractCleanTextFromElement(el, opts = {}) {
  if (!el) return "";
  const preserveLineBreaks = !!opts.preserveLineBreaks;

  const whatToShow = preserveLineBreaks
    ? NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    : NodeFilter.SHOW_TEXT;

  const walker = document.createTreeWalker(el, whatToShow, null);
  const parts = [];
  let node;

  while ((node = walker.nextNode())) {
    if (preserveLineBreaks && node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === "BR") {
        const last = parts.length ? String(parts[parts.length - 1] || "") : "";
        if (!last.endsWith("\n")) parts.push("\n");
      }
      continue;
    }

    if (node.nodeType !== Node.TEXT_NODE) continue;
    if (isVystiArtifactTextNode(node)) continue;

    // IMPORTANT: keep whitespace-only nodes (docx-preview stores spaces as separate text nodes)
    parts.push(node.textContent || "");
  }

  let combined = parts.join("").replace(/\u00A0/g, " ");
  if (preserveLineBreaks) {
    combined = combined.replace(/[ \t]+\n/g, "\n");
    combined = combined.replace(/\n[ \t]+/g, "\n");
    combined = combined.replace(/[ \t]{2,}/g, " ");
    combined = combined.replace(/\n{3,}/g, "\n\n");
    return combined.trim();
  }

  return combined.replace(/\s+/g, " ").trim();
}

function getPreviewBlocks(containerEl) {
  if (!containerEl) return [];
  let blocks = Array.from(containerEl.querySelectorAll(".docx p, .docx li, p, li"));
  blocks = blocks.filter((b) => (b.innerText || "").trim().length > 0);

  if (blocks.length === 0) {
    blocks = Array.from(containerEl.querySelectorAll("p, li, div"));
    blocks = blocks.filter((b) => (b.innerText || "").trim().length > 0);
  }
  return blocks;
}

function scoreBlockMatch(sentence, blockText) {
  const normSentence = normalizeForMatch(sentence);
  const normBlock = normalizeForMatch(blockText);

  if (!normSentence || !normBlock) return 0.0;
  if (normBlock.includes(normSentence)) return 1.0;

  const tokenize = (minLen) =>
    normSentence
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= minLen);

  let tokens = tokenize(4);
  if (tokens.length === 0) tokens = tokenize(3);
  if (tokens.length === 0) tokens = tokenize(2);
  if (tokens.length === 0) return 0.0;

  const blockLower = normBlock.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (blockLower.includes(token.toLowerCase())) hits++;
  }
  return hits / tokens.length;
}

function buildNormalizedTextMap(rootEl) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  const posMap = [];
  let normText = "";
  let lastWasSpace = false;

  let node;
  while ((node = walker.nextNode())) {
    if (isVystiLabelTextNode(node)) continue;

    const t = node.textContent || "";
    for (let i = 0; i < t.length; i++) {
      let ch = normalizeCharForMatch(t[i]);
      if (ch === "") continue;

      if (ch === " ") {
        if (normText.length === 0 || lastWasSpace) continue;
        lastWasSpace = true;
      } else {
        lastWasSpace = false;
      }

      normText += ch;
      posMap.push({ node, offset: i });
    }
  }
  return { normText, posMap };
}

function wrapTextNodeSubstring(node, startOffset, endOffsetInclusive, label = null) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  const endExclusive = endOffsetInclusive + 1;

  if (endExclusive < text.length) node.splitText(endExclusive);
  let targetNode = node;
  if (startOffset > 0) targetNode = node.splitText(startOffset);

  const span = document.createElement("span");
  span.className = "vysti-preview-hit";
  span.setAttribute("data-vysti-hit", "1");

  // Store label for tooltips and interaction
  if (label) {
    // Clean up label for display: normalize quotes to match tagYellowLabels
    const cleanLabel = label
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    span.setAttribute("data-vysti-label", cleanLabel);
    const metricId = getLabelMetric(cleanLabel);
    span.setAttribute("data-vysti-meter", (METRICS[metricId] || METRICS.other).name.toUpperCase());
    span.style.cursor = "pointer";
  }

  const parent = targetNode.parentNode;
  if (parent) {
    parent.insertBefore(span, targetNode);
    span.appendChild(targetNode);
  }
  return span;
}

function wrapDeviceTextNodeSubstring(node, startOffset, endOffsetInclusive) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || "";
  const endExclusive = endOffsetInclusive + 1;

  if (endExclusive < text.length) node.splitText(endExclusive);
  let targetNode = node;
  if (startOffset > 0) targetNode = node.splitText(startOffset);

  const span = document.createElement("span");
  span.className = "vysti-device-hit";
  span.setAttribute("data-vysti-device", "1");

  const parent = targetNode.parentNode;
  if (parent) {
    parent.insertBefore(span, targetNode);
    span.appendChild(targetNode);
  }
  return span;
}

function wrapMappedRangeMulti(posMap, startIdx, endIdx, label = null) {
  if (startIdx < 0 || endIdx < startIdx || endIdx >= posMap.length) return null;

  const segments = [];
  let current = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const pos = posMap[i];
    if (!pos?.node) continue;

    if (!current || current.node !== pos.node) {
      if (current) segments.push(current);
      current = { node: pos.node, startOffset: pos.offset, endOffset: pos.offset };
    } else {
      current.endOffset = pos.offset;
    }
  }
  if (current) segments.push(current);
  if (!segments.length) return null;

  const nodeToSegs = new Map();
  for (const seg of segments) {
    if (!nodeToSegs.has(seg.node)) nodeToSegs.set(seg.node, []);
    nodeToSegs.get(seg.node).push(seg);
  }

  const created = [];
  for (const [, segs] of nodeToSegs) {
    segs.sort((a, b) => b.endOffset - a.endOffset);
    for (const seg of segs) {
      const span = wrapTextNodeSubstring(seg.node, seg.startOffset, seg.endOffset, label);
      if (span) created.push(span);
    }
  }

  created.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return created.length ? created : null;
}

function wrapMappedRangeMultiDevice(posMap, startIdx, endIdx) {
  if (startIdx < 0 || endIdx < startIdx || endIdx >= posMap.length) return null;

  const segments = [];
  let current = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const pos = posMap[i];
    if (!pos?.node) continue;

    if (!current || current.node !== pos.node) {
      if (current) segments.push(current);
      current = { node: pos.node, startOffset: pos.offset, endOffset: pos.offset };
    } else {
      current.endOffset = pos.offset;
    }
  }
  if (current) segments.push(current);
  if (!segments.length) return null;

  const nodeToSegs = new Map();
  for (const seg of segments) {
    if (!nodeToSegs.has(seg.node)) nodeToSegs.set(seg.node, []);
    nodeToSegs.get(seg.node).push(seg);
  }

  const created = [];
  for (const [, segs] of nodeToSegs) {
    segs.sort((a, b) => b.endOffset - a.endOffset);
    for (const seg of segs) {
      const span = wrapDeviceTextNodeSubstring(seg.node, seg.startOffset, seg.endOffset);
      if (span) created.push(span);
    }
  }

  created.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return created.length ? created : null;
}

function highlightExactTextInElement(rootEl, targetSentence, label = null) {
  const target = normalizeForMatch(targetSentence);
  if (!target) return null;

  const { normText, posMap } = buildNormalizedTextMap(rootEl);
  const start = normText.indexOf(target);
  if (start === -1) return null;

  const end = start + target.length - 1;
  return wrapMappedRangeMulti(posMap, start, end, label);
}

function buildAnchorCandidates(target) {
  const lens = [80, 60, 45, 35, 25, 18];
  const prefixes = [];
  const suffixes = [];

  for (const L of lens) {
    let p = target.substring(0, Math.min(L, target.length));
    const cut = p.lastIndexOf(" ");
    if (cut > 12) p = p.substring(0, cut);
    if (p.length >= 12 && !prefixes.includes(p)) prefixes.push(p);
  }

  for (const L of lens) {
    let s = target.substring(Math.max(0, target.length - L));
    const cut = s.indexOf(" ");
    if (cut !== -1 && s.length - (cut + 1) >= 12) s = s.substring(cut + 1);
    if (s.length >= 12 && !suffixes.includes(s)) suffixes.push(s);
  }

  return { prefixes, suffixes };
}

function highlightAnchoredSentenceInElement(rootEl, sentence, label = null) {
  const target = normalizeForMatch(sentence);
  if (!target) return null;

  const { normText, posMap } = buildNormalizedTextMap(rootEl);
  const { prefixes, suffixes } = buildAnchorCandidates(target);

  const maxAllowed = Math.max(220, target.length * 3 + 120);

  for (const prefix of prefixes) {
    const start = normText.indexOf(prefix);
    if (start === -1) continue;

    for (const suffix of suffixes) {
      const endStart = normText.indexOf(suffix, start + prefix.length);
      if (endStart === -1) continue;

      const end = endStart + suffix.length - 1;
      const spanLen = end - start + 1;
      if (spanLen <= 0 || spanLen > maxAllowed) continue;

      const spans = wrapMappedRangeMulti(posMap, start, end, label);
      if (spans?.length) return spans;
    }
  }
  return null;
}

export function findBestPreviewBlockForExample(containerEl, example) {
  const blocks = getPreviewBlocks(containerEl);
  if (!blocks.length) return null;

  const sentence = stripVystiInlineArtifacts((example?.sentence || "").trim());
  const paraIndex = example?.paragraph_index;
  // Hard floor: never consider blocks before this index (excludes intro/title/headers)
  const floor = typeof example?.minBlockIndex === "number" ? example.minBlockIndex : 0;

  if (!sentence) {
    if (typeof paraIndex === "number") {
      const idx = Math.max(floor, Math.min(blocks.length - 1, paraIndex));
      return blocks[idx] || blocks[floor] || null;
    }
    return blocks[floor] || blocks[0] || null;
  }

  // When no paragraph_index hint, search globally (but respect floor)
  if (typeof paraIndex !== "number") {
    let globalBest = blocks[floor] || blocks[0];
    let globalBestScore = -1;
    for (let i = floor; i < blocks.length; i++) {
      const score = scoreBlockMatch(
        sentence,
        extractCleanTextFromElement(blocks[i], { preserveLineBreaks: true }) || blocks[i].innerText || ""
      );
      if (score > globalBestScore) {
        globalBestScore = score;
        globalBest = blocks[i];
        if (score === 1.0) break;
      }
    }
    return globalBest;
  }

  // paragraph_index provided — constrain search to a window around it.
  const candidates = [];
  const bases = [paraIndex, paraIndex - 1, paraIndex + 1];

  for (const base of bases) {
    if (typeof base !== "number") continue;
    const backward = 4;
    const forward = base <= 2 ? 12 : 4;
    const start = Math.max(floor, base - backward);
    const end = Math.min(blocks.length - 1, base + forward);

    for (let i = start; i <= end; i++) {
      const score = scoreBlockMatch(
        sentence,
        extractCleanTextFromElement(blocks[i], { preserveLineBreaks: true }) || blocks[i].innerText || ""
      );
      candidates.push({ block: blocks[i], score, index: i });
      if (score === 1.0) return blocks[i];
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestLocal = candidates[0];

  if (bestLocal?.score >= 0.3) return bestLocal.block;

  // Fallback: go to the block at paragraph_index directly (right location, even if text changed)
  const fallbackIdx = Math.max(floor, Math.min(blocks.length - 1, paraIndex));
  return blocks[fallbackIdx] || blocks[floor] || null;
}

export function findBestPreviewBlock(containerEl, example) {
  return findBestPreviewBlockForExample(containerEl, example);
}

export function highlightVarietyBlock(containerEl, example) {
  if (!containerEl) return null;
  clearHighlights(containerEl);
  const ex = typeof example === "string" ? { sentence: example } : example || {};
  const blockEl = findBestPreviewBlockForExample(containerEl, ex);
  if (!blockEl) return null;
  blockEl.classList.add("vysti-preview-variety-block");
  return blockEl;
}

export function highlightTechniquesBlock(containerEl, example) {
  if (!containerEl) return null;
  clearHighlights(containerEl);
  const ex = typeof example === "string" ? { sentence: example } : example || {};
  const blockEl = findBestPreviewBlockForExample(containerEl, ex);
  if (!blockEl) return null;
  blockEl.classList.add("vysti-preview-tech-block");
  return blockEl;
}

function isWordChar(ch) {
  return /[a-z0-9]/i.test(ch || "");
}

function shouldAcceptMatch(text, startIdx, endIdx, term) {
  if (!term) return false;
  const termIsWord = /^[a-z0-9]+$/i.test(term);
  if (!termIsWord) return true;

  const prev = startIdx > 0 ? text[startIdx - 1] : "";
  const next = endIdx + 1 < text.length ? text[endIdx + 1] : "";
  if (prev && isWordChar(prev)) return false;
  if (next && isWordChar(next)) return false;
  return true;
}

export function highlightThesisDevicesInBlock(blockEl, thesisDevicesLexicon) {
  if (!blockEl || !thesisDevicesLexicon || !thesisDevicesLexicon.size) return 0;

  const { normText, posMap } = buildNormalizedTextMap(blockEl);
  if (!normText || !posMap?.length) return 0;

  const normLower = normText.toLowerCase();
  const terms = Array.from(thesisDevicesLexicon.keys())
    .map((term) => normalizeForMatch(term).toLowerCase())
    .filter((term) => term)
    .sort((a, b) => b.length - a.length);

  const ranges = [];
  const overlaps = (start, end) =>
    ranges.some((r) => !(end < r.start || start > r.end));

  for (const term of terms) {
    let idx = normLower.indexOf(term);
    while (idx !== -1) {
      const endIdx = idx + term.length - 1;
      if (shouldAcceptMatch(normLower, idx, endIdx, term) && !overlaps(idx, endIdx)) {
        ranges.push({ start: idx, end: endIdx });
      }
      idx = normLower.indexOf(term, idx + term.length);
    }
  }

  if (!ranges.length) return 0;
  ranges.sort((a, b) => b.start - a.start);

  let wrappedCount = 0;
  for (const range of ranges) {
    const spans = wrapMappedRangeMultiDevice(posMap, range.start, range.end);
    if (spans?.length) wrappedCount += spans.length;
  }
  return wrappedCount;
}

export function findBestMatchBlock(containerEl, sentenceOrExample, opts = {}) {
  if (!containerEl) return null;
  const clearExisting = opts.clearExisting !== false;
  if (clearExisting) clearHighlights(containerEl);

  const example =
    typeof sentenceOrExample === "string" ? { sentence: sentenceOrExample } : sentenceOrExample || {};

  const sentenceRaw = stripVystiInlineArtifacts(example.sentence || "");
  const blockEl = findBestPreviewBlockForExample(containerEl, {
    sentence: sentenceRaw,
    paragraph_index: example.paragraph_index,
    minBlockIndex: example.minBlockIndex
  });

  if (!blockEl) return null;

  const blockScore = sentenceRaw
    ? scoreBlockMatch(
        sentenceRaw,
        extractCleanTextFromElement(blockEl, { preserveLineBreaks: true }) || blockEl.innerText || ""
      )
    : 0;

  // try exact/anchored highlight in best block, then try other strong candidates
  const tryBlocks = [blockEl];

  if (sentenceRaw) {
    let candidateBlocks = getPreviewBlocks(containerEl);

    // Hard floor: never consider blocks before minBlockIndex (excludes intro/title/headers)
    const minBlock = typeof example.minBlockIndex === "number" ? example.minBlockIndex : 0;

    // When paragraph_index is provided, constrain candidates to a window
    // around it — prevents matching distant blocks like intro/title.
    const paraHint = example.paragraph_index;
    if (typeof paraHint === "number") {
      const lo = Math.max(minBlock, paraHint - 4);
      const hi = Math.min(candidateBlocks.length - 1, paraHint + (paraHint <= 2 ? 12 : 4));
      candidateBlocks = candidateBlocks.filter((_, i) => i >= lo && i <= hi);
    } else if (minBlock > 0) {
      // No paragraph hint but minBlockIndex set — exclude everything before it
      candidateBlocks = candidateBlocks.filter((_, i) => i >= minBlock);
    }

    const allBlocks = candidateBlocks
      .map((b) => ({
        b,
        s: scoreBlockMatch(sentenceRaw, extractCleanTextFromElement(b, { preserveLineBreaks: true }) || b.innerText || "")
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.b);

    for (const b of allBlocks) if (!tryBlocks.includes(b)) tryBlocks.push(b);
  }

  if (!sentenceRaw) {
    blockEl.classList.add("vysti-preview-hit-block");
    if (example.label) {
      const mid = getLabelMetric(example.label);
      blockEl.setAttribute("data-vysti-meter", (METRICS[mid] || METRICS.other).name.toUpperCase());
    }
    return { el: blockEl, score: blockScore, hits: [], blockEl, used: "block" };
  }

  const label = example.label || null;
  // Allow callers to specify a meter directly (e.g. "COHESION") when no label exists
  const meterOverride = !label && example.meter ? example.meter : null;

  for (const cand of tryBlocks) {
    let hits = highlightExactTextInElement(cand, sentenceRaw, label);
    let used = "exact";

    if (!hits?.length) {
      hits = highlightAnchoredSentenceInElement(cand, sentenceRaw, label);
      used = "anchor";
    }

    if (hits?.length) {
      // If no label was provided but a meter override exists, apply it to all hit spans
      if (meterOverride) {
        for (const span of hits) span.setAttribute("data-vysti-meter", meterOverride);
      }
      return { el: hits[0], score: blockScore, hits, blockEl: cand, used };
    }
  }

  // fallback: paragraph highlight
  blockEl.classList.add("vysti-preview-hit-block");
  if (label) {
    const mid = getLabelMetric(label);
    blockEl.setAttribute("data-vysti-meter", (METRICS[mid] || METRICS.other).name.toUpperCase());
  } else if (meterOverride) {
    blockEl.setAttribute("data-vysti-meter", meterOverride);
  }
  return { el: blockEl, score: blockScore, hits: [], blockEl, used: "block" };
}

const SLOW_SCROLL_DURATION_MS = 800;

function setScrollTop(el, top) {
  if (!el) return;
  try {
    el.scrollTop = top;
  } catch (_) {}
}

function smoothScrollTo(element, targetTop, duration = 800) {
  const startTop = element === window ? window.scrollY : element.scrollTop;
  const distance = targetTop - startTop;
  let startTime = null;

  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const scroll = (currentTime) => {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeInOutCubic(progress);
    const currentTop = startTop + distance * ease;

    if (element === window) {
      window.scrollTo(0, currentTop);
    } else {
      setScrollTop(element, currentTop);
    }

    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  };

  requestAnimationFrame(scroll);
}

function getPreviewScale(markedPreviewEl) {
  if (!markedPreviewEl) return 1;
  const docxEl =
    markedPreviewEl.querySelector(".docx") ||
    markedPreviewEl.querySelector(".docx-wrapper") ||
    markedPreviewEl.firstElementChild;
  if (!docxEl) return 1;

  const style = window.getComputedStyle(docxEl);
  const zoom = parseFloat(style.zoom);
  if (Number.isFinite(zoom) && zoom > 0) return zoom;

  const transform = style.transform;
  if (transform && transform !== "none") {
    if (transform.startsWith("matrix3d(")) {
      const nums = transform
        .slice(9, -1)
        .split(",")
        .map((n) => Number.parseFloat(n.trim()))
        .filter((n) => Number.isFinite(n));
      if (nums.length >= 6) {
        const scaleX = nums[0];
        const scaleY = nums[5];
        if (Number.isFinite(scaleY) && scaleY > 0) return scaleY;
        if (Number.isFinite(scaleX) && scaleX > 0) return scaleX;
      }
    } else if (transform.startsWith("matrix(")) {
      const nums = transform
        .slice(7, -1)
        .split(",")
        .map((n) => Number.parseFloat(n.trim()))
        .filter((n) => Number.isFinite(n));
      if (nums.length >= 4) {
        const scaleX = nums[0];
        const scaleY = nums[3];
        if (Number.isFinite(scaleY) && scaleY > 0) return scaleY;
        if (Number.isFinite(scaleX) && scaleX > 0) return scaleX;
      }
    }
  }

  return 1;
}

export function scrollPreviewBlockToTop(
  containerEl,
  blockEl,
  { offsetPx = 12, smooth = true } = {}
) {
  if (!containerEl || !blockEl) return;
  if (!containerEl.contains(blockEl)) return;

  let y = 0;
  let el = blockEl;
  while (el && el !== containerEl) {
    y += el.offsetTop || 0;
    el = el.offsetParent;
  }

  const maxTop = Math.max(0, containerEl.scrollHeight - containerEl.clientHeight);
  const desired = Math.max(0, Math.min(y - offsetPx, maxTop));

  if (smooth) {
    try {
      containerEl.scrollTo({ top: desired, behavior: "smooth" });
    } catch (_) {
      setScrollTop(containerEl, desired);
    }
  } else {
    setScrollTop(containerEl, desired);
  }

  const snap = () => setScrollTop(containerEl, desired);
  if (smooth) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(snap);
    }
    window.setTimeout(snap, 80);
  } else {
    snap();
  }
}

export function scrollMarkedPreviewToElement(
  targetEl,
  {
    behavior = "smooth",
    align = "start",
    offsetPx = 12,
    center = null
  } = {}
) {
  if (!targetEl) return;
  if (center === true) align = "center";

  const container = document.getElementById("markedPreview");
  const card = document.getElementById("markedPreviewCard");

  if (card) {
    const rect = card.getBoundingClientRect();
    const outOfView = rect.top < 0 || rect.bottom > window.innerHeight;
    if (outOfView && card.scrollIntoView) {
      card.scrollIntoView({ behavior, block: "start" });
    }
  }

  if (!container) {
    if (targetEl.scrollIntoView) {
      targetEl.scrollIntoView({ behavior, block: "start" });
    }
    return;
  }

  let el = targetEl;
  if (container.contains(el)) {
    const block = el.closest ? el.closest("p, li, div") : null;
    if (block && container.contains(block)) el = block;
  }

  if (!container.contains(el)) {
    if (el.scrollIntoView) el.scrollIntoView({ behavior, block: "start" });
    return;
  }

  const getTargetTop = () => {
    const cRect = container.getBoundingClientRect();
    const tRect = el.getBoundingClientRect();
    const current = container.scrollTop;
    const delta = tRect.top - cRect.top;
    const scale = getPreviewScale(container);
    const deltaUnscaled = scale > 0 ? delta / scale : delta;
    const targetHeight = scale > 0 ? tRect.height / scale : tRect.height;
    let next = current + deltaUnscaled - offsetPx;

    if (align === "center") {
      next = current + deltaUnscaled - container.clientHeight / 2 + targetHeight / 2;
    } else if (align === "end") {
      next = current + deltaUnscaled - container.clientHeight + targetHeight + offsetPx;
    }
    return next;
  };

  const clampTop = (value) => {
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.max(0, Math.min(value, maxTop));
  };

  const nextTop = clampTop(getTargetTop());
  if (behavior === "smooth") {
    smoothScrollTo(container, nextTop, SLOW_SCROLL_DURATION_MS);
  } else {
    try {
      container.scrollTo({ top: nextTop, behavior: "auto" });
    } catch (_) {
      setScrollTop(container, nextTop);
    }
  }

  const snapDelay = behavior === "smooth" ? SLOW_SCROLL_DURATION_MS + 80 : 0;
  window.setTimeout(() => {
    if (!container.contains(el)) return;
    const nextTop2 = clampTop(getTargetTop());
    setScrollTop(container, nextTop2);
  }, snapDelay);

  return {
    desiredScrollTop: nextTop,
    scale: getPreviewScale(container),
    container
  };
}

export function scrollAndFlash(el, opts = {}) {
  if (!el) return;
  const behavior = opts.behavior || "smooth";
  const block = opts.block || "center";

  try {
    el.scrollIntoView({ behavior, block });
  } catch (_) {}

  el.classList.add("vysti-flash-highlight");
  window.setTimeout(() => el.classList.remove("vysti-flash-highlight"), 1200);
}

export function highlightAllMatches(containerEl, examples = []) {
  if (!containerEl) return 0;
  clearHighlights(containerEl);

  const seen = new Set();
  for (const ex of examples) {
    const example = typeof ex === "string" ? { sentence: ex } : ex || {};
    const block = findBestPreviewBlockForExample(containerEl, example);
    if (block && !seen.has(block)) {
      block.classList.add("vysti-preview-variety-block");
      seen.add(block);
    }
  }
  return seen.size;
}
