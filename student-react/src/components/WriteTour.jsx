import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const TOUR_HIDE_KEY = "vysti_write_tour_hide";
const TOUR_DONE_KEY = "vysti_write_tour_completed";

// 5-step walkthrough for the Write page. Info-only (no action gates),
// mirrors the visual treatment of StudentTour so the experience feels
// consistent across Mark / Revise / Write.
const WRITE_TOUR_STEPS = [
  {
    anchor: ".write-editor-wrap",
    title: "Welcome to Write — a guide for analytic essays",
    body: (
      <>
        Write is built for one job: helping you draft an <strong>analytic</strong>{" "}
        essay using the same rules Vysti uses to mark them. Mechanics, structure,
        and style — the content of your ideas is up to you.
      </>
    ),
  },
  {
    anchor: ".write-context-fields",
    title: "1. Tell us what you’re analyzing",
    body:
      "Enter the author’s full name and the title of the text. Choose whether it’s a minor work (essay, poem, short story) or a major work (novel, play, memoir) so we format the title correctly.",
  },
  {
    anchor: ".write-editor-toolbar",
    title: "2. Tools you can use while writing",
    body:
      "The toolbar has live helpers: highlight repeated nouns, highlight literary techniques you’ve named, browse Power Verbs and Lexis for vocabulary. Italicize major-work titles, indent with tabs, center your title — everything that an analytic essay needs.",
  },
  {
    anchor: ".writing-guide",
    title: "3. Follow the Writing Guide",
    body:
      "On the right, the Writing Guide walks you through six stages — from first sentence to conclusion. Each step appears when you’re ready for it, with hints based on what you’ve written so far. Finish a step and the guide checks it off.",
  },
  {
    anchor: ".write-sidebar",
    title: "4. Issues are guidance, not gospel",
    body:
      "As you type, Vysti checks your essay against its rules and lists any issues. Click an issue to jump to it in your essay. Vysti is rule-based and accurate, but it cannot understand content (only structure) — so trust your judgment when the analysis is solid.",
    fallbackAnchor: ".write-editor-wrap",
  },
];

const WriteTour = forwardRef(function WriteTour(_, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [arrowDirClass, setArrowDirClass] = useState("tour-arrow-down");
  const [hideChecked, setHideChecked] = useState(false);

  const anchorRef = useRef(null);
  const highlightedRef = useRef(null);
  const popoverRef = useRef(null);
  const arrowRef = useRef(null);
  const rafRef = useRef(0);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove("tour-highlight");
      highlightedRef.current = null;
    }
  }, []);

  const closeTour = useCallback(
    (reason) => {
      try {
        if (reason === "hide") {
          localStorage.setItem(TOUR_DONE_KEY, "1");
          localStorage.setItem(TOUR_HIDE_KEY, "1");
        } else if (reason === "completed") {
          localStorage.setItem(TOUR_DONE_KEY, "1");
        }
      } catch {}
      clearHighlight();
      setIsOpen(false);
      setHideChecked(false);
    },
    [clearHighlight]
  );

  const resolveAnchor = useCallback((step) => {
    if (!step) return null;
    const primary = document.querySelector(step.anchor);
    if (primary) return primary;
    if (step.fallbackAnchor) return document.querySelector(step.fallbackAnchor);
    return null;
  }, []);

  const positionPopover = useCallback(() => {
    const anchorEl = anchorRef.current;
    const popoverEl = popoverRef.current;
    const arrowEl = arrowRef.current;
    if (!anchorEl || !popoverEl || !arrowEl) return;

    const gap = 12;
    const padding = 12;
    const rect = anchorEl.getBoundingClientRect();

    popoverEl.style.display = "block";
    popoverEl.style.visibility = "hidden";

    const popRect = popoverEl.getBoundingClientRect();
    const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
    let top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
    let left = rect.left + rect.width / 2 - popRect.width / 2;

    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - popRect.height - padding));

    popoverEl.style.top = `${Math.round(top)}px`;
    popoverEl.style.left = `${Math.round(left)}px`;

    setArrowDirClass(fitsBelow ? "tour-arrow-down" : "tour-arrow-up");

    const anchorCenter = rect.left + rect.width / 2;
    const arrowLeft = Math.max(16, Math.min(anchorCenter - left, popRect.width - 16));
    arrowEl.style.left = `${Math.round(arrowLeft)}px`;
    arrowEl.style.top = fitsBelow ? "-6px" : "";
    arrowEl.style.bottom = fitsBelow ? "" : "-6px";

    popoverEl.style.visibility = "visible";
  }, []);

  const schedulePosition = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(positionPopover);
  }, [positionPopover]);

  // Position highlight + popover on step change
  useEffect(() => {
    if (!isOpen) return;
    const step = WRITE_TOUR_STEPS[currentStepIndex];
    const anchor = resolveAnchor(step);
    if (!anchor) return;
    clearHighlight();
    anchor.classList.add("tour-highlight");
    highlightedRef.current = anchor;
    anchorRef.current = anchor;
    // Scroll anchor into view if off-screen
    const rect = anchor.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    schedulePosition();
  }, [isOpen, currentStepIndex, resolveAnchor, clearHighlight, schedulePosition]);

  // Reposition on window resize/scroll
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => schedulePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isOpen, schedulePosition]);

  // Auto-start once on first mount if not completed
  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(TOUR_DONE_KEY) === "1"
        || localStorage.getItem(TOUR_HIDE_KEY) === "1";
    } catch {}
    if (done) return;
    // Wait a tick so the editor + sidebar are mounted before we measure anchors
    const t = setTimeout(() => {
      setCurrentStepIndex(0);
      setIsOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  useImperativeHandle(ref, () => ({
    restartTour() {
      try {
        localStorage.removeItem(TOUR_DONE_KEY);
        localStorage.removeItem(TOUR_HIDE_KEY);
      } catch {}
      setCurrentStepIndex(0);
      setIsOpen(true);
    },
  }), []);

  if (!isOpen) return null;

  const currentStep = WRITE_TOUR_STEPS[currentStepIndex];
  const isLast = currentStepIndex + 1 >= WRITE_TOUR_STEPS.length;

  return (
    <>
      <div className="tour-overlay" onClick={() => closeTour("dismissed")} />
      <div className="tour-popover" ref={popoverRef}>
        <button
          className="tour-close"
          type="button"
          aria-label="Close tour"
          onClick={() => closeTour("dismissed")}
        >
          &times;
        </button>
        <div className={`tour-arrow ${arrowDirClass}`} ref={arrowRef} />

        <div className="tour-title">{currentStep.title}</div>
        <div className="tour-body">{currentStep.body}</div>

        <div className="tour-footer">
          <div className="tour-step">{currentStepIndex + 1} of {WRITE_TOUR_STEPS.length}</div>

          <label className="tour-checkbox-row" htmlFor="writeTourHideCheckbox">
            <input
              id="writeTourHideCheckbox"
              type="checkbox"
              checked={hideChecked}
              onChange={(e) => {
                setHideChecked(e.target.checked);
                if (e.target.checked) closeTour("hide");
              }}
            />
            Do not show again
          </label>

          <button
            className="tour-primary-btn"
            type="button"
            onClick={() => {
              if (hideChecked) { closeTour("hide"); return; }
              if (isLast) { closeTour("completed"); return; }
              setCurrentStepIndex(currentStepIndex + 1);
            }}
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
});

export default WriteTour;
