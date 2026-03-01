import { useCallback, useEffect, useRef } from "react";
import { Italic, AlignCenter, IndentIncrease } from "./Icons";

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
}) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  const extractText = useCallback(() => {
    const el = editorRef.current;
    if (!el) return "";
    return el.innerText || "";
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
    const current = el.innerText || "";
    if (current !== text) {
      if (!text) {
        el.innerHTML = "";
      } else {
        // Use safe DOM API to avoid HTML injection from user text
        el.innerHTML = "";
        const fragment = document.createDocumentFragment();
        text.split("\n").forEach((line) => {
          const p = document.createElement("p");
          if (line) {
            p.textContent = line;
          } else {
            p.appendChild(document.createElement("br"));
          }
          fragment.appendChild(p);
        });
        el.appendChild(fragment);
      }
    }
  }, [text]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        insertTab(editorRef.current, handleInput);
      }
    },
    [handleInput]
  );

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
    </div>
  );
}
