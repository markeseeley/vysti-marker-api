import { findBestMatchBlock, scrollAndFlash } from "./previewNavigator";
import { normalizeForCompare } from "./normalize";

const replaceOnce = (text, target, replacement) => {
  const idx = text.indexOf(target);
  if (idx === -1) return null;
  return `${text.slice(0, idx)}${replacement}${text.slice(idx + target.length)}`;
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
  const currentText = el.textContent || "";
  let nextText = replaceOnce(currentText, originalSentence, rewrite);

  if (!nextText) {
    const normalizedCurrent = normalizeForCompare(currentText);
    const normalizedOriginal = normalizeForCompare(originalSentence);
    if (normalizedCurrent.includes(normalizedOriginal)) {
      nextText = rewrite;
    }
  }

  if (!nextText) {
    return { ok: false, message: "Could not apply rewrite to the preview text." };
  }

  el.textContent = nextText;
  if (shouldScroll) {
    scrollAndFlash(el);
  }
  return { ok: true };
}
