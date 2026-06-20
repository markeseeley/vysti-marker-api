import { extractCleanTextFromElement, stripVystiInlineArtifacts } from "./previewNavigator";

const normalizeLineBreaks = (text) =>
  String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

export function extractPreviewTextFromContainer(containerEl) {
  if (!containerEl) return null;

  const paragraphs = [];
  const elements = containerEl.querySelectorAll("p, li");

  for (const el of elements) {
    if (el.closest("table") || el.closest(".docx-table")) continue;

    let text = extractCleanTextFromElement(el, { preserveLineBreaks: true });
    if (!text) continue;

    // Strip any Vysti artifacts (arrows, labels) that leaked through
    text = stripVystiInlineArtifacts(text);
    if (!text) continue;

    const parts = String(text)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === "Issue" || trimmed === "Explanation" || trimmed === "Issue Explanation") {
        continue;
      }
      paragraphs.push(part);
    }
  }

  // Pick up teacher-typed content in <div> elements (Chrome creates divs,
  // not <p>, when pressing Enter in contentEditable).  Only leaf divs — ones
  // with no block descendants — so we don't duplicate docx-preview wrappers.
  if (paragraphs.length === 0) {
    for (const div of containerEl.querySelectorAll("div")) {
      if (div.closest("table") || div.closest(".docx-table")) continue;
      if (div.querySelector("p, li, div, table, section, article")) continue;
      let text = extractCleanTextFromElement(div, { preserveLineBreaks: true });
      if (!text) continue;
      text = stripVystiInlineArtifacts(text);
      if (!text) continue;
      const trimmed = text.trim();
      if (trimmed === "Issue" || trimmed === "Explanation" || trimmed === "Issue Explanation") continue;
      paragraphs.push(trimmed);
    }
  }

  if (paragraphs.length === 0) {
    let allText = extractCleanTextFromElement(containerEl, { preserveLineBreaks: true });

    // Strip any Vysti artifacts (arrows, labels) that leaked through
    allText = stripVystiInlineArtifacts(allText);

    // Detect if the extracted text is CSS/garbage (not real content)
    if (allText) {
      const trimmed = allText.trim();
      // Check if it looks like CSS properties or styling code — only reject
      // if it STARTS with CSS-like content (not if essay text happens to
      // contain a word like "background")
      const looksLikeCSS = /^\s*[.#@][a-zA-Z][\w-]*\s*\{/.test(trimmed) ||
                           /^\s*(?:background|padding|margin|display|flex-flow)\s*:/i.test(trimmed);
      if (looksLikeCSS) {
        return null; // Reject CSS content
      }
    }

    return allText || null;
  }

  return paragraphs.join("\n\n");
}

export function wordCountFromText(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function stripStudentHeaderBeforeTitleForDownload(text) {
  const normalized = normalizeLineBreaks(text);
  const lines = normalized.split("\n");
  const blankIndex = lines.findIndex((line) => line.trim() === "");
  if (blankIndex <= 0) return normalized;
  const headerLines = lines.slice(0, blankIndex);
  const isShortHeader =
    headerLines.length <= 4 &&
    headerLines.length >= 1 &&
    headerLines.every((line) => line.trim().length > 0 && line.trim().length <= 60);
  if (!isShortHeader) return normalized;
  return lines.slice(blankIndex + 1).join("\n").trimStart();
}

export function extractPreviewText(containerEl) {
  return extractPreviewTextFromContainer(containerEl);
}

/**
 * Extract preview text for teacher "Download marked essay".
 * Preserves ALL arrow labels (automated Vysti marks + teacher annotations).
 * Vysti labels are wrapped in «→ Label» delimiters for styled DOCX export.
 * Teacher annotations are wrapped in [Teacher: ...] for visual distinction.
 * Strips rewrite tags, hidden tables, and template placeholders ({FOUND}, etc.).
 */
export function extractTextWithTeacherAnnotations(containerEl) {
  if (!containerEl) return null;

  const clone = containerEl.cloneNode(true);

  // ── 0. Spelling/Grammar squiggles ──
  // Convert tagged spans to {~text~} (red squiggle) ONLY when the teacher
  // had the corresponding toggle ON at the time of extract. Otherwise the
  // tags are stripped and the underlying text is left plain — keeping the
  // download clean of any unverified LT noise.
  const showSpelling = containerEl.classList.contains("vysti-show-spelling");
  const showGrammar = containerEl.classList.contains("vysti-show-grammar");
  for (const span of clone.querySelectorAll('[data-vysti-grammar]')) {
    const cat = span.getAttribute("data-vysti-grammar");
    const text = span.textContent || "";
    if (!text) {
      span.removeAttribute("data-vysti-grammar");
      span.removeAttribute("data-vysti-grammar-bg");
      continue;
    }
    if ((cat === "spelling" && showSpelling) || (cat === "grammar" && showGrammar)) {
      // Wrap in red squiggle marker — backend converts to WD_UNDERLINE.WAVY
      span.textContent = `{~${text}~}`;
    }
    // Strip the marker attributes either way so they don't survive serialization
    span.removeAttribute("data-vysti-grammar");
    span.removeAttribute("data-vysti-grammar-bg");
  }

  // ── 1. Convert SelectionPopover comments (data-vysti-comment attribute) ──
  // These spans wrap the anchor text with the comment stored as a data attribute.
  // Remove the pencil indicators first, then convert wrapper to {c|anchor|comment}.
  for (const ind of clone.querySelectorAll("[data-vysti-comment-indicator='1']")) {
    ind.remove();
  }
  for (const span of clone.querySelectorAll("span[data-vysti-comment]")) {
    const comment = (span.getAttribute("data-vysti-comment") || "").trim();
    const anchor = (span.textContent || "").trim();

    if (comment) {
      // anchor may be empty when surroundContents failed (cross-boundary selection
      // in docx-preview). In that case the original text is still in the DOM, so we
      // emit {c||comment} (empty anchor) and the backend creates a point comment
      // without duplicating the text.
      span.textContent = `{c|${anchor}|${comment}}`;
    }
    // Remove the data attributes so later loops don't re-process
    span.removeAttribute("data-vysti-comment");
    span.removeAttribute("data-vysti-comment-anchor");
  }

  // ── 1b. Convert arrow marks (data-vysti-arrow-mark) ──
  // These are standalone → indicators placed inline by the teacher.
  // Guard: execCommand("bold") in red-pen mode can clone the arrow span's
  // attributes onto adjacent typed-text spans.  Only convert spans whose
  // text actually contains the → character; strip the attribute from the
  // rest so they are treated as normal teacher highlights instead.
  for (const span of clone.querySelectorAll("span[data-vysti-arrow-mark='1']")) {
    if (span.textContent.includes("\u2192")) {
      // Walk up and move the arrow OUT of every inline ancestor until it
      // is a direct child of a block element (p / li / div / td). The
      // serialized " {arrow}" must not sit inside any wrapper that itself
      // becomes a braced token — teacher highlight {g:...}, engine label
      // «→ ...», tagged highlight {tag:...}, comment {c|...|...},
      // insert {ins:...}, star {star:...}, etc. — because each of those
      // backend regexes is `[^}]+` (non-recursive), so they swallow the
      // arrow's closing brace and render "{arrow" as literal text in the
      // exported .docx. This is a superset of the prior teacher-highlight
      // guard; it also catches engine labels, comments, and any future
      // wrapper that uses brace serialization.
      const _isBlock = (tag) =>
        tag === "P" || tag === "LI" || tag === "DIV" ||
        tag === "TD" || tag === "TH" || tag === "BODY";
      let parent = span.parentElement;
      while (parent && parent !== clone && !_isBlock(parent.tagName)) {
        parent.after(span);
        parent = span.parentElement;
      }
      span.textContent = " {arrow}";
    } else {
      span.removeAttribute("data-vysti-arrow-mark");
    }
  }

  // ── 2. Convert old-style teacher annotation arrows ──
  // Old palette marks (→ ✓ Good, etc.) → [Teacher: ...] for inline bold red.
  for (const span of clone.querySelectorAll(
    "span.vysti-teacher-mark, span[data-vysti-teacher='1'], span[data-vysti-teacher-highlight='1']"
  )) {
    const text = (span.textContent || "").trim();
    if (!text.startsWith("\u2192")) continue;

    // Fallback: old palette marks → inline styled text
    span.textContent = " [Teacher:" + text.slice(1) + "]";
  }

  // Move engine label spans out of teacher highlights so they serialize as
  // separate tokens rather than being swallowed by {g:...} / {hl:...}.
  for (const span of clone.querySelectorAll(".vysti-preview-hit[data-vysti-label]")) {
    const parentHL = span.parentElement?.closest("span[data-vysti-teacher-highlight='1']");
    if (parentHL) {
      parentHL.after(span);
    }
  }

  // Wrap Vysti automated label arrows in «» delimiters for styled export.
  // These are arrow spans (text starts with →) that are NOT teacher marks.
  for (const span of clone.querySelectorAll("span, a")) {
    if (span.classList.contains("vysti-teacher-mark") ||
        span.getAttribute("data-vysti-teacher") === "1" ||
        span.getAttribute("data-vysti-teacher-highlight") === "1") continue;
    const text = (span.textContent || "").trim();
    if (text.startsWith("\u2192")) {
      span.textContent = ` \u00AB${text}\u00BB`;
    }
  }

  // ── 3a. Convert teacher Bold marks ──
  // execCommand("bold") creates <b>, <strong>, or <span style="font-weight:bold">.
  // Only convert elements that are inside teacher-edited content (not original essay formatting).
  // We detect teacher-added bold by checking for <b> and <strong> tags that the teacher added
  // during the preview editing session. We skip spans with data-vysti-teacher-highlight
  // as those are handled separately below.
  for (const b of clone.querySelectorAll("b, strong")) {
    // Skip if it's inside a teacher highlight or other special element
    if (b.closest("[data-vysti-teacher-highlight]")) continue;
    if (b.closest("[data-vysti-comment]")) continue;
    const text = b.textContent || "";
    if (!text.trim()) continue;
    b.textContent = `{b:${text}}`;
  }

  // ── 3a2. Convert italic text ──
  // docx-preview renders Word italics as <i>, <em>, or <span style="font-style:italic">.
  // Wrap italic text in {i:text} markers so the backend can restore run.italic in the .docx.
  // Process <i> and <em> tags first, then check for inline font-style on spans.
  for (const el of clone.querySelectorAll("i, em")) {
    if (el.closest("[data-vysti-teacher-highlight]")) continue;
    if (el.closest("[data-vysti-comment]")) continue;
    const text = el.textContent || "";
    if (!text.trim()) continue;
    // Don't double-wrap if already inside another marker
    if (/^\{[a-z~]/.test(text.trim())) continue;
    el.textContent = `{i:${text}}`;
  }
  // Catch spans with inline font-style: italic (some docx renderers use this)
  for (const span of clone.querySelectorAll("span")) {
    if ((span.style.fontStyle || "").includes("italic")) {
      if (span.closest("[data-vysti-teacher-highlight]")) continue;
      if (span.closest("[data-vysti-comment]")) continue;
      if (span.hasAttribute("data-vysti-teacher-highlight")) continue;
      const text = span.textContent || "";
      if (!text.trim()) continue;
      if (/^\{[a-z~]/.test(text.trim())) continue;
      span.textContent = `{i:${text}}`;
    }
  }

  // ── 3b. Convert star marks (before generic highlights) ──
  for (const span of clone.querySelectorAll("span[data-vysti-star-mark='1']")) {
    const text = (span.textContent || "").trim();
    if (text) {
      span.textContent = `{star:${text}}`;
    }
  }

  // ── 3b2. Convert unhappy marks ──
  for (const span of clone.querySelectorAll("span[data-vysti-unhappy-mark='1']")) {
    const text = (span.textContent || "").trim();
    if (text) {
      span.textContent = `{unhappy:${text}}`;
    }
  }

  // ── 3c. Convert insert marks (before generic highlights) ──
  for (const span of clone.querySelectorAll("span[data-vysti-insert='1']")) {
    const text = (span.textContent || "").trim();
    if (text) {
      span.textContent = `{ins:${text}}`;
    }
  }

  // ── 3c2. Convert inline comments (red bold yellow highlight) ──
  for (const span of clone.querySelectorAll("span[data-vysti-inline-comment='1']")) {
    const text = (span.textContent || "").trim();
    if (text) {
      span.textContent = `{b:${text}}`;
    }
  }

  // ── 3d. Convert underline marks (before generic highlight checks) ──
  for (const span of clone.querySelectorAll("span[data-vysti-underline='1']")) {
    const text = (span.textContent || "").trim();
    if (text) {
      span.textContent = `{u:${text}}`;
    }
  }

  // ── 3e. Convert tagged highlights (before generic highlight checks) ──
  // Remove tag-label sups first, then convert the highlight span.
  for (const sup of clone.querySelectorAll("sup[data-vysti-tag-label='1']")) {
    // Store the label text; we'll embed it in the tagged highlight delimiter
    const prev = sup.previousElementSibling;
    if (prev && prev.hasAttribute("data-vysti-tagged-hl")) {
      prev.setAttribute("data-vysti-tag-label-text", (sup.textContent || "").trim());
    }
    sup.remove();
  }
  for (const span of clone.querySelectorAll("span[data-vysti-tagged-hl='1']")) {
    const text = (span.textContent || "").trim();
    if (!text) continue;
    const colorCode = span.getAttribute("data-vysti-tag-color") || "hl";
    const label = (span.getAttribute("data-vysti-tag-label-text") || "").trim();
    span.textContent = `{tag:${colorCode}:${label}:${text}}`;
  }

  // ── 3f. Remove paragraph notes (teachers use margin comments instead) ──
  for (const span of clone.querySelectorAll("span[data-vysti-para-mark='1']")) {
    span.remove();
  }

  // ── 3g. Convert reorder markers ──
  for (const sup of clone.querySelectorAll("sup[data-vysti-reorder-num='1']")) {
    const num = (sup.textContent || "").trim();
    if (num) {
      sup.textContent = ` {reorder:${num}}`;
    }
  }

  // ── 4a. Convert TEACHER visual marks (squiggly, strikethrough, highlights, sp) ──
  // These have data-vysti-teacher-highlight='1' from PreviewToolbar.
  // Pre-step: move any nested teacher sups outside their parent highlight spans
  // so that setting span.textContent doesn't destroy the child <sup> nodes.
  for (const span of clone.querySelectorAll("span[data-vysti-teacher-highlight='1']")) {
    for (const childSup of [...span.querySelectorAll("sup[data-vysti-teacher-highlight='1']")]) {
      span.after(childSup);
    }
  }
  for (const span of clone.querySelectorAll("span[data-vysti-teacher-highlight='1']")) {
    const text = (span.textContent || "").trim();
    if (!text || text.startsWith("[Teacher:") || text.startsWith("{c|") || text.startsWith("{star:") || text.startsWith("{unhappy:") || text.startsWith("{u:") || text.startsWith("{tag:") || text.startsWith("{para:") || text.startsWith("{ins:") || text.startsWith("{arrow") || text.startsWith("\u00AB")) continue;
    const td = (span.style.textDecoration || "").toLowerCase();
    const bg = span.style.backgroundColor || "";
    if (span.hasAttribute("data-vysti-underline") || span.hasAttribute("data-vysti-tagged-hl") || span.hasAttribute("data-vysti-para-mark") || span.hasAttribute("data-vysti-insert") || span.hasAttribute("data-vysti-inline-comment") || span.hasAttribute("data-vysti-unhappy-mark") || span.hasAttribute("data-vysti-confusion") || span.hasAttribute("data-vysti-reorder") || span.hasAttribute("data-vysti-arrow-mark")) {
      // Already handled in earlier sections
      continue;
    } else if (td.includes("wavy")) {
      span.textContent = `{~${span.textContent.trim()}~}`;
    } else if (td.includes("line-through")) {
      span.textContent = `{x:${span.textContent.trim()}}`;
    } else if (bg.includes("0, 210, 255") || bg.includes("0,210,255")) {
      span.textContent = `{hl:${span.textContent.trim()}}`;
    } else if (bg.includes("156, 163, 175") || bg.includes("156,163,175")) {
      span.textContent = `{g:${span.textContent.trim()}}`;
    } else if (bg.includes("34, 197, 94") || bg.includes("34,197,94")) {
      span.textContent = `{gr:${span.textContent.trim()}}`;
    }
    // Yellow comment wrappers (255, 235, 59) — no marker needed
    // Star marks (245, 158, 11) — already handled in 3b
  }
  for (const sup of clone.querySelectorAll("sup[data-vysti-teacher-highlight='1']")) {
    const supText = (sup.textContent || "").trim();
    if (supText === "sp") {
      sup.textContent = " {sp}";
    } else if (supText === "wc") {
      sup.textContent = " {wc}";
    } else if (supText === "???") {
      sup.textContent = " {???}";
    } else if (supText === "^" || sup.hasAttribute("data-vysti-caret")) {
      sup.textContent = " {^}";
    } else if (sup.hasAttribute("data-vysti-custom-sup")) {
      sup.textContent = ` {sup:${supText}}`;
    } else if (supText === "\u2713") {
      sup.textContent = " {+\u2713}";
    } else if (supText === "\u263A") {
      sup.textContent = " {+\u263A}";
    } else if (supText === "\u2605" || sup.hasAttribute("data-vysti-star-indicator")) {
      sup.textContent = " {+\u2605}";
    }
  }
  // Span-based indicators (smiley, thumbs up, unhappy, confusion ???)
  for (const ind of clone.querySelectorAll("span[data-vysti-positive-indicator='1'], span[data-vysti-star-indicator='1'], span[data-vysti-unhappy-indicator='1'], span[data-vysti-confusion='1']")) {
    if (ind.hasAttribute("data-vysti-star-indicator")) {
      ind.textContent = " {+\uD83D\uDC4D}";
    } else if (ind.hasAttribute("data-vysti-unhappy-indicator")) {
      ind.textContent = " {-\u2639}";
    } else if (ind.hasAttribute("data-vysti-confusion")) {
      ind.textContent = " {???}";
    } else {
      const t = (ind.textContent || "").trim();
      ind.textContent = ` {+${t}}`;
    }
  }

  // ── 4b. Convert ENGINE visual marks (from marked .docx, rendered by docx-preview) ──
  // Engine highlights use standard Word colors (solid, no opacity) and do NOT have
  // data-vysti-teacher-highlight. docx-preview renders them as inline background-color.
  //
  // Nesting note: section 3a may have already wrapped a child <b> as
  // {b:...} INSIDE one of these highlight spans (the engine emits compound
  // replacement suggestions like a green-bg span containing a <b>insertion</b>).
  // If we blindly wrap the span's textContent with {gr:...}, we get
  // {gr:cause{b:s behind}} — which the backend's _BOLD_RE / _HL_GREEN_RE
  // can't parse because their capture group ([^}]+) stops at the first '}',
  // breaking the macro boundaries. Result in the marked .docx: literal
  // `{b:s behind}` text leaking through to the reader.
  //
  // Fix: when the captured text already contains an inner macro, emit
  // ADJACENT highlight wraps around the non-macro slices instead of one
  // engulfing wrap. E.g. "cause{b:s behind}" with prefix "gr" becomes
  // "{gr:cause}{b:s behind}" — both macros parseable.
  const _INNER_MACRO_RE =
    /\{[a-z~]+:[^}]*\}|\{~[^~]+~\}|\{\^\}|\{sp\}|\{wc\}|\{arrow\}|\{\?{3}\}/g;
  function wrapAvoidingNested(text, prefix) {
    _INNER_MACRO_RE.lastIndex = 0;
    if (!_INNER_MACRO_RE.test(text)) {
      return `{${prefix}:${text.trim()}}`;
    }
    _INNER_MACRO_RE.lastIndex = 0;
    let out = "";
    let last = 0;
    let m;
    while ((m = _INNER_MACRO_RE.exec(text)) !== null) {
      const before = text.slice(last, m.index);
      const beforeTrimmed = before.trim();
      if (beforeTrimmed) {
        const lead = before.match(/^\s*/)[0];
        const tail = before.match(/\s*$/)[0];
        out += `${lead}{${prefix}:${beforeTrimmed}}${tail}`;
      } else {
        out += before;
      }
      out += m[0];
      last = m.index + m[0].length;
    }
    const rest = text.slice(last);
    const restTrimmed = rest.trim();
    if (restTrimmed) {
      const lead = rest.match(/^\s*/)[0];
      const tail = rest.match(/\s*$/)[0];
      out += `${lead}{${prefix}:${restTrimmed}}${tail}`;
    } else {
      out += rest;
    }
    return out;
  }

  const processed = new Set();
  for (const span of clone.querySelectorAll("span[data-vysti-teacher-highlight='1']")) {
    processed.add(span);
  }
  for (const span of clone.querySelectorAll("span")) {
    if (processed.has(span)) continue;
    // Skip already-handled elements
    if (span.getAttribute("data-vysti-teacher") === "1") continue;
    if (span.hasAttribute("data-vysti-comment")) continue;
    if (span.classList.contains("vysti-arrow-label")) continue;
    if (span.classList.contains("vysti-rewrite-tag")) continue;

    const text = (span.textContent || "").trim();
    if (!text) continue;
    // Skip already-wrapped delimiters
    if (/^[\u00AB\[{]/.test(text)) continue;

    const td = (span.style.textDecoration || "").toLowerCase();
    const bg = (span.style.backgroundColor || "").toLowerCase();

    // Engine red strikethrough: red highlight + line-through
    if (td.includes("line-through") && (bg === "red" || bg === "#ff0000" || bg.startsWith("rgb(255, 0, 0"))) {
      span.textContent = wrapAvoidingNested(span.textContent, "x");
    }
    // Engine aqua/turquoise highlight (WD_COLOR_INDEX.TURQUOISE → #00FFFF)
    else if (bg === "cyan" || bg === "#00ffff" || bg.startsWith("rgb(0, 255, 255")) {
      span.textContent = wrapAvoidingNested(span.textContent, "hl");
    }
    // Engine gray highlight (WD_COLOR_INDEX.GRAY_25 → #C0C0C0)
    else if (bg === "silver" || bg === "#c0c0c0" || bg.startsWith("rgb(192, 192, 192") || bg === "lightgray" || bg === "#d3d3d3" || bg.startsWith("rgb(211, 211, 211")) {
      span.textContent = wrapAvoidingNested(span.textContent, "g");
    }
    // Engine green highlight (WD_COLOR_INDEX.BRIGHT_GREEN → #00FF00)
    else if (bg === "lime" || bg === "#00ff00" || bg.startsWith("rgb(0, 255, 0") || bg.startsWith("rgb(0, 128, 0") || bg === "green") {
      span.textContent = wrapAvoidingNested(span.textContent, "gr");
    }
  }

  // Remove rewrite tags
  for (const el of clone.querySelectorAll(".vysti-rewrite-tag")) el.remove();

  // Remove hidden tables (Issues Summary)
  for (const tbl of clone.querySelectorAll("table")) {
    if (tbl.style.display === "none") tbl.remove();
  }

  const paragraphs = [];
  for (const el of clone.querySelectorAll("p, li")) {
    if (el.closest("table") || el.closest(".docx-table")) continue;
    let text = (el.textContent || "").replace(/[ \t]{2,}/g, " ").trim();
    if (!text) continue;
    if (text === "Issue" || text === "Explanation" || text === "Issue Explanation") continue;
    paragraphs.push(text);
  }
  // Pick up teacher-typed content in <div> elements (Chrome creates divs,
  // not <p>, when pressing Enter in contentEditable).  Only leaf divs — ones
  // with no block descendants — so we don't duplicate docx-preview wrappers.
  for (const div of clone.querySelectorAll("div")) {
    if (div.closest("table") || div.closest(".docx-table")) continue;
    if (div.querySelector("p, li, div, table, section, article")) continue;
    let text = (div.textContent || "").replace(/[ \t]{2,}/g, " ").trim();
    if (!text) continue;
    if (text === "Issue" || text === "Explanation" || text === "Issue Explanation") continue;
    paragraphs.push(text);
  }

  let result = paragraphs.length > 0 ? paragraphs.join("\n\n") : null;
  if (result) {
    // Strip unresolved template placeholders
    result = result
      .replace(/\{FOUND\}/g, "")
      .replace(/\{THESIS\}/g, "")
      .replace(/\{TOPIC_\d+\}/g, "")
      .replace(/\{COUNT\}/g, "")
      .replace(/\{ORIGINAL\}/g, "")
      // Strip zero-width spaces (inserted as cursor buffers after arrow marks)
      .replace(/\u200B/g, "")
      // Strip any leaked HTML tags
      .replace(/<\/?[a-z][^>]*>/gi, "")
      // Clean up double spaces left by removals
      .replace(/  +/g, " ");
  }
  return result;
}

/**
 * Fix common typos students introduce while editing in the preview:
 *  - space before period / comma / semicolon / colon / ? / !
 *  - missing space after punctuation (e.g. "fathers.However")
 *  - multiple consecutive spaces
 *  - duplicate punctuation (.. → .  but ... ellipsis preserved)
 */
export function cleanupCommonTypos(text) {
  if (!text) return text;
  return text
    // Collapse multiple spaces (not newlines) into one
    .replace(/[ \t]{2,}/g, " ")
    // Remove space before sentence/clause punctuation
    .replace(/ +([.,;:!?])/g, "$1")
    // Normalize runs of periods: 2 → 1, 3 stays (ellipsis), 4+ → ellipsis
    .replace(/\.{2,}/g, (m) => (m.length >= 3 ? "\u2026" : "."))
    // Duplicate commas, semicolons, colons, etc.
    .replace(/([,;:!?])\1+/g, "$1")
    // Missing space after period before uppercase letter ("fathers.However")
    .replace(/\.([A-Z])/g, ". $1")
    // Missing space after comma/semicolon/colon/!/? before any letter
    .replace(/([,;:!?])([A-Za-z])/g, "$1 $2");
}
