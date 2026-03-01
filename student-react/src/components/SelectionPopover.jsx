import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyHighlight, applyRedStrikethrough, applySpelling, applyWordChoice, applyConfusion, applySquiggly, applyUnderline, applyArrowMark, applyCustomSuperscript, applyPositiveMark, applyNegativeMark, applyTaggedHighlight, removeTeacherMark } from "./PreviewToolbar";
import { DEFAULT_ENABLED } from "../lib/teacherToolkit";
import { loadStamps, saveStamps, resetStamps } from "../lib/teacherStamps";

/**
 * Floating popover that appears when the teacher selects text in the preview.
 * Provides quick-access marking tools: highlights, strikethrough, sp, squiggly,
 * comment (arrow-style annotation), and remove/eraser.
 */
export default function SelectionPopover({ previewRef, onEdit, onBeforeEdit, toolkitEnabled }) {
  const enabled = toolkitEnabled || DEFAULT_ENABLED;
  const has = (id) => enabled.includes(id);

  const [pos, setPos] = useState(null); // { top, left, below }
  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingSpan, setEditingSpan] = useState(null); // span being edited (null = new comment)
  const [customSupMode, setCustomSupMode] = useState(false);
  const [customSupText, setCustomSupText] = useState("");
  const [stampMode, setStampMode] = useState(false);
  const [stampEditing, setStampEditing] = useState(false);
  const [newStampText, setNewStampText] = useState("");
  const [stamps, setStamps] = useState(() => loadStamps());
  const [inlineStampMode, setInlineStampMode] = useState(false);
  const [inlineCustomText, setInlineCustomText] = useState("");
  const [taggedHlMode, setTaggedHlMode] = useState(false);
  const [taggedHlColor, setTaggedHlColor] = useState("hl");
  const [taggedHlLabel, setTaggedHlLabel] = useState("");
  const popoverRef = useRef(null);
  const savedRangeRef = useRef(null);
  const inputModeRef = useRef(false); // true when any input mode is active
  const isDraggingRef = useRef(false);

  // Keep ref in sync with state so event handlers see latest value
  useEffect(() => { inputModeRef.current = commentMode || customSupMode || stampMode || inlineStampMode || taggedHlMode; }, [commentMode, customSupMode, stampMode, inlineStampMode, taggedHlMode]);

  // Listen for mouseup to detect text selection
  useEffect(() => {
    const container = previewRef?.current;
    if (!container) return;

    const show = () => {
      if (inputModeRef.current) return; // Don't reposition while typing comment
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        return;
      }

      // Suppress popover when selection starts inside a yellow label —
      // the dblclick dismiss handler should handle these, not the popover.
      let anchor = sel.anchorNode;
      if (anchor?.nodeType === 3) anchor = anchor.parentNode;
      if (anchor?.closest?.(".vysti-preview-hit[data-vysti-label]")) {
        setPos(null);
        return;
      }

      // Also suppress on engine-coloured highlights (cyan, gray, etc.)
      // that don't carry .vysti-preview-hit. Inserting teacher marks inside
      // these produces broken export output.
      let el = anchor;
      while (el && el !== container) {
        if (el.nodeType === 1 && !el.hasAttribute("data-vysti-teacher-highlight")) {
          const bg = (el.style?.backgroundColor || "").toLowerCase();
          if (bg === "cyan" || bg === "lightgray" || bg === "red" || bg === "yellow" ||
              bg.startsWith("rgb(0, 255, 255") || bg.startsWith("rgb(211, 211, 211") ||
              bg.startsWith("rgb(255, 0, 0") || bg.startsWith("rgb(255, 255, 0")) {
            setPos(null);
            return;
          }
        }
        el = el.parentElement;
      }

      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }

      const popH = 40;
      const gap = 8;
      const above = rect.top - popH - gap;
      const below = above < 8;

      setPos({
        top: below ? rect.bottom + gap : above,
        left: rect.left + rect.width / 2,
        below,
      });
    };

    const hide = () => {
      if (inputModeRef.current) return;
      setPos(null);
    };

    // Click on existing comment (pencil indicator or highlighted span) → edit mode
    const handleCommentEdit = (e) => {
      // Check if clicked on a pencil indicator
      let indicator = e.target.closest("[data-vysti-comment-indicator='1']");
      let span = null;
      if (indicator) {
        // The comment span is the previous sibling of the indicator
        span = indicator.previousElementSibling;
        if (!span || !span.hasAttribute("data-vysti-comment")) span = null;
      }
      // Or check if clicked directly on a comment span
      if (!span) {
        span = e.target.closest("span[data-vysti-comment]");
      }
      if (!span) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = span.getBoundingClientRect();
      const popH = 40;
      const gap = 8;
      const above = rect.top - popH - gap;
      const below = above < 8;

      setEditingSpan(span);
      setCommentText(span.getAttribute("data-vysti-comment") || "");
      setCommentMode(true);
      setPos({
        top: below ? rect.bottom + gap : above,
        left: rect.left + rect.width / 2,
        below,
      });

      // Clear any text selection so it doesn't interfere
      window.getSelection()?.removeAllRanges();
    };

    // Dismiss when clicking outside the popover during any input mode
    const handleOutsideClick = (e) => {
      if (!inputModeRef.current) return; // default mode uses hide() via container mousedown
      const pop = document.querySelector(".teacher-selection-popover");
      if (pop && pop.contains(e.target)) return;
      setPos(null);
    };

    container.addEventListener("mouseup", show);
    container.addEventListener("mousedown", hide);
    container.addEventListener("scroll", hide, true);
    container.addEventListener("click", handleCommentEdit);
    document.addEventListener("mousedown", handleOutsideClick);

    const onSelChange = () => {
      if (inputModeRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPos(null);
    };
    document.addEventListener("selectionchange", onSelChange);

    return () => {
      container.removeEventListener("mouseup", show);
      container.removeEventListener("mousedown", hide);
      container.removeEventListener("scroll", hide, true);
      container.removeEventListener("click", handleCommentEdit);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [previewRef]);

  // Reset all input modes when popover hides
  useEffect(() => {
    if (!pos) {
      setCommentMode(false);
      setCommentText("");
      setEditingSpan(null);
      setCustomSupMode(false);
      setCustomSupText("");
      setStampMode(false);
      setStampEditing(false);
      setNewStampText("");
      setInlineStampMode(false);
      setInlineCustomText("");
      setTaggedHlMode(false);
      setTaggedHlColor("hl");
      setTaggedHlLabel("");
      savedRangeRef.current = null;
    }
  }, [pos]);

  // Clamp horizontal position to viewport after render
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || !pos) return;
    // After drag, position is already final — just apply directly
    if (pos._dragged) {
      el.style.left = `${pos.left}px`;
      return;
    }
    const w = el.offsetWidth;
    const half = w / 2;
    const pad = 8;
    let left = pos.left - half;
    if (left < pad) left = pad;
    if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
    el.style.left = `${left}px`;
  }, [pos, commentMode, customSupMode, stampMode, inlineStampMode, taggedHlMode]);

  // Apply tool then dismiss popover
  const act = (fn, ...args) => {
    onBeforeEdit?.(); // save undo snapshot before DOM modification
    fn(previewRef?.current, ...args, onEdit);
    setPos(null);
  };

  // ── Comment mode ──

  const savedTextRef = useRef("");

  const saveSelectionForInputMode = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      if (!sel.isCollapsed) {
        savedTextRef.current = sel.toString().trim();
      }
    }
  };

  const handleCommentClick = () => {
    saveSelectionForInputMode();
    setCommentMode(true);
  };

  const handleCustomSupClick = () => {
    saveSelectionForInputMode();
    setCustomSupMode(true);
  };

  const handleCustomSupSubmit = () => {
    const label = customSupText.trim();
    if (!label || !savedRangeRef.current) return;
    onBeforeEdit?.();
    const container = previewRef?.current;
    if (!container) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    applyCustomSuperscript(container, label, onEdit);
    savedRangeRef.current = null;
    setPos(null);
  };

  const handleStampClick = () => {
    saveSelectionForInputMode();
    setStampMode(true);
  };

  const handleInlineStampClick = () => {
    saveSelectionForInputMode();
    setInlineStampMode(true);
  };

  const applyInlineStamp = (text) => {
    if (!text || !savedRangeRef.current) return;
    onBeforeEdit?.();
    const container = previewRef?.current;
    if (!container) { setPos(null); return; }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    const range = savedRangeRef.current;
    // Collapse to end of selection so we insert after
    range.collapse(false);
    const inlineSpan = document.createElement("span");
    inlineSpan.textContent = ` ${text} `;
    inlineSpan.style.color = "#D32F2F";
    inlineSpan.style.fontWeight = "bold";
    inlineSpan.style.backgroundColor = "rgba(255, 235, 59, 0.5)";
    inlineSpan.style.borderRadius = "2px";
    inlineSpan.style.padding = "0 2px";
    inlineSpan.style.fontSize = "inherit";
    inlineSpan.style.fontFamily = "inherit";
    inlineSpan.setAttribute("data-vysti-teacher-highlight", "1");
    inlineSpan.setAttribute("data-vysti-inline-comment", "1");
    range.insertNode(inlineSpan);
    sel.removeAllRanges();
    savedRangeRef.current = null;
    savedTextRef.current = "";
    onEdit?.();
    setPos(null);
  };

  const handleTaggedHlClick = () => {
    saveSelectionForInputMode();
    setTaggedHlMode(true);
  };

  const TAG_COLORS = [
    { code: "hl", label: "Aqua", css: "rgba(0, 210, 255, 0.45)", swatch: "#00D2FF" },
    { code: "g", label: "Gray", css: "rgba(156, 163, 175, 0.35)", swatch: "#9CA3AF" },
    { code: "gr", label: "Green", css: "rgba(34, 197, 94, 0.35)", swatch: "#22C55E" },
  ];

  const handleTaggedHlSubmit = () => {
    if (!savedRangeRef.current) return;
    const colorObj = TAG_COLORS.find((c) => c.code === taggedHlColor) || TAG_COLORS[0];
    const label = taggedHlLabel.trim();
    onBeforeEdit?.();
    const container = previewRef?.current;
    if (!container) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    applyTaggedHighlight(container, colorObj.css, colorObj.code, label, onEdit);
    savedRangeRef.current = null;
    setPos(null);
  };

  const handleCommentSubmit = () => {
    const text = commentText.trim();
    if (!text) return;
    onBeforeEdit?.(); // save undo snapshot before DOM modification

    // ── Edit existing comment ──
    if (editingSpan) {
      editingSpan.setAttribute("data-vysti-comment", text);
      editingSpan.title = text;
      // Update the pencil indicator tooltip too
      const indicator = editingSpan.nextElementSibling;
      if (indicator && indicator.getAttribute("data-vysti-comment-indicator") === "1") {
        indicator.title = text;
      }
      setEditingSpan(null);
      onEdit?.();
      setPos(null);
      return;
    }

    // ── New comment ──
    if (!savedRangeRef.current) return;

    const container = previewRef?.current;
    if (!container) return;

    // Restore the saved selection range
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    const range = savedRangeRef.current;

    // Create wrapper span around selected text — comment stored as data attribute
    const wrapper = document.createElement("span");
    wrapper.style.backgroundColor = "rgba(255, 200, 50, 0.35)";
    wrapper.style.borderBottom = "2px solid #A90D22";
    wrapper.style.borderRadius = "2px";
    wrapper.style.fontSize = "inherit";
    wrapper.style.fontFamily = "inherit";
    wrapper.setAttribute("data-vysti-teacher-highlight", "1");
    wrapper.setAttribute("data-vysti-comment", text);
    wrapper.title = text; // tooltip shows full comment on hover

    // Store the anchor text we captured at click time — surroundContents can
    // lose the text inside nested docx-preview spans, so this is our safety net.
    const capturedAnchor = savedTextRef.current || range.toString().trim();
    wrapper.setAttribute("data-vysti-comment-anchor", capturedAnchor);

    try {
      range.surroundContents(wrapper);
    } catch {
      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
    }

    // Superscript indicator (maroon) — click to edit comment
    const indicator = document.createElement("sup");
    indicator.textContent = "\u270E"; // ✎ pencil
    indicator.style.color = "#A90D22";
    indicator.style.fontSize = "0.7em";
    indicator.style.marginLeft = "2px";
    indicator.style.padding = "2px 3px";
    indicator.style.cursor = "pointer";
    indicator.title = text;
    indicator.setAttribute("data-vysti-teacher-highlight", "1");
    indicator.setAttribute("data-vysti-comment-indicator", "1");
    wrapper.after(indicator);

    sel.removeAllRanges();
    savedRangeRef.current = null;
    savedTextRef.current = "";
    onEdit?.();
    setPos(null);
  };

  const handleCommentDelete = () => {
    if (!editingSpan) return;
    onBeforeEdit?.(); // save undo snapshot before DOM modification
    // Remove the pencil indicator
    const indicator = editingSpan.nextElementSibling;
    if (indicator && indicator.getAttribute("data-vysti-comment-indicator") === "1") {
      indicator.remove();
    }
    // Unwrap the comment span — keep the text content
    const parent = editingSpan.parentNode;
    while (editingSpan.firstChild) {
      parent.insertBefore(editingSpan.firstChild, editingSpan);
    }
    editingSpan.remove();
    setEditingSpan(null);
    onEdit?.();
    setPos(null);
  };

  // ── Remove mark ──

  const handleRemove = () => {
    onBeforeEdit?.(); // save undo snapshot before DOM modification
    removeTeacherMark(previewRef?.current, onEdit);
    setPos(null);
  };

  const prevent = (e) => e.preventDefault();

  // ── Drag handle for stamp panel ──
  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    isDraggingRef.current = true;
    el.style.cursor = "grabbing";

    const onMove = (ev) => {
      el.style.left = `${ev.clientX - offsetX}px`;
      el.style.top = `${ev.clientY - offsetY}px`;
    };
    const onUp = (ev) => {
      isDraggingRef.current = false;
      el.style.cursor = "";
      const finalLeft = ev.clientX - offsetX;
      const finalTop = ev.clientY - offsetY;
      setPos((prev) => prev ? { ...prev, top: finalTop, left: finalLeft, _dragged: true } : prev);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={`teacher-selection-popover${pos.below ? " popover-below" : ""}`}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={prevent}
    >
      {commentMode ? (
        <div className="popover-comment-row">
          <textarea
            className="popover-comment-input"
            placeholder="Type comment…"
            value={commentText}
            rows={1}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(); }
              if (e.key === "Escape") setPos(null);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <button
            type="button"
            className="popover-comment-submit"
            onClick={handleCommentSubmit}
          >
            {editingSpan ? "Save" : "Add"}
          </button>
          {editingSpan && (
            <button
              type="button"
              className="popover-comment-delete"
              title="Delete comment"
              onClick={handleCommentDelete}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              </svg>
            </button>
          )}
        </div>
      ) : customSupMode ? (
        <div className="popover-comment-row">
          <input
            className="popover-custom-sup-input"
            type="text"
            name="custom-sup-label"
            placeholder="Label text…"
            maxLength={20}
            value={customSupText}
            onChange={(e) => setCustomSupText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleCustomSupSubmit(); }
              if (e.key === "Escape") setPos(null);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <button type="button" className="popover-comment-submit" onClick={handleCustomSupSubmit}>Add</button>
        </div>
      ) : stampMode ? (
        <div className="popover-stamp-panel">
          <div className="popover-stamp-drag-handle" onMouseDown={handleDragStart}>
            <span className="popover-stamp-drag-grip" />
          </div>
          <div className="popover-stamp-grid">
            {stamps.map((stamp, idx) => (
              stampEditing ? (
                <span key={stamp + idx} className="popover-stamp-chip popover-stamp-chip--editing">
                  {stamp}
                  <button type="button" className="popover-stamp-remove" title="Remove stamp" onClick={() => {
                    const next = stamps.filter((_, i) => i !== idx);
                    setStamps(next);
                    saveStamps(undefined, next);
                  }}>&times;</button>
                </span>
              ) : (
                <button
                  key={stamp + idx}
                  type="button"
                  className="popover-stamp-chip"
                  onClick={() => {
                    onBeforeEdit?.();
                    const container = previewRef?.current;
                    if (!container || !savedRangeRef.current) { setPos(null); return; }
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedRangeRef.current);
                    const range = savedRangeRef.current;
                    const capturedAnchor = savedTextRef.current || range.toString().trim();
                    const wrapper = document.createElement("span");
                    wrapper.style.backgroundColor = "rgba(255, 200, 50, 0.35)";
                    wrapper.style.borderBottom = "2px solid #A90D22";
                    wrapper.style.borderRadius = "2px";
                    wrapper.style.fontSize = "inherit";
                    wrapper.style.fontFamily = "inherit";
                    wrapper.setAttribute("data-vysti-teacher-highlight", "1");
                    wrapper.setAttribute("data-vysti-comment", stamp);
                    wrapper.title = stamp;
                    wrapper.setAttribute("data-vysti-comment-anchor", capturedAnchor);
                    try { range.surroundContents(wrapper); }
                    catch { const f = range.extractContents(); wrapper.appendChild(f); range.insertNode(wrapper); }
                    const indicator = document.createElement("sup");
                    indicator.textContent = "\u270E";
                    indicator.style.color = "#A90D22";
                    indicator.style.fontSize = "0.7em";
                    indicator.style.marginLeft = "2px";
                    indicator.style.padding = "2px 3px";
                    indicator.style.cursor = "pointer";
                    indicator.title = stamp;
                    indicator.setAttribute("data-vysti-teacher-highlight", "1");
                    indicator.setAttribute("data-vysti-comment-indicator", "1");
                    wrapper.after(indicator);
                    sel.removeAllRanges();
                    savedRangeRef.current = null;
                    savedTextRef.current = "";
                    onEdit?.();
                    setPos(null);
                  }}
                >
                  {stamp}
                </button>
              )
            ))}
          </div>
          {stampEditing && (
            <form className="popover-stamp-add-row" onSubmit={(e) => {
              e.preventDefault();
              const text = newStampText.trim();
              if (!text || stamps.includes(text)) return;
              const next = [...stamps, text];
              setStamps(next);
              saveStamps(undefined, next);
              setNewStampText("");
            }}>
              <input
                type="text"
                className="popover-stamp-input"
                name="new-stamp-phrase"
                placeholder="New stamp phrase..."
                value={newStampText}
                onChange={(e) => setNewStampText(e.target.value)}
                maxLength={60}
                autoFocus
              />
              <button type="submit" className="popover-comment-submit" disabled={!newStampText.trim()}>Add</button>
            </form>
          )}
          <div className="popover-stamp-footer">
            <button type="button" className="popover-stamp-edit-toggle" onClick={() => setStampEditing((v) => !v)}>
              {stampEditing ? "Done" : "Edit stamps"}
            </button>
            {stampEditing && (
              <button type="button" className="popover-stamp-reset" onClick={() => {
                const defaults = resetStamps();
                setStamps(defaults);
              }}>
                Reset defaults
              </button>
            )}
          </div>
        </div>
      ) : inlineStampMode ? (
        <div className="popover-stamp-panel popover-inline-stamp-panel">
          <div className="popover-stamp-drag-handle" onMouseDown={handleDragStart}>
            <span className="popover-stamp-drag-grip" />
          </div>
          <form className="popover-inline-custom-row" onSubmit={(e) => {
            e.preventDefault();
            const text = inlineCustomText.trim();
            if (text) applyInlineStamp(text);
          }}>
            <input
              type="text"
              className="popover-stamp-input"
              name="inline-comment"
              placeholder="Type inline comment..."
              value={inlineCustomText}
              onChange={(e) => setInlineCustomText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setPos(null); }}
              onMouseDown={(e) => e.stopPropagation()}
              maxLength={120}
              autoFocus
            />
            <button type="submit" className="popover-comment-submit" disabled={!inlineCustomText.trim()}>Add</button>
          </form>
          <div className="popover-stamp-grid">
            {stamps.map((stamp, idx) => (
              stampEditing ? (
                <span key={stamp + idx} className="popover-stamp-chip popover-stamp-chip--editing">
                  {stamp}
                  <button type="button" className="popover-stamp-remove" title="Remove stamp" onClick={() => {
                    const next = stamps.filter((_, i) => i !== idx);
                    setStamps(next);
                    saveStamps(undefined, next);
                  }}>&times;</button>
                </span>
              ) : (
                <button
                  key={stamp + idx}
                  type="button"
                  className="popover-stamp-chip popover-stamp-chip--inline"
                  onClick={() => applyInlineStamp(stamp)}
                >
                  {stamp}
                </button>
              )
            ))}
          </div>
          {stampEditing && (
            <form className="popover-stamp-add-row" onSubmit={(e) => {
              e.preventDefault();
              const text = newStampText.trim();
              if (!text || stamps.includes(text)) return;
              const next = [...stamps, text];
              setStamps(next);
              saveStamps(undefined, next);
              setNewStampText("");
            }}>
              <input
                type="text"
                className="popover-stamp-input"
                name="new-stamp-phrase"
                placeholder="New stamp phrase..."
                value={newStampText}
                onChange={(e) => setNewStampText(e.target.value)}
                maxLength={60}
                autoFocus
              />
              <button type="submit" className="popover-comment-submit" disabled={!newStampText.trim()}>Add</button>
            </form>
          )}
          <div className="popover-stamp-footer">
            <button type="button" className="popover-stamp-edit-toggle" onClick={() => setStampEditing((v) => !v)}>
              {stampEditing ? "Done" : "Edit stamps"}
            </button>
            {stampEditing && (
              <button type="button" className="popover-stamp-reset" onClick={() => {
                const defaults = resetStamps();
                setStamps(defaults);
              }}>
                Reset defaults
              </button>
            )}
          </div>
        </div>
      ) : taggedHlMode ? (
        <div className="popover-comment-row popover-tagged-hl-row">
          <div className="popover-tagged-hl-swatches">
            {TAG_COLORS.map((c) => (
              <button
                key={c.code}
                type="button"
                className={`popover-swatch-btn${taggedHlColor === c.code ? " active" : ""}`}
                title={c.label}
                onClick={() => setTaggedHlColor(c.code)}
              >
                <span className="popover-swatch" style={{ background: c.swatch }} />
              </button>
            ))}
          </div>
          <input
            className="popover-tagged-hl-input"
            type="text"
            name="tagged-hl-label"
            placeholder="Label (optional)"
            maxLength={20}
            value={taggedHlLabel}
            onChange={(e) => setTaggedHlLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleTaggedHlSubmit(); }
              if (e.key === "Escape") setPos(null);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <button type="button" className="popover-comment-submit" onClick={handleTaggedHlSubmit}>Add</button>
        </div>
      ) : (
        <>
          {/* Aqua highlight */}
          {has("aqua") && (
            <button
              type="button"
              className="popover-btn popover-btn-aqua"
              title="Aqua highlight — mark for attention"
              onClick={() => act(applyHighlight, "rgba(0, 210, 255, 0.45)")}
            >
              <span className="popover-swatch" style={{ background: "#00D2FF" }} />
            </button>
          )}

          {/* Gray highlight */}
          {has("gray") && (
            <button
              type="button"
              className="popover-btn popover-btn-gray"
              title="Gray highlight — de-emphasize"
              onClick={() => act(applyHighlight, "rgba(156, 163, 175, 0.35)")}
            >
              <span className="popover-swatch" style={{ background: "#9CA3AF" }} />
            </button>
          )}

          {/* Green highlight (positive) */}
          {has("green") && (
            <button
              type="button"
              className="popover-btn popover-btn-green"
              title="Green highlight — positive feedback"
              onClick={() => act(applyHighlight, "rgba(34, 197, 94, 0.35)")}
            >
              <span className="popover-swatch" style={{ background: "#22C55E" }} />
            </button>
          )}

          {/* Tagged highlight (highlight + label) */}
          {has("taggedHighlight") && (
            <button
              type="button"
              className="popover-btn popover-btn-tagged-hl"
              title="Highlight with a custom label"
              onClick={handleTaggedHlClick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}

          {/* Red strikethrough */}
          {has("strike") && (
            <button
              type="button"
              className="popover-btn popover-btn-strike"
              title="Red strikethrough — suggest removal"
              onClick={() => act(applyRedStrikethrough)}
            >
              <span className="popover-swatch popover-swatch-strike" style={{ background: "#EF4444" }} />
            </button>
          )}

          {/* Underline (solid) */}
          {has("underline") && (
            <button
              type="button"
              className="popover-btn popover-btn-underline"
              title="Solid underline"
              onClick={() => act(applyUnderline)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
                <line x1="4" y1="21" x2="20" y2="21" />
              </svg>
            </button>
          )}

          {(has("sp") || has("wc") || has("squiggly") || has("confusion")) && <div className="popover-sep" />}

          {/* sp — Spelling mark */}
          {has("sp") && (
            <button
              type="button"
              className="popover-btn popover-btn-sp"
              title="Mark spelling error"
              onClick={() => act(applySpelling)}
            >
              <span className="popover-sp-label">sp</span>
            </button>
          )}

          {/* wc — Word choice */}
          {has("wc") && (
            <button
              type="button"
              className="popover-btn popover-btn-sp"
              title="Word choice issue"
              onClick={() => act(applyWordChoice)}
            >
              <span className="popover-sp-label">wc</span>
            </button>
          )}

          {/* Squiggly underline */}
          {has("squiggly") && (
            <button
              type="button"
              className="popover-btn popover-btn-squiggly"
              title="Squiggly underline — grammar/style"
              onClick={() => act(applySquiggly)}
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
                <path d="M1 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" stroke="#D32F2F" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}

          {/* Confusion (???) */}
          {has("confusion") && (
            <button
              type="button"
              className="popover-btn popover-btn-confusion"
              title="Confusion — meaning unclear"
              onClick={() => act(applyConfusion)}
            >
              <span className="popover-confusion-label">???</span>
            </button>
          )}

          {has("customSup") && <div className="popover-sep" />}

          {/* Custom superscript label */}
          {has("customSup") && (
            <button
              type="button"
              className="popover-btn popover-btn-custom-sup"
              title="Add a custom label"
              onClick={handleCustomSupClick}
            >
              <span className="popover-custom-sup-label">a<sup>x</sup></span>
            </button>
          )}

          {(has("comment") || has("stamps")) && <div className="popover-sep" />}

          {/* Comment */}
          {has("comment") && (
            <button
              type="button"
              className="popover-btn popover-btn-comment"
              title="Add a comment"
              onClick={handleCommentClick}
            >
              <span style={{ fontSize: "14px", lineHeight: 1 }}>{"\uD83D\uDCAC"}</span>
            </button>
          )}

          {/* Quick stamps */}
          {has("stamps") && (
            <button
              type="button"
              className="popover-btn popover-btn-stamps"
              title="Quick stamps — common feedback"
              onClick={handleStampClick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2 2M19.5 8.5l.5.5M17 17l2 2M15 6.5l6.5 6.5a2.12 2.12 0 0 1 0 3L16 21.5a2.12 2.12 0 0 1-3 0L6.5 15a2.12 2.12 0 0 1 0-3L13 5.5" />
              </svg>
            </button>
          )}

          {/* Inline stamps — insert feedback text inline */}
          {has("inlineStamps") && (
            <button
              type="button"
              className="popover-btn popover-btn-inline-stamps"
              title="Inline stamps — insert feedback text"
              onClick={handleInlineStampClick}
            >
              <span className="popover-inline-stamps-label">Aa</span>
            </button>
          )}

          {/* Arrow — insert → inline */}
          {has("arrow") && (
            <button
              type="button"
              className="popover-btn popover-btn-arrow"
              title="Insert arrow (→)"
              onClick={() => act(applyArrowMark)}
            >
              <span style={{ color: "#A90D22", fontWeight: "bold", fontSize: "14px", lineHeight: 1 }}>{"\u2192"}</span>
            </button>
          )}

          {(has("smile") || has("frown")) && <div className="popover-sep" />}
          {has("smile") && (
            <button
              type="button"
              className="popover-btn popover-btn-positive"
              title="Nice work"
              onClick={() => { onBeforeEdit?.(); applyPositiveMark(previewRef?.current, "\u263A", onEdit, { sup: false, fontSize: "12px" }); setPos(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
          )}
          {has("frown") && (
            <button
              type="button"
              className="popover-btn popover-btn-negative"
              title="Needs work"
              onClick={() => { onBeforeEdit?.(); applyNegativeMark(previewRef?.current, "\u2639", onEdit, { sup: false, fontSize: "12px" }); setPos(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
          )}

          {/* Remove / eraser */}
          {has("remove") && (
            <button
              type="button"
              className="popover-btn popover-btn-remove"
              title="Remove this mark"
              onClick={handleRemove}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.9-9.9c1-1 2.5-1 3.4 0l5.1 5.1c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" />
                <path d="m5 11 9 9" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
