import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  conjugateVerb,
  copyToClipboard,
  detectVerbForm,
  loadPowerVerbs,
  replaceSelectionInContainer,
  replaceSelectionInTextarea,
  shuffleList,
  toBaseForm
} from "../lib/powerVerbs";

const PAGE_SIZE = 3;

export default function PowerVerbsPopover({
  isOpen,
  anchorEl,
  previewRef,
  textareaRef,
  targetWord,
  onClose,
  onVerbApplied
}) {
  const popoverRef = useRef(null);
  const [verbs, setVerbs] = useState([]);
  const [definitions, setDefinitions] = useState(new Map());
  const [pageIndex, setPageIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("shuffle"); // "shuffle" | "az"

  // Drag state — kept in refs so pointer-move doesn't trigger re-renders
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const positioned = useRef(false);

  // Detect the verb form from the highlighted weak verb (e.g. "using" → "ing")
  const verbForm = useMemo(() => detectVerbForm(targetWord), [targetWord]);

  // Match the capitalization of the target word (e.g. "Using" → title case)
  const matchCase = (verb) => {
    const tw = targetWord || "";
    if (!tw || !verb) return verb;
    if (tw === tw.toUpperCase() && tw.length > 1) return verb.toUpperCase();
    if (tw[0] === tw[0].toUpperCase() && tw[0] !== tw[0].toLowerCase()) {
      return verb[0].toUpperCase() + verb.slice(1);
    }
    return verb;
  };

  // Load verbs when opened
  useEffect(() => {
    if (!isOpen) {
      positioned.current = false;
      return;
    }
    setViewMode("shuffle");
    loadPowerVerbs().then(({ list, map }) => {
      const shuffled = shuffleList(list);
      setVerbs(shuffled);
      setDefinitions(map);
      setPageIndex(0);
      setError(shuffled.length ? "" : "Power verbs list failed to load. Check power_verbs_2025.json path.");
    }).catch(() => { setError("Power verbs list failed to load."); });
  }, [isOpen]);

  // Alphabetical groups for A-Z view
  const azGroups = useMemo(() => {
    if (viewMode !== "az" || !verbs.length) return [];
    const sorted = [...verbs].sort((a, b) =>
      toBaseForm(a.verb).localeCompare(toBaseForm(b.verb))
    );
    const groups = [];
    let currentLetter = "";
    for (const entry of sorted) {
      const letter = toBaseForm(entry.verb)[0]?.toUpperCase() || "?";
      if (letter !== currentLetter) {
        currentLetter = letter;
        groups.push({ letter, verbs: [] });
      }
      groups[groups.length - 1].verbs.push(entry);
    }
    return groups;
  }, [verbs, viewMode]);

  // Position popover at right side of .preview-stage, vertically centered
  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current || positioned.current) return;
    const popover = popoverRef.current;
    popover.style.visibility = "hidden";

    // Force a layout pass so we can measure
    const popRect = popover.getBoundingClientRect();
    const padding = 12;
    // Verb cards haven't loaded yet so measured height is too small;
    // use a minimum estimate (header + 3 cards + footer ≈ 340px)
    const estHeight = Math.max(popRect.height, 340);

    // Try to anchor to right side of the preview stage, vertically centered
    const stage = document.querySelector(".preview-stage");
    let top, left;

    if (stage) {
      const stageRect = stage.getBoundingClientRect();
      left = stageRect.right - popRect.width - padding;
      top = stageRect.top + (stageRect.height - estHeight) * 0.4;
    } else if (anchorEl) {
      // Fallback: position near anchor element
      const rect = anchorEl.getBoundingClientRect();
      const gap = 10;
      const fitsBelow = rect.bottom + gap + estHeight <= window.innerHeight;
      top = fitsBelow ? rect.bottom + gap : rect.top - gap - estHeight;
      left = rect.left + rect.width / 2 - popRect.width / 2;
    } else {
      // Last resort: center-right of viewport
      left = window.innerWidth - popRect.width - padding;
      top = (window.innerHeight - estHeight) * 0.4;
    }

    // Clamp to viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - estHeight - padding));

    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.visibility = "visible";
    positioned.current = true;
  }, [isOpen, anchorEl, verbs]);

  // Close on click-outside or Escape
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event) => {
      if (isDragging.current) return;
      if (popoverRef.current?.contains(event.target)) return;
      if (anchorEl?.contains(event.target)) return;
      onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorEl, isOpen, onClose]);

  // ── Drag-by-header ──
  const handlePointerDown = useCallback((e) => {
    // Don't drag if clicking a button in the header
    if (e.target.closest(".power-verbs-popover-close") || e.target.closest(".pv-az-btn")) return;
    const popover = popoverRef.current;
    if (!popover) return;
    e.preventDefault();
    const popRect = popover.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - popRect.left, y: e.clientY - popRect.top };
    isDragging.current = true;

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const x = ev.clientX - dragOffset.current.x;
      const y = ev.clientY - dragOffset.current.y;
      popover.style.left = `${Math.round(x)}px`;
      popover.style.top = `${Math.round(y)}px`;
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, []);

  const pages = useMemo(() => {
    const list = verbs || [];
    const result = [];
    for (let i = 0; i < list.length; i += PAGE_SIZE) {
      result.push(list.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [verbs]);

  const currentPage = pages[pageIndex] || [];

  const handleVerbClick = async (verb, conjugated) => {
    if (!verb) return;
    // Use the conjugated form for replacement/copy
    const textToInsert = conjugated || verb;
    const container = previewRef?.current;
    const textarea = textareaRef?.current;
    let applied = false;
    if (textarea) {
      applied = replaceSelectionInTextarea(textarea, textToInsert);
    } else if (container) {
      applied = replaceSelectionInContainer(container, textToInsert);
    }
    if (!applied) {
      await copyToClipboard(textToInsert);
      setFeedback("Copied.");
    } else {
      setFeedback("Applied.");
      if (!textarea) {
        onVerbApplied?.(textToInsert);
      }
    }
    window.setTimeout(() => setFeedback(""), 1200);
  };

  if (!isOpen) return null;

  const headerLabel = targetWord && verbForm !== "base"
    ? `Power Verbs \u2014 replacing \u201c${targetWord}\u201d`
    : "Power Verbs";

  return createPortal(
    <div ref={popoverRef} className="tour-popover power-verbs-popover">
      <div
        className="power-verbs-popover-header"
        onPointerDown={handlePointerDown}
      >
        <div className="pv-header-left">
          <div className="power-verbs-popover-title">{headerLabel}</div>
          <button
            className={`pv-az-btn${viewMode === "az" ? " pv-az-active" : ""}`}
            type="button"
            aria-label="Alphabetical view"
            title={viewMode === "az" ? "Back to shuffle" : "View A\u2013Z"}
            onClick={() => setViewMode((v) => v === "az" ? "shuffle" : "az")}
          >
            A-Z
          </button>
        </div>
        {feedback ? <div className="power-verbs-feedback">{feedback}</div> : null}
        <button
          className="power-verbs-popover-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>
      </div>
      {error ? (
        <div className="power-verbs-popover-grid">{error}</div>
      ) : viewMode === "az" ? (
        <div className="pv-az-scroll">
          {azGroups.map(({ letter, verbs: groupVerbs }) => (
            <div key={letter}>
              <div className="pv-az-letter">{letter}</div>
              {groupVerbs.map((entry) => {
                const base = toBaseForm(entry.verb);
                const display = matchCase(conjugateVerb(base, verbForm));
                const def = entry.definition || definitions.get(entry.verb.toLowerCase()) || "";
                return (
                  <button
                    key={entry.verb}
                    type="button"
                    className="pv-az-row"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleVerbClick(entry.verb, display)}
                  >
                    <span className="pv-az-verb">{display}</span>
                    <span className="pv-az-def">{def}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="power-verbs-popover-grid">
            {currentPage.map((entry) => {
              const rawVerb = entry?.verb || "";
              const baseVerb = toBaseForm(rawVerb);
              const definition =
                entry?.definition || definitions.get(String(rawVerb).toLowerCase()) || "";
              // Conjugate to match the highlighted weak verb's form and case
              const displayVerb = matchCase(conjugateVerb(baseVerb, verbForm));
              return (
                <button
                  key={rawVerb}
                  type="button"
                  className="power-verb-card"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleVerbClick(rawVerb, displayVerb)}
                >
                  <div className="power-verb-card-verb">{displayVerb}</div>
                  <div className="power-verb-card-def">{definition}</div>
                </button>
              );
            })}
          </div>
          <div className="power-verbs-popover-footer">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
            >
              Prev
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setPageIndex((prev) => Math.min(prev + 1, pages.length - 1))}
              disabled={pageIndex >= pages.length - 1}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
