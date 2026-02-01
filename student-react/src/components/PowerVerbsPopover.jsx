import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  copyToClipboard,
  loadPowerVerbs,
  replaceSelectionInContainer,
  replaceSelectionInTextarea,
  shuffleList
} from "../lib/powerVerbs";

const PAGE_SIZE = 12;

export default function PowerVerbsPopover({
  isOpen,
  anchorEl,
  previewRef,
  textareaRef,
  onClose,
  onVerbApplied
}) {
  const popoverRef = useRef(null);
  const [verbs, setVerbs] = useState([]);
  const [definitions, setDefinitions] = useState(new Map());
  const [pageIndex, setPageIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    loadPowerVerbs().then(({ list, map }) => {
      const shuffled = shuffleList(list);
      setVerbs(shuffled);
      setDefinitions(map);
      setError(shuffled.length ? "" : "Power verbs list failed to load. Check power_verbs_2025.json path.");
    });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || !popoverRef.current) return;
    const popover = popoverRef.current;
    const rect = anchorEl.getBoundingClientRect();
    const gap = 10;
    const padding = 12;
    popover.style.display = "flex";
    popover.style.visibility = "hidden";
    const popRect = popover.getBoundingClientRect();
    const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
    let top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    if (top < padding) top = padding;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.visibility = "visible";
  }, [anchorEl, isOpen, pageIndex, verbs]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (anchorEl?.contains(event.target)) return;
      onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handleReposition = () => {
      if (!popoverRef.current || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const gap = 10;
      const padding = 12;
      const popRect = popoverRef.current.getBoundingClientRect();
      const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
      let top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
      if (top < padding) top = padding;
      popoverRef.current.style.top = `${Math.round(top)}px`;
      popoverRef.current.style.left = `${Math.round(left)}px`;
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [anchorEl, isOpen, onClose]);

  const pages = useMemo(() => {
    const list = verbs || [];
    const result = [];
    for (let i = 0; i < list.length; i += PAGE_SIZE) {
      result.push(list.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [verbs]);

  const currentPage = pages[pageIndex] || [];

  const handleVerbClick = async (verb) => {
    if (!verb) return;
    const container = previewRef?.current;
    const textarea = textareaRef?.current;
    let applied = false;
    if (textarea) {
      applied = replaceSelectionInTextarea(textarea, verb);
    } else if (container) {
      applied = replaceSelectionInContainer(container, verb);
    }
    if (!applied) {
      await copyToClipboard(verb);
      setFeedback("Copied.");
    } else {
      setFeedback("Applied.");
      if (!textarea) {
        onVerbApplied?.(verb);
      }
    }
    window.setTimeout(() => setFeedback(""), 1200);
  };

  if (!isOpen) return null;

  return createPortal(
    <div ref={popoverRef} className="tour-popover power-verbs-popover">
      <div className="power-verbs-popover-header">
        <div className="power-verbs-popover-title">Power Verbs</div>
        <button
          className="power-verbs-popover-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="power-verbs-feedback">{feedback}</div>
      {error ? (
        <div className="power-verbs-popover-grid">{error}</div>
      ) : (
        <div className="power-verbs-popover-grid">
          {currentPage.map((entry) => {
            const verb = entry?.verb || "";
            const definition =
              entry?.definition || definitions.get(String(verb).toLowerCase()) || "";
            return (
              <button
                key={verb}
                type="button"
                className="power-verb-card"
                onClick={() => handleVerbClick(verb)}
              >
                <div className="power-verb-card-header">
                  <div className="power-verb-card-verb">{verb}</div>
                  <div className="power-verb-card-copied">{feedback}</div>
                </div>
                <div className="power-verb-card-def">{definition}</div>
              </button>
            );
          })}
        </div>
      )}
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
    </div>,
    document.body
  );
}
