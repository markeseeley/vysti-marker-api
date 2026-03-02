import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bold as BoldIcon, Italic, AlignCenter, IndentIncrease, Undo, Underline as UnderlineIcon, SmileFace, FrownFace, Download } from "./Icons";
import { MARKING_TOOLS, DEFAULT_ENABLED } from "../lib/teacherToolkit";

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function undoEditFallback(container) {
  if (!container) return;
  container.focus();
  document.execCommand("undo");
}

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

function toggleBold(container, onEdit) {
  if (!container) return;
  container.focus();
  document.execCommand("bold");
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

// ── Teacher highlight helpers ──

function findAncestorHighlightOnly(node, container) {
  while (node && node !== container) {
    if (
      node.nodeType === 1 &&
      node.hasAttribute("data-vysti-teacher-highlight") &&
      !((node.style.textDecoration || "").toLowerCase().includes("line-through")) &&
      !((node.style.textDecoration || "").toLowerCase().includes("wavy"))
    ) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

function applyHighlight(container, color, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  // If the selection is within an existing highlight-only span, replace its color
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;
  const existingHL = findAncestorHighlightOnly(ancestor, container);

  if (existingHL) {
    existingHL.style.backgroundColor = color;
    // Flatten any nested highlight-only spans (from prior nesting bugs)
    for (const nested of existingHL.querySelectorAll("span[data-vysti-teacher-highlight='1']")) {
      const td = (nested.style.textDecoration || "").toLowerCase();
      if (!td.includes("line-through") && !td.includes("wavy")) {
        while (nested.firstChild) nested.parentNode.insertBefore(nested.firstChild, nested);
        nested.remove();
      }
    }
    sel.removeAllRanges();
    onEdit?.();
    return;
  }

  const span = document.createElement("span");
  span.style.backgroundColor = color;
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  onEdit?.();
}

function applyRedStrikethrough(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.backgroundColor = "rgba(239, 68, 68, 0.25)";
  span.style.textDecoration = "line-through";
  span.style.textDecorationColor = "#D32F2F";
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  onEdit?.();
}

function applySpelling(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const sup = document.createElement("sup");
  sup.textContent = "sp";
  sup.style.color = "#D32F2F";
  sup.style.fontSize = "0.65em";
  sup.style.marginLeft = "1px";
  sup.style.fontWeight = "700";
  sup.setAttribute("data-vysti-teacher-highlight", "1");

  // Insert superscript after the selection end
  range.collapse(false);
  range.insertNode(sup);

  sel.removeAllRanges();
  onEdit?.();
}

function applyWordChoice(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const sup = document.createElement("sup");
  sup.textContent = "wc";
  sup.style.color = "#D32F2F";
  sup.style.fontSize = "0.65em";
  sup.style.marginLeft = "1px";
  sup.style.fontWeight = "700";
  sup.setAttribute("data-vysti-teacher-highlight", "1");

  range.collapse(false);
  range.insertNode(sup);

  sel.removeAllRanges();
  onEdit?.();
}

function applyConfusion(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const mark = document.createElement("span");
  mark.textContent = "???";
  mark.style.color = "#D32F2F";
  mark.style.fontSize = "12px";
  mark.style.marginLeft = "2px";
  mark.style.fontWeight = "700";
  mark.style.backgroundColor = "rgba(255, 235, 59, 0.45)";
  mark.style.borderRadius = "2px";
  mark.style.padding = "1px 3px";
  mark.style.verticalAlign = "middle";
  mark.setAttribute("data-vysti-teacher-highlight", "1");
  mark.setAttribute("data-vysti-confusion", "1");

  // Insert after the selection end
  range.collapse(false);
  range.insertNode(mark);

  sel.removeAllRanges();
  onEdit?.();
}

function applySquiggly(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.textDecoration = "underline wavy";
  span.style.textDecorationColor = "#D32F2F";
  span.style.textUnderlineOffset = "3px";
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  onEdit?.();
}

function applyPositiveMark(container, icon, onEdit, opts = {}) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.backgroundColor = "rgba(34, 197, 94, 0.25)";
  span.style.borderBottom = "2px solid #16A34A";
  span.style.borderRadius = "2px";
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");
  span.setAttribute("data-vysti-positive-mark", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  const useSup = opts.sup !== false;
  const indicator = document.createElement(useSup ? "sup" : "span");
  indicator.textContent = icon;
  indicator.style.color = "#16A34A";
  indicator.style.fontSize = opts.fontSize || (useSup ? "0.75em" : "12px");
  indicator.style.marginLeft = "2px";
  if (!useSup) indicator.style.verticalAlign = "middle";
  if (opts.fontFamily) indicator.style.fontFamily = opts.fontFamily;
  indicator.setAttribute("data-vysti-teacher-highlight", "1");
  indicator.setAttribute("data-vysti-positive-indicator", "1");
  span.after(indicator);

  sel.removeAllRanges();
  onEdit?.();
}

function applyNegativeMark(container, icon, onEdit, opts = {}) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.backgroundColor = "rgba(239, 68, 68, 0.18)";
  span.style.borderBottom = "2px solid #DC2626";
  span.style.borderRadius = "2px";
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");
  span.setAttribute("data-vysti-unhappy-mark", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  const useSup = opts.sup !== false;
  const indicator = document.createElement(useSup ? "sup" : "span");
  indicator.textContent = icon;
  indicator.style.color = "#DC2626";
  indicator.style.fontSize = opts.fontSize || (useSup ? "0.75em" : "12px");
  indicator.style.marginLeft = "2px";
  if (!useSup) indicator.style.verticalAlign = "middle";
  if (opts.fontFamily) indicator.style.fontFamily = opts.fontFamily;
  indicator.setAttribute("data-vysti-teacher-highlight", "1");
  indicator.setAttribute("data-vysti-unhappy-indicator", "1");
  span.after(indicator);

  sel.removeAllRanges();
  onEdit?.();
}

function applyUnderline(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.textDecoration = "underline";
  span.style.textDecorationColor = "#1565C0";
  span.style.textUnderlineOffset = "3px";
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");
  span.setAttribute("data-vysti-underline", "1");

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  onEdit?.();
}


function applyArrowMark(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  // Disallow arrow on engine-highlighted text.  These spans only have
  // inline background-color (cyan, lightgray, red) — no data attributes.
  // Inserting inside them nests {arrow} inside engine tokens on export,
  // producing literal "{arrow}" in the DOCX.
  const anchor = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  if (anchor) {
    const bg = (anchor.style?.backgroundColor || "").toLowerCase();
    if (bg === "cyan" || bg === "lightgray" || bg === "red" ||
        bg.startsWith("rgb(0, 255, 255") || bg.startsWith("rgb(211, 211, 211") ||
        bg.startsWith("rgb(255, 0, 0") || bg === "yellow") return;
    if (anchor.closest?.("[data-vysti-hit], .vysti-preview-hit, .vysti-arrow-label")) return;
  }

  const mark = document.createElement("span");
  mark.textContent = " \u2192 ";
  mark.style.color = "#A90D22";
  mark.style.fontWeight = "bold";
  mark.style.fontSize = "inherit";
  mark.style.fontFamily = "inherit";
  mark.setAttribute("data-vysti-teacher-highlight", "1");
  mark.setAttribute("data-vysti-arrow-mark", "1");

  // Insert after the selection end
  range.collapse(false);
  range.insertNode(mark);

  // Insert a zero-width space text node after the arrow so the cursor
  // lands in a clean node.  Without this, execCommand("bold") (red-pen
  // mode) clones the arrow span's attributes — including
  // data-vysti-arrow-mark — onto the teacher's typed text, producing a
  // "double arrow" on export.
  const buffer = document.createTextNode("\u200B");
  mark.after(buffer);

  // Place cursor inside the buffer text node
  const afterRange = document.createRange();
  afterRange.setStart(buffer, 1);
  afterRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(afterRange);

  onEdit?.();
}

function applyCustomSuperscript(container, label, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const sup = document.createElement("sup");
  sup.textContent = label;
  sup.style.color = "#D32F2F";
  sup.style.fontSize = "0.65em";
  sup.style.marginLeft = "1px";
  sup.style.fontWeight = "700";
  sup.setAttribute("data-vysti-teacher-highlight", "1");
  sup.setAttribute("data-vysti-custom-sup", "1");

  range.collapse(false);
  range.insertNode(sup);

  sel.removeAllRanges();
  onEdit?.();
}


function applyTaggedHighlight(container, color, colorCode, label, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  span.style.backgroundColor = color;
  span.style.fontSize = "inherit";
  span.style.fontFamily = "inherit";
  span.setAttribute("data-vysti-teacher-highlight", "1");
  span.setAttribute("data-vysti-tagged-hl", "1");
  span.setAttribute("data-vysti-tag-color", colorCode);

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  if (label) {
    const sup = document.createElement("sup");
    sup.textContent = label;
    sup.style.color = "#D32F2F";
    sup.style.fontSize = "0.65em";
    sup.style.marginLeft = "2px";
    sup.style.fontWeight = "700";
    sup.setAttribute("data-vysti-teacher-highlight", "1");
    sup.setAttribute("data-vysti-tag-label", "1");
    span.after(sup);
  }

  sel.removeAllRanges();
  onEdit?.();
}


export default function PreviewToolbar({ previewRef, onEdit, onBeforeEdit, onRecheck, isRechecking, hasRevisedSinceMark, worksChanged, onRefocus, onUndo, onSaveProgress, saveProgressState, saveProgressEnabled, lastSavedAt, onFinishReview, reviewStatus, isTeacher, onDownloadMarked, onDownloadRevised, isDownloading, markedBlob, isProcessing, previewError, toolkitEnabled, onToolkitChange, entitlement, onPaywall }) {
  const prevent = (e) => e.preventDefault();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const customizerRef = useRef(null);
  const gearRef = useRef(null);
  const [dragPos, setDragPos] = useState(null); // { x, y } when dragged
  const dragRef = useRef(null); // drag state: { startX, startY, origX, origY }

  // Position popover near gear button on open (fixed positioning)
  useEffect(() => {
    if (!customizerOpen || dragPos) return; // don't reset if already dragged
    const gear = gearRef.current;
    if (!gear) return;
    const rect = gear.getBoundingClientRect();
    const popW = 340;
    let x = rect.right - popW;
    let y = rect.bottom + 10;
    if (x < 8) x = 8;
    if (x + popW > window.innerWidth - 8) x = window.innerWidth - 8 - popW;
    setDragPos({ x, y });
  }, [customizerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset drag position when closing
  useEffect(() => {
    if (!customizerOpen) setDragPos(null);
  }, [customizerOpen]);

  // Close customizer on outside click
  useEffect(() => {
    if (!customizerOpen) return;
    const handler = (e) => {
      if (customizerRef.current?.contains(e.target)) return;
      if (gearRef.current?.contains(e.target)) return;
      setCustomizerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [customizerOpen]);

  // Drag handlers for customizer title bar
  const onDragStart = useCallback((e) => {
    if (!dragPos) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: dragPos.x, origY: dragPos.y };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      setDragPos({ x: d.origX + ev.clientX - d.startX, y: d.origY + ev.clientY - d.startY });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dragPos]);

  const isFreeStudent = !isTeacher && entitlement?.subscription_tier === "free";

  const enabled = toolkitEnabled || DEFAULT_ENABLED;
  const has = (id) => enabled.includes(id);

  const toggleTool = (id) => {
    const next = has(id) ? enabled.filter((t) => t !== id) : [...enabled, id];
    onToolkitChange?.(next);
  };

  // Render the actual icon used in the toolbar/popover for each tool
  const customizerIcon = (tool) => {
    switch (tool.id) {
      case "aqua":
      case "gray":
      case "green":
        return <span className="toolbar-color-swatch" style={{ background: tool.swatch }} />;
      case "strike":
        return <span className="toolbar-color-swatch toolbar-color-strike" style={{ background: tool.swatch }} />;
      case "underline":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
            <line x1="4" y1="21" x2="20" y2="21" />
          </svg>
        );
      case "sp":
        return <span className="toolbar-sp-label" style={{ fontSize: "11px" }}>sp</span>;
      case "wc":
        return <span className="toolbar-sp-label" style={{ fontSize: "11px" }}>wc</span>;
      case "squiggly":
        return (
          <svg width="16" height="12" viewBox="0 0 16 14" fill="none" aria-hidden="true">
            <path d="M1 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" stroke="#D32F2F" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        );
      case "confusion":
        return <span className="toolbar-confusion-label" style={{ fontSize: "10px" }}>???</span>;
      case "customSup":
        return <span className="popover-custom-sup-label" style={{ fontSize: "12px" }}>a<sup>x</sup></span>;
      case "taggedHighlight":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        );
      case "comment":
        return <span style={{ fontSize: "13px", lineHeight: 1 }}>{"\uD83D\uDCAC"}</span>;
      case "stamps":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2 2M19.5 8.5l.5.5M17 17l2 2M15 6.5l6.5 6.5a2.12 2.12 0 0 1 0 3L16 21.5a2.12 2.12 0 0 1-3 0L6.5 15a2.12 2.12 0 0 1 0-3L13 5.5" />
          </svg>
        );
      case "inlineStamps":
        return <span className="popover-inline-stamps-label" style={{ fontSize: "11px" }}>Aa</span>;
      case "arrow":
        return <span style={{ color: "#A90D22", fontWeight: "bold", fontSize: "13px" }}>{"\u2192"}</span>;
      case "smile":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        );
      case "frown":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        );
      case "remove":
        return (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.9-9.9c1-1 2.5-1 3.4 0l5.1 5.1c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        );
      default:
        return tool.icon ? <span className="toolkit-customizer-icon-text">{tool.icon}</span> : null;
    }
  };

  return (
    <div className="preview-toolbar">
      <button
        type="button"
        className="preview-toolbar-btn"
        title="Insert tab (Tab)"
        aria-label="Insert tab"
        onMouseDown={prevent}
        onClick={() => insertTab(previewRef?.current, onEdit)}
      >
        <IndentIncrease size={14} />
      </button>
      <div className="preview-toolbar-sep" />
      <button
        type="button"
        className="preview-toolbar-btn"
        title="Bold (Ctrl+B)"
        aria-label="Toggle bold"
        onMouseDown={prevent}
        onClick={() => toggleBold(previewRef?.current, onEdit)}
      >
        <BoldIcon size={14} />
      </button>
      <button
        type="button"
        className="preview-toolbar-btn"
        title="Italic (Ctrl+I)"
        aria-label="Toggle italic"
        onMouseDown={prevent}
        onClick={() => toggleItalic(previewRef?.current, onEdit)}
      >
        <Italic size={14} />
      </button>
      {isTeacher && has("underline") && (
        <button
          type="button"
          className="preview-toolbar-btn preview-toolbar-underline"
          title="Underline (solid)"
          aria-label="Solid underline"
          onMouseDown={prevent}
          onClick={() => { onBeforeEdit?.(); applyUnderline(previewRef?.current, onEdit); }}
        >
          <UnderlineIcon size={14} />
        </button>
      )}
      <button
        type="button"
        className="preview-toolbar-btn"
        title="Center align (Ctrl+E)"
        aria-label="Toggle center alignment"
        onMouseDown={prevent}
        onClick={() => toggleCenter(previewRef?.current, onEdit)}
      >
        <AlignCenter size={14} />
      </button>
      <div className="preview-toolbar-sep" />
      <button
        type="button"
        className="preview-toolbar-btn"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onMouseDown={prevent}
        onClick={() => onUndo ? onUndo() : undoEditFallback(previewRef?.current)}
      >
        <Undo size={14} />
      </button>
      {isTeacher && (
        <>
          <div className="preview-toolbar-sep" />
          {has("aqua") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-highlight-aqua"
              title="Highlight aqua blue"
              aria-label="Highlight selection with aqua blue"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyHighlight(previewRef?.current, "rgba(0, 210, 255, 0.45)", onEdit); }}
            >
              <span className="toolbar-color-swatch" style={{ background: "#00D2FF" }} />
            </button>
          )}
          {has("gray") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-highlight-gray"
              title="Highlight gray"
              aria-label="Highlight selection with gray"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyHighlight(previewRef?.current, "rgba(156, 163, 175, 0.35)", onEdit); }}
            >
              <span className="toolbar-color-swatch" style={{ background: "#9CA3AF" }} />
            </button>
          )}
          {has("strike") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-highlight-red"
              title="Red highlight + strikethrough"
              aria-label="Red highlight with strikethrough"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyRedStrikethrough(previewRef?.current, onEdit); }}
            >
              <span className="toolbar-color-swatch toolbar-color-strike" style={{ background: "#EF4444" }} />
            </button>
          )}
          {has("green") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-highlight-green"
              title="Green highlight (positive)"
              aria-label="Highlight selection with green"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyHighlight(previewRef?.current, "rgba(34, 197, 94, 0.35)", onEdit); }}
            >
              <span className="toolbar-color-swatch" style={{ background: "#22C55E" }} />
            </button>
          )}
          {(has("sp") || has("wc") || has("squiggly") || has("confusion")) && <div className="preview-toolbar-sep" />}
          {has("sp") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-sp"
              title="Mark spelling error (sp)"
              aria-label="Mark spelling error"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applySpelling(previewRef?.current, onEdit); }}
            >
              <span className="toolbar-sp-label">sp</span>
            </button>
          )}
          {has("wc") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-sp"
              title="Word choice issue (wc)"
              aria-label="Mark word choice issue"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyWordChoice(previewRef?.current, onEdit); }}
            >
              <span className="toolbar-sp-label">wc</span>
            </button>
          )}
          {has("squiggly") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-squiggly"
              title="Squiggly underline"
              aria-label="Red squiggly underline"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applySquiggly(previewRef?.current, onEdit); }}
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
                <path d="M1 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" stroke="#D32F2F" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}
          {has("confusion") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-confusion"
              title="Mark confusion (???)"
              aria-label="Mark confusion"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyConfusion(previewRef?.current, onEdit); }}
            >
              <span className="toolbar-confusion-label">???</span>
            </button>
          )}
          {has("arrow") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-arrow"
              title="Insert arrow (→)"
              aria-label="Insert arrow mark"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyArrowMark(previewRef?.current, onEdit); }}
            >
              <span style={{ color: "#A90D22", fontWeight: "bold", fontSize: "13px" }}>{"\u2192"}</span>
            </button>
          )}
          {(has("smile") || has("frown")) && <div className="preview-toolbar-sep" />}
          {has("smile") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-positive"
              title="Nice work (☺)"
              aria-label="Mark as nice work"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyPositiveMark(previewRef?.current, "\u263A", onEdit); }}
            >
              <SmileFace size={14} />
            </button>
          )}
          {has("frown") && (
            <button
              type="button"
              className="preview-toolbar-btn preview-toolbar-negative"
              title="Needs work (☹)"
              aria-label="Mark as needs work"
              onMouseDown={prevent}
              onClick={() => { onBeforeEdit?.(); applyNegativeMark(previewRef?.current, "\u2639", onEdit); }}
            >
              <FrownFace size={14} />
            </button>
          )}
          {/* Gear icon: customize toolkit */}
          <div className="preview-toolbar-sep" />
          <span className="toolkit-gear-anchor">
            <button
              ref={gearRef}
              type="button"
              className={`preview-toolbar-btn preview-toolbar-gear${customizerOpen ? " active" : ""}`}
              title="Customize toolkit"
              aria-label="Customize marking toolkit"
              onMouseDown={prevent}
              onClick={() => setCustomizerOpen((v) => !v)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {customizerOpen && dragPos && createPortal(
              <div
                ref={customizerRef}
                className="toolkit-customizer"
                style={{ left: dragPos.x, top: dragPos.y }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="toolkit-customizer-title" onMouseDown={onDragStart} style={{ cursor: "grab" }}>
                  Customize Toolkit
                  <button type="button" className="toolkit-customizer-close" onClick={() => setCustomizerOpen(false)} title="Close" aria-label="Close customizer">&times;</button>
                </div>
                <div className="toolkit-customizer-grid">
                  {MARKING_TOOLS.map((tool) => (
                    <label key={tool.id} className="toolkit-customizer-item">
                      <input
                        type="checkbox"
                        name={`toolkit-${tool.id}`}
                        checked={has(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                      />
                      <span className="toolkit-customizer-icon">
                        {customizerIcon(tool)}
                      </span>
                      <span>{tool.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="toolkit-customizer-reset"
                  onClick={() => onToolkitChange?.([...DEFAULT_ENABLED])}
                >
                  Reset to defaults
                </button>
              </div>,
              document.body
            )}
          </span>
        </>
      )}
      {onRefocus && (
        <>
          <div className="preview-toolbar-sep" />
          <button
            type="button"
            className="preview-toolbar-btn preview-toolbar-refocus"
            title="Clear all highlights and return to default view"
            aria-label="Refocus preview"
            onClick={onRefocus}
          >
            Refocus
          </button>
        </>
      )}
      {onRecheck && (
        <>
          <div className="preview-toolbar-sep" />
          <button
            type="button"
            className="preview-toolbar-btn preview-toolbar-recheck"
            title="Re-analyze your essay with current changes"
            aria-label="Recheck essay"
            disabled={isRechecking || (!hasRevisedSinceMark && !worksChanged)}
            onClick={onRecheck}
          >
            {isRechecking ? "Processing..." : "Recheck"}
          </button>
        </>
      )}
      {saveProgressEnabled && onSaveProgress && !isFreeStudent && (
        <>
          <div className="preview-toolbar-sep" />
          <button
            type="button"
            className={`preview-toolbar-btn preview-toolbar-save${saveProgressState === "saving" ? " is-loading" : ""}${saveProgressState === "saved" ? " save-success" : ""}${saveProgressState === "failed" ? " save-failed" : ""}`}
            title="Save your revision progress"
            aria-label="Save progress"
            disabled={saveProgressState === "saving"}
            onClick={onSaveProgress}
          >
            {saveProgressState === "saving" ? "Saving\u2026" : saveProgressState === "saved" ? "Saved!" : saveProgressState === "failed" ? "Save failed" : "Save"}
          </button>
          {lastSavedAt && saveProgressState === "idle" && (
            <span className="preview-toolbar-last-saved" title={lastSavedAt.toLocaleString()}>
              Last saved {formatTimeAgo(lastSavedAt)}
            </span>
          )}
        </>
      )}
      {onFinishReview && reviewStatus !== "completed" && (
        <button
          type="button"
          className="preview-toolbar-btn preview-toolbar-finish"
          title="Mark this review as complete"
          onClick={onFinishReview}
        >
          Finish Review
        </button>
      )}
      {reviewStatus === "completed" && (
        <span className="preview-toolbar-completed-badge">Review Complete</span>
      )}
      {onDownloadMarked && (
        <button
          type="button"
          className={`preview-toolbar-btn preview-toolbar-download${isDownloading ? " is-loading" : ""}${isFreeStudent ? " preview-toolbar-locked" : ""}`}
          title={isFreeStudent ? "Subscribe to download your essay" : "Download marked essay"}
          aria-label="Download marked essay"
          disabled={!isFreeStudent && (!markedBlob || isProcessing || isDownloading)}
          onClick={isFreeStudent ? () => onPaywall?.("download") : onDownloadMarked}
        >
          {isFreeStudent && <span className="toolbar-lock-icon" aria-hidden="true">&#x1F512;</span>}
          {isDownloading ? "Preparing\u2026" : <><Download size={13} /> <span className="preview-toolbar-download-label">Download</span></>}
        </button>
      )}
      {!isTeacher && onDownloadRevised && (
        <>
          <button
            type="button"
            className={`preview-toolbar-btn preview-toolbar-download${isDownloading ? " is-loading" : ""}${isFreeStudent ? " preview-toolbar-locked" : ""}`}
            title={isFreeStudent ? "Subscribe to download your essay" : (!hasRevisedSinceMark && markedBlob ? "Make at least one change to enable download" : "Download revised essay")}
            aria-label="Download revised essay"
            disabled={!isFreeStudent && (!markedBlob || !hasRevisedSinceMark || isDownloading || isProcessing || Boolean(previewError))}
            onClick={isFreeStudent ? () => onPaywall?.("download") : onDownloadRevised}
          >
            {isFreeStudent && <span className="toolbar-lock-icon" aria-hidden="true">&#x1F512;</span>}
            {isDownloading ? "Preparing\u2026" : <><Download size={13} /> <span className="preview-toolbar-download-label">Revised</span></>}
          </button>
        </>
      )}
    </div>
  );
}

function removeTeacherMark(container, onEdit) {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let node = sel.anchorNode;
  if (node?.nodeType === 3) node = node.parentNode;

  const _isMark = (el) =>
    el?.nodeType === 1 &&
    (el.hasAttribute("data-vysti-teacher-highlight") ||
      el.hasAttribute("data-vysti-teacher") ||
      el.classList?.contains("vysti-teacher-mark"));

  // Walk up from cursor to find the nearest teacher mark (wrapping marks)
  let mark = null;
  while (node && node !== container) {
    if (_isMark(node)) {
      mark = node;
      break;
    }
    node = node.parentNode;
  }

  // Fallback: find standalone marks (sp, wc, ???, →) inside or adjacent to selection
  if (!mark) {
    const range = sel.getRangeAt(0);
    // Check marks intersecting the selection range
    const allMarks = container.querySelectorAll(
      "[data-vysti-teacher-highlight], [data-vysti-teacher], .vysti-teacher-mark"
    );
    for (const m of allMarks) {
      if (range.intersectsNode(m)) { mark = m; break; }
    }
    // Check siblings adjacent to the anchor (for cursor near a standalone mark)
    if (!mark) {
      const anchor = sel.anchorNode;
      const _firstMarkSibling = (n) => {
        for (let sib = n?.nextSibling; sib; sib = sib.nextSibling) {
          if (sib.nodeType === 3 && !sib.textContent.trim()) continue;
          if (_isMark(sib)) return sib;
          break;
        }
        for (let sib = n?.previousSibling; sib; sib = sib.previousSibling) {
          if (sib.nodeType === 3 && !sib.textContent.trim()) continue;
          if (_isMark(sib)) return sib;
          break;
        }
        return null;
      };
      mark = _firstMarkSibling(anchor);
      if (!mark && anchor !== sel.focusNode) mark = _firstMarkSibling(sel.focusNode);
    }
  }

  if (!mark) return;

  // For paragraph marks, remove the span and clean up the paragraph border
  if (mark.hasAttribute("data-vysti-para-mark")) {
    const para = mark.closest("p");
    mark.remove();
    if (para) {
      para.style.borderLeft = "";
      para.style.paddingLeft = "";
    }
    sel.removeAllRanges();
    onEdit?.();
    return;
  }

  // For <sup> sp marks, standalone indicators (confusion, inline comment, etc.), just remove the element
  if (mark.tagName === "SUP" || mark.hasAttribute("data-vysti-confusion") || (mark.textContent || "").trim().startsWith("\u2192")) {
    mark.remove();
  } else {
    const parent = mark.parentNode;
    // Check for a following arrow annotation span or positive indicator and remove it
    let next = mark.nextSibling;
    while (next && next.nodeType === 3 && !next.textContent.trim()) {
      next = next.nextSibling;
    }
    if (
      next &&
      next.nodeType === 1 &&
      (next.hasAttribute("data-vysti-teacher-highlight") ||
        next.hasAttribute("data-vysti-teacher")) &&
      ((next.textContent || "").trim().startsWith("\u2192") ||
        next.hasAttribute("data-vysti-positive-indicator") ||
        next.hasAttribute("data-vysti-star-indicator") ||
        next.hasAttribute("data-vysti-unhappy-indicator") ||
        next.hasAttribute("data-vysti-tag-label") ||
        next.hasAttribute("data-vysti-reorder-num"))
    ) {
      next.remove();
    }
    // Also unwrap any nested highlight-only spans (from prior nesting bugs)
    for (const nested of mark.querySelectorAll("span[data-vysti-teacher-highlight='1']")) {
      const td = (nested.style.textDecoration || "").toLowerCase();
      if (!td.includes("line-through") && !td.includes("wavy")) {
        while (nested.firstChild) nested.parentNode.insertBefore(nested.firstChild, nested);
        nested.remove();
      }
    }
    // Unwrap the mark span (replace with its children)
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    mark.remove();
  }

  sel.removeAllRanges();
  onEdit?.();
}

export { insertTab, toggleCenter, applyHighlight, applyRedStrikethrough, applySpelling, applyWordChoice, applyConfusion, applySquiggly, applyUnderline, applyArrowMark, applyCustomSuperscript, applyPositiveMark, applyNegativeMark, applyTaggedHighlight, removeTeacherMark };
