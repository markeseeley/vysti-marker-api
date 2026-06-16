import { useCallback, useEffect, useRef, useState } from "react";
import { Italic, AlignCenter, IndentIncrease, BookOpen, Search, Undo, Shuffle, Shapes } from "./Icons";
import PowerVerbsPopover from "./PowerVerbsPopover";
import LexisModal from "./LexisModal";
import { applyRepetitionHighlights, clearRepetitionHighlights } from "../lib/repetitionHighlight";
import { highlightThesisDevicesInBlock } from "../lib/previewNavigator";
import { loadThesisDevicesLexicon } from "../lib/studentMetrics";

function getAnchorParagraph(container) {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  while (node && node !== container) {
    if (node.nodeType === 1 && node.tagName === "P") return node;
    node = node.parentNode;
  }
  return null;
}

function insertTab(container, onEdit) {
  if (!container) return;
  container.focus();
  const ok = document.execCommand("insertText", false, "\t");
  if (!ok) {
    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode("\t"));
      range.collapse(false);
    }
  }
  onEdit?.();
}

function toggleItalic(container, onEdit) {
  if (!container) return;
  container.focus();
  document.execCommand("italic");
  onEdit?.();
}

function toggleCenter(container, onEdit) {
  if (!container) return;
  container.focus();
  const para = getAnchorParagraph(container);
  if (!para) return;
  const current = para.style.textAlign;
  para.style.textAlign = current === "center" ? "" : "center";
  onEdit?.();
}

export default function WriteEditor({
  text,
  onChange,
  isChecking,
  wordCount,
  authorName,
  onAuthorNameChange,
  textTitle,
  onTextTitleChange,
  metrics,
}) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);
  const [verbsOpen, setVerbsOpen] = useState(false);
  const [verbTargetWord, setVerbTargetWord] = useState("");
  const [lexisOpen, setLexisOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState(null); // null | "repetition" | "techniques"
  const [highlightInfo, setHighlightInfo] = useState(null); // { count } for active highlight
  const lexiconRef = useRef(null);
  const verbsBtnRef = useRef(null);

  // Load thesis devices lexicon once
  useEffect(() => {
    if (!lexiconRef.current) {
      loadThesisDevicesLexicon().then(({ lexicon }) => {
        lexiconRef.current = lexicon;
      }).catch(() => {});
    }
  }, []);

  const clearHighlights = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    clearRepetitionHighlights(el);
    // Clear technique highlights
    el.querySelectorAll(".vysti-device-hit").forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
      }
    });
    el.querySelectorAll(".vysti-preview-tech-block").forEach((el) => {
      el.classList.remove("vysti-preview-tech-block");
    });
    el.classList.remove("vysti-highlight-focus-mode");
  }, []);

  const handleToggleRepetition = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (highlightMode === "repetition") {
      clearHighlights();
      setHighlightMode(null);
      setHighlightInfo(null);
      return;
    }
    clearHighlights();
    const repeatedNouns = metrics?.power?.details?.repeatedNouns;
    if (!repeatedNouns?.length) {
      setHighlightMode(null);
      setHighlightInfo({ count: 0, message: "No repeated nouns detected" });
      setTimeout(() => setHighlightInfo(null), 2500);
      return;
    }
    const { total } = applyRepetitionHighlights(el, repeatedNouns, {
      thesisDevicesLexicon: lexiconRef.current,
    });
    if (total > 0) {
      el.classList.add("vysti-highlight-focus-mode");
      setHighlightMode("repetition");
      setHighlightInfo({ count: total });
    } else {
      setHighlightInfo({ count: 0, message: "No problematic repetition found" });
      setTimeout(() => setHighlightInfo(null), 2500);
    }
  }, [highlightMode, metrics, clearHighlights]);

  const handleToggleTechniques = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (highlightMode === "techniques") {
      clearHighlights();
      setHighlightMode(null);
      setHighlightInfo(null);
      return;
    }
    clearHighlights();
    const lexicon = lexiconRef.current;
    if (!lexicon || !lexicon.size) {
      setHighlightInfo({ count: 0, message: "Techniques lexicon not loaded" });
      setTimeout(() => setHighlightInfo(null), 2500);
      return;
    }
    const blocks = el.querySelectorAll("p");
    let totalHits = 0;
    blocks.forEach((block) => {
      const text = (block.textContent || "").trim();
      if (!text) return;
      const hits = highlightThesisDevicesInBlock(block, lexicon);
      if (hits > 0) {
        block.classList.add("vysti-preview-tech-block");
        totalHits += hits;
      }
    });
    if (totalHits > 0) {
      el.classList.add("vysti-highlight-focus-mode");
      setHighlightMode("techniques");
      setHighlightInfo({ count: totalHits });
    } else {
      setHighlightInfo({ count: 0, message: "No techniques found yet" });
      setTimeout(() => setHighlightInfo(null), 2500);
    }
  }, [highlightMode, clearHighlights]);

  // Clear highlights when text changes (user types)
  useEffect(() => {
    if (highlightMode) {
      clearHighlights();
      setHighlightMode(null);
      setHighlightInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Italic boundary markers (Unicode PUA, won't collide with normal text).
  // The backend strips these and converts them to italic runs in the docx
  // that the marker engine receives.
  const ITALIC_START = "\uE000";
  const ITALIC_END = "\uE001";

  const extractText = useCallback(() => {
    const el = editorRef.current;
    if (!el) return "";
    // Walk the editor DOM and emit text with italic markers around
    // <em>/<i> spans so italic info survives the round-trip to the backend.
    // Mirror innerText semantics: block elements separated by \n\n, <br> is \n.
    let out = "";
    const isItalicEl = (node) => {
      const tag = node.tagName;
      if (tag === "EM" || tag === "I") return true;
      const style = node.style?.fontStyle || "";
      return style === "italic" || style === "oblique";
    };
    const BLOCK_TAGS = new Set(["P", "DIV", "LI", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6"]);
    const walk = (node, italic) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent || "";
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === "BR") {
        out += "\n";
        return;
      }
      const isBlock = BLOCK_TAGS.has(tag);
      const nowItalic = italic || isItalicEl(node);
      const openMark = !italic && nowItalic;
      if (isBlock && out.length > 0 && !out.endsWith("\n\n")) {
        out += out.endsWith("\n") ? "\n" : "\n\n";
      }
      if (openMark) out += ITALIC_START;
      for (const child of node.childNodes) walk(child, nowItalic);
      if (openMark) out += ITALIC_END;
    };
    for (const child of el.childNodes) walk(child, false);
    return out;
  }, []);

  const handleInput = useCallback(() => {
    isInternalChange.current = true;
    onChange(extractText());
  }, [onChange, extractText]);

  // Sync external text changes (e.g., initial load) into the editor
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const current = extractText();
    if (current !== text) {
      if (!text) {
        el.innerHTML = "";
      } else {
        // Use safe DOM API to avoid HTML injection from user text.
        // Convert ITALIC_START..ITALIC_END spans back into <em> elements
        // so restored drafts visually preserve italic formatting.
        el.innerHTML = "";
        const fragment = document.createDocumentFragment();
        text.split("\n").forEach((line) => {
          const p = document.createElement("p");
          if (line) {
            let italic = false;
            let buf = "";
            const flush = () => {
              if (!buf) return;
              if (italic) {
                const em = document.createElement("em");
                em.textContent = buf;
                p.appendChild(em);
              } else {
                p.appendChild(document.createTextNode(buf));
              }
              buf = "";
            };
            for (const ch of line) {
              if (ch === ITALIC_START) { flush(); italic = true; }
              else if (ch === ITALIC_END) { flush(); italic = false; }
              else buf += ch;
            }
            flush();
            if (!p.hasChildNodes()) p.appendChild(document.createElement("br"));
          } else {
            p.appendChild(document.createElement("br"));
          }
          fragment.appendChild(p);
        });
        el.appendChild(fragment);
      }
    }
  }, [text, extractText]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        insertTab(editorRef.current, handleInput);
      }
      // Sync state after native undo/redo
      if ((event.metaKey || event.ctrlKey) && (event.key === "z" || event.key === "Z")) {
        setTimeout(() => handleInput(), 0);
      }
    },
    [handleInput]
  );

  const handleUndo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("undo");
    handleInput();
  }, [handleInput]);

  const handleVerbsOpen = useCallback(() => {
    // Capture the currently selected word before opening
    const sel = window.getSelection?.();
    const selected = sel?.toString()?.trim() || "";
    setVerbTargetWord(selected);
    setVerbsOpen((v) => !v);
  }, []);

  const prevent = (e) => e.preventDefault();

  return (
    <div className="write-editor-wrap">
      <div className="write-context-header">
        <p className="write-context-prompt">What are we writing about today?</p>
        <div className="write-context-fields">
          <div className="write-context-field">
            <label className="write-context-label" htmlFor="writeAuthor">Author</label>
            <input
              id="writeAuthor"
              type="text"
              className="write-context-input"
              placeholder="e.g. Toni Morrison"
              value={authorName || ""}
              onChange={(e) => onAuthorNameChange?.(e.target.value)}
            />
          </div>
          <div className="write-context-field">
            <label className="write-context-label" htmlFor="writeTitle">Title</label>
            <input
              id="writeTitle"
              type="text"
              className="write-context-input"
              placeholder="e.g. Beloved"
              value={textTitle || ""}
              onChange={(e) => onTextTitleChange?.(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="write-editor-toolbar">
        <button
          type="button"
          className="preview-toolbar-btn"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          onMouseDown={prevent}
          onClick={handleUndo}
        >
          <Undo size={14} />
        </button>
        <button
          type="button"
          className="preview-toolbar-btn"
          title="Insert tab (Tab)"
          aria-label="Insert tab"
          onMouseDown={prevent}
          onClick={() => insertTab(editorRef.current, handleInput)}
        >
          <IndentIncrease size={14} />
        </button>
        <div className="preview-toolbar-sep" />
        <button
          type="button"
          className="preview-toolbar-btn"
          title="Italic (Ctrl+I)"
          aria-label="Toggle italic"
          onMouseDown={prevent}
          onClick={() => toggleItalic(editorRef.current, handleInput)}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          className="preview-toolbar-btn"
          title="Center align (Ctrl+E)"
          aria-label="Toggle center alignment"
          onMouseDown={prevent}
          onClick={() => toggleCenter(editorRef.current, handleInput)}
        >
          <AlignCenter size={14} />
        </button>
        <div className="preview-toolbar-sep" />
        <button
          ref={verbsBtnRef}
          type="button"
          className="preview-toolbar-btn"
          title="Power Verbs"
          aria-label="Open Power Verbs dictionary"
          onMouseDown={prevent}
          onClick={handleVerbsOpen}
        >
          <BookOpen size={14} />
        </button>
        <button
          type="button"
          className="preview-toolbar-btn"
          title="Lexis Dictionary"
          aria-label="Open Lexis dictionary"
          onMouseDown={prevent}
          onClick={() => setLexisOpen(true)}
        >
          <Search size={14} />
        </button>
        <div className="preview-toolbar-sep" />
        <button
          type="button"
          className={`preview-toolbar-btn${highlightMode === "techniques" ? " write-highlight-active" : ""}`}
          title="Highlight techniques"
          aria-label="Highlight techniques"
          onMouseDown={prevent}
          onClick={handleToggleTechniques}
        >
          <Shapes size={14} />
        </button>
        <button
          type="button"
          className={`preview-toolbar-btn${highlightMode === "repetition" ? " write-highlight-active" : ""}`}
          title="Highlight repetition"
          aria-label="Highlight repetition"
          onMouseDown={prevent}
          onClick={handleToggleRepetition}
        >
          <Shuffle size={14} />
        </button>
        {highlightInfo && (
          <span className="write-highlight-info">
            {highlightInfo.message || `${highlightInfo.count} found`}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span className="write-word-count">
          {wordCount || 0} {wordCount === 1 ? "word" : "words"}
        </span>
        {isChecking ? (
          <span className="write-checking-indicator">Analyzing...</span>
        ) : null}
      </div>
      <div
        ref={editorRef}
        className="write-editor-area"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder="Start writing your essay here..."
        spellCheck
      />

      <PowerVerbsPopover
        isOpen={verbsOpen}
        anchorEl={verbsBtnRef.current}
        previewRef={editorRef}
        targetWord={verbTargetWord}
        onClose={() => setVerbsOpen(false)}
        onVerbApplied={() => handleInput()}
      />

      <LexisModal
        isOpen={lexisOpen}
        onClose={() => setLexisOpen(false)}
        detectedLexis={[]}
        initialView="az"
      />
    </div>
  );
}
