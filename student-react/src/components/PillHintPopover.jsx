import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { setPillHintShown, wasPillHintShown } from "../lib/pillHintStorage";

export default function PillHintPopover({
  isOpen,
  mode = "anchor",
  anchorEl,
  data,
  nav,
  dismissKey,
  onClose
}) {
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || mode !== "anchor" || !anchorEl || !popoverRef.current) return;
    const popover = popoverRef.current;
    const rect = anchorEl.getBoundingClientRect();
    const gap = 12;
    const padding = 12;
    popover.style.display = "block";
    popover.style.visibility = "hidden";
    const popRect = popover.getBoundingClientRect();
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    if (top + popRect.height > window.innerHeight - padding) {
      top = rect.top - gap - popRect.height;
    }
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.visibility = "visible";
  }, [anchorEl, isOpen, mode, data]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (mode === "anchor" && anchorEl?.contains(event.target)) return;
      onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handleReposition = () => {
      if (!popoverRef.current || !anchorEl || mode !== "anchor") return;
      const rect = anchorEl.getBoundingClientRect();
      const gap = 12;
      const padding = 12;
      const popRect = popoverRef.current.getBoundingClientRect();
      let top = rect.bottom + gap;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
      if (top + popRect.height > window.innerHeight - padding) {
        top = rect.top - gap - popRect.height;
      }
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
  }, [anchorEl, isOpen, mode, onClose]);

  useEffect(() => {
    if (isOpen && dismissKey && wasPillHintShown(dismissKey)) {
      onClose?.();
    }
  }, [dismissKey, isOpen, onClose]);

  if (!isOpen || !data) return null;
  const { title, body, subheader } = data;
  const showNav = nav?.count && nav?.count > 1;

  const popover = (
    <>
      {mode === "modal" ? <div className="pill-hint-backdrop" /> : null}
      <div
        ref={popoverRef}
        className={`tour-popover pill-hint-popover${mode === "modal" ? " is-modal" : ""}`}
        role="dialog"
        aria-modal={mode === "modal" ? "true" : "false"}
      >
        <button
          className="tour-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="tour-arrow" />
        <div className="tour-title">{title || "Hint"}</div>
        <div className="tour-body">{body || ""}</div>
        {subheader ? <div className="pill-hint-subheader">{subheader}</div> : null}
        <div className="pill-hint-footer">
          {showNav ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => nav?.go?.(-1)}
                disabled={nav?.canPrev ? !nav.canPrev() : false}
              >
                Prev
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => nav?.go?.(1)}
                disabled={nav?.canNext ? !nav.canNext() : false}
              >
                Next
              </button>
            </div>
          ) : null}
          <button
            className="secondary-btn"
            type="button"
            onClick={() => {
              if (dismissKey) setPillHintShown(dismissKey);
              onClose?.();
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(popover, document.body);
}
