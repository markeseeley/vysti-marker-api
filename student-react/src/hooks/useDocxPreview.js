import { useEffect, useLayoutEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { insertTab, toggleCenter } from "../components/PreviewToolbar";
import { getLabelMetric, METRICS } from "../lib/labelToMetric";
/**
 * Post-process rendered docx HTML to add dismiss attributes to yellow label spans.
 * The marker engine adds yellow-highlighted " → Label" runs to the Word doc.
 * docx-preview renders these as <span style="background-color:yellow"> but without
 * CSS classes. This function finds those arrow-label spans, extracts the label text,
 * and adds .vysti-preview-hit + data-vysti-label so the dblclick handler can target them.
 */
// Detect conventions labels (spelling, grammar, punctuation, etc.)
const CONVENTIONS_RE = /spelling|comma|apostrophe|subject.verb|capitalize|confused word|title.*format|title.*italic|title.*quotation|write out.*number|qualify|check.*agreement/i;
function isConventionsLabel(label) {
  return CONVENTIONS_RE.test(label || "");
}

const REWRITE_TAG_RE = /^\s*\*\s*Rewrite this paragraph for practice\s*\*\s*$/i;

/**
 * Tag red "Rewrite this paragraph for practice" markers so the dblclick
 * dismiss handler can target them, just like yellow arrow labels.
 */
function tagRewriteLabels(container) {
  const allSpans = container.querySelectorAll("span");
  for (const span of allSpans) {
    const bg = (span.style.backgroundColor || "").toLowerCase();
    const isRed =
      bg === "red" ||
      bg === "#ff0000" ||
      bg.startsWith("rgb(255, 0, 0");
    if (!isRed) continue;

    const text = (span.textContent || "").trim();
    if (!REWRITE_TAG_RE.test(text)) continue;

    span.classList.add("vysti-preview-hit", "vysti-rewrite-tag");
    span.setAttribute("data-vysti-label", "Rewrite this paragraph");
    span.setAttribute("data-vysti-hit", "1");
    span.style.cursor = "pointer";
  }
}

const isYellowBg = (el) => {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const bg = (el.style?.backgroundColor || "").toLowerCase();
  return bg === "yellow" || bg === "#ffff00" || bg.startsWith("rgb(255, 255, 0");
};

function tagYellowLabels(container) {
  // Find all spans with yellow-ish background (docx-preview uses inline styles)
  const allSpans = container.querySelectorAll("span");
  // Track spans already consumed as continuations so we don't re-process them
  const consumed = new Set();

  for (const span of allSpans) {
    if (consumed.has(span)) continue;
    if (!isYellowBg(span)) continue;

    const text = (span.textContent || "").trim();
    // Arrow labels follow the pattern: "→ Label Text"
    const arrowMatch = text.match(/^→\s*(.+)/);
    if (!arrowMatch) continue;

    // The docx-preview library may split a single arrow label across
    // multiple sibling <span>s when the label contains styled words
    // (e.g., "'which'" in a different font run). Collect text from
    // consecutive yellow siblings to reconstruct the full label.
    let fullText = arrowMatch[1];
    const continuationSpans = [];
    let next = span.nextElementSibling;
    while (next) {
      if (!isYellowBg(next)) break;
      const nextText = (next.textContent || "");
      // Stop if this looks like the start of a NEW arrow label
      if (nextText.trim().startsWith("→")) break;
      fullText += nextText;
      continuationSpans.push(next);
      consumed.add(next);
      next = next.nextElementSibling;
    }

    const label = fullText
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;

    // Tag this arrow span (and any continuation spans) so the focus-mode
    // handler can find the original label.
    const metricId = getLabelMetric(label);
    const meterName = (METRICS[metricId] || METRICS.other).name.toUpperCase();
    const isConventions = isConventionsLabel(label);

    const tagSpan = (el) => {
      el.classList.add("vysti-preview-hit", "vysti-arrow-label");
      if (isConventions) el.classList.add("vysti-conventions-hit");
      el.setAttribute("data-vysti-label", label);
      el.setAttribute("data-vysti-meter", meterName);
      el.setAttribute("data-vysti-hit", "1");
      el.setAttribute("data-vysti-original", "1");
      el.style.cursor = "pointer";
      el.style.setProperty("font-weight", "bold", "important");
    };

    tagSpan(span);
    for (const cs of continuationSpans) tagSpan(cs);

    // Also tag preceding yellow-highlighted sibling spans (the highlighted issue text)
    let prev = span.previousElementSibling;
    while (prev) {
      if (!isYellowBg(prev)) break;
      // Don't tag if it's another arrow label
      if ((prev.textContent || "").trim().startsWith("→")) break;
      prev.classList.add("vysti-preview-hit");
      if (isConventions) prev.classList.add("vysti-conventions-hit");
      prev.setAttribute("data-vysti-label", label);
      prev.setAttribute("data-vysti-meter", meterName);
      prev.setAttribute("data-vysti-hit", "1");
      prev.setAttribute("data-vysti-original", "1");
      prev.style.cursor = "pointer";
      prev.style.setProperty("font-weight", "bold", "important");
      prev = prev.previousElementSibling;
    }
  }
}

export function useDocxPreview({ blob, zoom, containerRef, onError, onEdit, onLabelClick, onRendered, savedHtml, isTeacher }) {
  const renderIdRef = useRef(0);
  const editHandlerRef = useRef(null);
  const keydownHandlerRef = useRef(null);
  const labelClickHandlerRef = useRef(null);
  const tooltipFlipHandlerRef = useRef(null);
  const tooltipFlipOutRef = useRef(null);
  const redPenHandlersRef = useRef(null);
  const inlineCommentHandlersRef = useRef(null);
  const onEditRef = useRef(onEdit);
  const onErrorRef = useRef(onError);
  const onLabelClickRef = useRef(onLabelClick);
  const onRenderedRef = useRef(onRendered);
  // Sync ref so saving doesn't trigger a re-render (blob dep stays the same)
  const savedHtmlRef = useRef(savedHtml);
  savedHtmlRef.current = savedHtml;
  useEffect(() => { onRenderedRef.current = onRendered; }, [onRendered]);

  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onLabelClickRef.current = onLabelClick;
  }, [onLabelClick]);

  // Hide container before browser paints so the preview never flashes empty
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container && blob) container.classList.add("preview-fading");
  }, [blob, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    renderIdRef.current += 1;
    const renderId = renderIdRef.current;
    container.innerHTML = "";

    if (!blob) {
      container.classList.remove("preview-fading");
      container.innerHTML =
        "<p class='preview-empty'>Upload and mark an essay to preview it here.</p>";
      return undefined;
    }

    const render = async () => {
      try {
        // ── Restore from saved HTML (teacher Save) or render from .docx blob ──
        if (savedHtmlRef.current) {
          // Saved HTML already has MLA formatting, labels tagged, etc.
          // Sanitize to prevent stored XSS from malicious .docx content
          container.innerHTML = DOMPurify.sanitize(savedHtmlRef.current, {
            ADD_TAGS: ["docx-wrapper", "style"],
            FORCE_BODY: true,
            ADD_ATTR: [
              // Engine yellow labels
              "data-vysti-label", "data-vysti-meter", "data-vysti-hit", "data-vysti-original",
              // Teacher base markers
              "data-vysti-teacher", "data-vysti-teacher-highlight",
              // Comments
              "data-vysti-comment", "data-vysti-comment-anchor", "data-vysti-comment-indicator",
              // Mark types
              "data-vysti-underline", "data-vysti-confusion", "data-vysti-custom-sup",
              "data-vysti-positive-mark", "data-vysti-positive-indicator",
              "data-vysti-star-mark", "data-vysti-star-indicator",
              "data-vysti-unhappy-mark", "data-vysti-unhappy-indicator",
              "data-vysti-insert", "data-vysti-inline-comment",
              "data-vysti-para-mark", "data-vysti-caret",
              "data-vysti-reorder", "data-vysti-reorder-num",
              // Tagged highlights
              "data-vysti-tagged-hl", "data-vysti-tag-color", "data-vysti-tag-label",
              // Misc
              "data-vysti-editing", "style",
            ],
          });

          // Re-add vysti-teacher-mark class on teacher annotations that survived sanitization
          for (const el of container.querySelectorAll('[data-vysti-teacher="1"]')) {
            el.classList.add("vysti-teacher-mark");
          }
        } else {
          const renderAsync = window.docx?.renderAsync || window.docxPreview?.renderAsync;
          if (!renderAsync) {
            const err = new Error("Preview library not loaded");
            if (onErrorRef.current) onErrorRef.current(err);
            return;
          }

          const buf = await blob.arrayBuffer();
          if (renderId !== renderIdRef.current) return;

          await renderAsync(buf, container, null, { inWrapper: true });
          if (renderId !== renderIdRef.current) return;

          // ── MLA auto-format: center title, indent body paragraphs ──
          const allParagraphs = Array.from(container.querySelectorAll("p, li")).filter(
            (p) => (p.textContent || "").trim().length > 0
          );

          const HEADER_WORD_RE = /\b(teacher|class|block|period|assignment|name|date)\b/i;
          const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

          const isCenteredPara = (p) => {
            const s = window.getComputedStyle(p);
            return s.textAlign === "center" || s.textAlign === "-webkit-center";
          };

          const isHeaderPara = (p) => {
            const t = (p.textContent || "").trim();
            const wc = t.split(/\s+/).filter(Boolean).length;
            if (wc > 12) return false;
            if (/[.!?]/.test(t)) return false;
            return /\d/.test(t) || MONTH_RE.test(t) || HEADER_WORD_RE.test(t);
          };

          // Partition paragraphs: centered → skip, headers → skip, title → center, body → indent
          let bodyStartIdx = 0;
          let titleIdx = -1;

          // 1. Skip leading centered paragraphs
          while (bodyStartIdx < allParagraphs.length && isCenteredPara(allParagraphs[bodyStartIdx])) {
            bodyStartIdx++;
          }

          // 2. Skip header blocks (name, date, class, etc.) — max 6
          let headersSkipped = 0;
          while (
            bodyStartIdx < allParagraphs.length &&
            headersSkipped < 6 &&
            isHeaderPara(allParagraphs[bodyStartIdx])
          ) {
            bodyStartIdx++;
            headersSkipped++;
          }

          // 3. Detect title: first remaining paragraph that's short, no sentence-ending punctuation,
          //    followed by a longer paragraph (the intro)
          if (bodyStartIdx < allParagraphs.length - 1) {
            const candidate = allParagraphs[bodyStartIdx];
            const t = (candidate.textContent || "").trim();
            const wc = t.split(/\s+/).filter(Boolean).length;
            const nextT = (allParagraphs[bodyStartIdx + 1].textContent || "").trim();
            const nextWc = nextT.split(/\s+/).filter(Boolean).length;

            if (wc <= 20 && !/[.!?]/.test(t) && nextWc >= 15) {
              titleIdx = bodyStartIdx;
              candidate.style.textAlign = "center";
              candidate.style.textIndent = "0";
              bodyStartIdx++;
            }
          }

          // 4. Force 0.5in indent on body paragraphs, strip leading whitespace
          for (let i = bodyStartIdx; i < allParagraphs.length; i++) {
            const para = allParagraphs[i];

            // Skip centered paragraphs (e.g. Works Cited title)
            if (isCenteredPara(para)) continue;

            // Strip leading whitespace from the first text node
            const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null);
            const firstText = walker.nextNode();
            if (firstText) {
              firstText.textContent = firstText.textContent.replace(/^[\s\t\u00A0]+/, "");
            }

            // Force MLA first-line indent
            para.style.textIndent = "0.5in";
          }

          // Post-process: tag label spans for dismiss/click functionality
          tagYellowLabels(container);
          tagRewriteLabels(container);
        }

        container.contentEditable = "true";
        container.spellcheck = true;
        container.classList.add("preview-editable");
        container.style.zoom = zoom; // initial zoom; live updates via separate effect
        if (typeof onEditRef.current === "function") {
          const handler = () => onEditRef.current?.();
          editHandlerRef.current = handler;
          container.addEventListener("input", handler);
          container.addEventListener("paste", handler);
        }

        // Teacher red-pen: newly typed text appears in bold red.
        // execCommand typing state is fragile — it resets whenever the caret
        // moves.  We blanket-apply on focus, mouseup (click to new position),
        // keydown (right before each character), and input (for the next char).
        if (isTeacher) {
          const applyRedBold = () => {
            try {
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed) return;
              document.execCommand("foreColor", false, "#D32F2F");
              if (!document.queryCommandState("bold")) {
                document.execCommand("bold");
              }
            } catch (_) {}
          };
          const onFocus = () => applyRedBold();
          const onMouseUp = () => applyRedBold();
          const onKeyDown = (e) => {
            // Printable character about to be inserted — ensure state is set
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
              applyRedBold();
            }
          };
          const onInput = () => requestAnimationFrame(applyRedBold);
          container.addEventListener("focus", onFocus);
          container.addEventListener("mouseup", onMouseUp);
          container.addEventListener("keydown", onKeyDown);
          container.addEventListener("input", onInput);
          redPenHandlersRef.current = { onFocus, onMouseUp, onKeyDown, onInput };
        }

        // Keyboard shortcuts: Tab and Ctrl+E
        const keyHandler = (e) => {
          // ── Inline comment editing: Enter finalizes, Escape cancels ──
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const node = sel.anchorNode;
            const el = node?.nodeType === 3 ? node.parentElement : node;
            const editingSpan = el?.closest?.("[data-vysti-inline-comment][data-vysti-editing]");
            if (editingSpan) {
              if (e.key === "Enter") {
                e.preventDefault();
                editingSpan.removeAttribute("data-vysti-editing");
                // If teacher typed nothing (just arrow + whitespace), remove span
                const typed = editingSpan.textContent.replace(/\u2192\s*/, "").trim();
                if (!typed) {
                  editingSpan.remove();
                } else {
                  editingSpan.classList.add("vysti-inline-comment");
                }
                // Move cursor after the span
                const r = document.createRange();
                if (editingSpan.parentNode) {
                  r.setStartAfter(editingSpan);
                  r.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(r);
                }
                onEditRef.current?.();
                return;
              } else if (e.key === "Escape") {
                e.preventDefault();
                editingSpan.remove();
                onEditRef.current?.();
                return;
              }
            }
          }

          if (e.key === "Tab") {
            e.preventDefault();
            insertTab(container, () => onEditRef.current?.());
          } else if (e.key === "e" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            toggleCenter(container, () => onEditRef.current?.());
          }
        };
        keydownHandlerRef.current = keyHandler;
        container.addEventListener("keydown", keyHandler);

        // Inline comment: clicking outside the editing span finalizes it
        if (isTeacher) {
          const finalizeInlineComment = (e) => {
            const editing = container.querySelector("[data-vysti-inline-comment][data-vysti-editing]");
            if (!editing) return;
            if (editing.contains(e.target)) return;
            editing.removeAttribute("data-vysti-editing");
            const typed = editing.textContent.replace(/\u2192\s*/, "").trim();
            if (!typed) {
              editing.remove();
            } else {
              editing.classList.add("vysti-inline-comment");
            }
            onEditRef.current?.();
          };
          inlineCommentHandlersRef.current = finalizeInlineComment;
          document.addEventListener("mousedown", finalizeInlineComment);
        }

        // Tooltip flip: when a label is near the top of the scroll container,
        // add .tooltip-below so the tooltip renders below instead of above.
        const tooltipFlipHandler = (e) => {
          const hit = e.target.closest(".vysti-preview-hit[data-vysti-label]");
          if (!hit) return;
          const containerRect = container.getBoundingClientRect();
          const hitRect = hit.getBoundingClientRect();
          // If the label's top is within 200px of the container top, flip below
          if (hitRect.top - containerRect.top < 200) {
            hit.classList.add("tooltip-below");
          } else {
            hit.classList.remove("tooltip-below");
          }
        };
        const tooltipFlipOut = (e) => {
          const hit = e.target.closest(".vysti-preview-hit[data-vysti-label]");
          if (hit) hit.classList.remove("tooltip-below");
        };
        tooltipFlipHandlerRef.current = tooltipFlipHandler;
        tooltipFlipOutRef.current = tooltipFlipOut;
        container.addEventListener("mouseover", tooltipFlipHandler);
        container.addEventListener("mouseout", tooltipFlipOut);

        // Handle double-clicks on yellow label highlights for guidance
        if (typeof onLabelClickRef.current === "function") {
          const handler = (event) => {
            const target = event.target.closest(".vysti-preview-hit[data-vysti-label]");
            if (target) {
              event.preventDefault();
              event.stopPropagation();
              const label = target.getAttribute("data-vysti-label");
              if (label) onLabelClickRef.current?.(label, target);
            }
          };
          labelClickHandlerRef.current = handler;
          container.addEventListener("dblclick", handler, true);
        }

        if (onErrorRef.current) onErrorRef.current(null);

        // Notify caller that rendering is complete
        if (typeof onRenderedRef.current === "function") onRenderedRef.current();

        // Fade in after render completes (recheck fade-out sets preview-fading)
        container.classList.remove("preview-fading");
      } catch (err) {
        console.error("Failed to render preview", err);
        if (renderId !== renderIdRef.current) return;
        if (onErrorRef.current) onErrorRef.current(err);
      }
    };

    render();

    return () => {
      if (editHandlerRef.current) {
        container.removeEventListener("input", editHandlerRef.current);
        container.removeEventListener("paste", editHandlerRef.current);
        editHandlerRef.current = null;
      }
      if (keydownHandlerRef.current) {
        container.removeEventListener("keydown", keydownHandlerRef.current);
        keydownHandlerRef.current = null;
      }
      if (labelClickHandlerRef.current) {
        container.removeEventListener("dblclick", labelClickHandlerRef.current, true);
        labelClickHandlerRef.current = null;
      }
      if (tooltipFlipHandlerRef.current) {
        container.removeEventListener("mouseover", tooltipFlipHandlerRef.current);
        tooltipFlipHandlerRef.current = null;
      }
      if (tooltipFlipOutRef.current) {
        container.removeEventListener("mouseout", tooltipFlipOutRef.current);
        tooltipFlipOutRef.current = null;
      }
      if (redPenHandlersRef.current) {
        container.removeEventListener("focus", redPenHandlersRef.current.onFocus);
        container.removeEventListener("mouseup", redPenHandlersRef.current.onMouseUp);
        container.removeEventListener("keydown", redPenHandlersRef.current.onKeyDown);
        container.removeEventListener("input", redPenHandlersRef.current.onInput);
        redPenHandlersRef.current = null;
      }
      if (inlineCommentHandlersRef.current) {
        document.removeEventListener("mousedown", inlineCommentHandlersRef.current);
        inlineCommentHandlersRef.current = null;
      }
      renderIdRef.current += 1;
    };
  }, [blob, containerRef]);

  // Lightweight zoom update — only touches container.style.zoom, never re-renders docx
  useEffect(() => {
    const container = containerRef.current;
    if (container) container.style.zoom = zoom;
  }, [zoom, containerRef]);
}
