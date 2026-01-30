export function normalizeText(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCandidateBlocks(containerEl) {
  if (!containerEl) return [];
  const nodes = Array.from(containerEl.querySelectorAll("p, li"));
  const withText = nodes
    .map((node) => ({
      node,
      text: normalizeText(node.innerText || node.textContent || "")
    }))
    .filter((entry) => entry.text);

  const longEnough = withText.filter((entry) => entry.text.length >= 20);
  return (longEnough.length ? longEnough : withText).map((entry) => entry.node);
}

const getSentenceTokens = (sentence) =>
  normalizeText(sentence)
    .split(" ")
    .filter((token) => token.length >= 4);

export function findBestMatchBlock(containerEl, sentence) {
  if (!containerEl || !sentence) return null;
  const needle = normalizeText(sentence).slice(0, 80);
  const candidates = getCandidateBlocks(containerEl);
  if (!candidates.length || !needle) return null;

  for (const el of candidates) {
    const text = normalizeText(el.innerText || el.textContent || "");
    if (text.includes(needle)) {
      return { el, score: 1 };
    }
  }

  const tokens = Array.from(new Set(getSentenceTokens(sentence)));
  if (!tokens.length) return null;

  let best = { el: null, score: 0 };
  candidates.forEach((el) => {
    const text = normalizeText(el.innerText || el.textContent || "");
    if (!text) return;
    const overlap = tokens.reduce((count, token) => {
      return text.includes(token) ? count + 1 : count;
    }, 0);
    const score = overlap / tokens.length;
    if (score > best.score) {
      best = { el, score };
    }
  });

  if (!best.el || best.score < 0.25) return null;
  return best;
}

export function scrollAndFlash(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ph-flash");
  window.setTimeout(() => {
    el.classList.remove("ph-flash");
  }, 1400);
}

export function clearHighlights(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll(".ph-highlight").forEach((node) => {
    node.classList.remove("ph-highlight");
  });
}

export function highlightAllMatches(containerEl, examples) {
  if (!containerEl) return 0;
  clearHighlights(containerEl);
  const sentences = Array.isArray(examples)
    ? examples.map((ex) => ex?.sentence).filter(Boolean)
    : [];
  const seen = new Set();
  let count = 0;
  sentences.forEach((sentence) => {
    const match = findBestMatchBlock(containerEl, sentence);
    if (!match?.el) return;
    const key = match.el;
    if (seen.has(key)) return;
    seen.add(key);
    match.el.classList.add("ph-highlight");
    count += 1;
  });
  return count;
}
