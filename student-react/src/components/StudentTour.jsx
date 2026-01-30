import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { extractPreviewText } from "../lib/previewText";

const TOUR_HIDE_KEY = "vysti_student_tour_hide";
const TOUR_DONE_KEY = "vysti_student_tour_completed";
const STUDENT_HELPERS_DISABLED_KEY = "vysti_student_helpers_disabled";

const preUploadTourSteps = [
  {
    anchor: "#mode",
    title: "Assignment type",
    body: "Choose the assignment type so Vysti applies the right rules."
  },
  {
    anchor: "#assignmentName",
    title: "Assignment Tracker",
    body: "Name and number your draft to track progress."
  },
  {
    anchor: "#dropZone",
    title: "Upload",
    body: "Upload your .docx file here."
  }
];

const postUploadTourSteps = [
  {
    anchor: "#checkBtn",
    title: "Mark my essay",
    body: "Click here to generate a preview and revise your work."
  }
];

const postPreviewTourSteps = [
  {
    anchor: "#downloadBtn",
    title: "Download",
    body: "You can download your marked essay now or revise it first."
  },
  {
    anchor: "#mostCommonIssuesWrap",
    title: "Most Common Issues",
    body: "Hover to see an explanation. Click a bar to jump to an example."
  },
  {
    anchor: "#markedPreviewCard",
    title: "Preview",
    body:
      "Edit your document directly in this Preview. Use Zoom if you need it. Changes here aren't finalized until you recheck."
  },
  {
    anchor: "#recheckDocumentBtn",
    title: "Recheck",
    body: "After editing the Preview, click here to regenerate your feedback."
  },
  {
    anchor: "#examplesList",
    title: "Practice a revision",
    body:
      "Follow Vysti's guidance to repair your work, then click 'Check rewrite'. If it's approved, click 'Apply to Preview' to update your document."
  }
];

const shouldShowStudentHelpers = () => {
  return ![
    STUDENT_HELPERS_DISABLED_KEY,
    TOUR_DONE_KEY,
    TOUR_HIDE_KEY
  ].some((key) => localStorage.getItem(key) === "1");
};

function StudentTour(
  { authReady, selectedFile, markedBlob, hasResults, previewRef },
  ref
) {
  const [activeSteps, setActiveSteps] = useState(preUploadTourSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [arrowDirClass, setArrowDirClass] = useState("tour-arrow-down");
  const [hideChecked, setHideChecked] = useState(false);
  const startedThisLoad = useRef(false);
  const anchorRef = useRef(null);
  const highlightedRef = useRef(null);
  const popoverRef = useRef(null);
  const arrowRef = useRef(null);
  const rafRef = useRef(0);
  const followupTimeoutRef = useRef(0);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove("tour-highlight");
      highlightedRef.current = null;
    }
  }, []);

  const closeTour = useCallback(
    (reason) => {
      if (reason === "hide") {
        localStorage.setItem(STUDENT_HELPERS_DISABLED_KEY, "1");
        localStorage.setItem(TOUR_DONE_KEY, "1");
      } else if (reason === "completed") {
        localStorage.setItem(TOUR_DONE_KEY, "1");
      }
      clearHighlight();
      setIsOpen(false);
      setHideChecked(false);
    },
    [clearHighlight]
  );

  const resolveStep = useCallback((startIndex, steps) => {
    for (let i = startIndex; i < steps.length; i += 1) {
      const step = steps[i];
      const anchor = document.querySelector(step.anchor);
      if (anchor) {
        return { index: i, anchor };
      }
    }
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
    rafRef.current = requestAnimationFrame(() => {
      positionPopover();
    });
  }, [positionPopover]);

  const getTourStepsForCurrentState = useCallback(() => {
    const hasPreviewCard = Boolean(markedBlob);
    const previewText = previewRef?.current
      ? extractPreviewText(previewRef.current)
      : "";
    const hasPreviewText = Boolean(previewText);
    if (hasPreviewCard || hasPreviewText || hasResults) {
      return postPreviewTourSteps;
    }
    if (selectedFile) {
      return postUploadTourSteps;
    }
    return preUploadTourSteps;
  }, [hasResults, markedBlob, previewRef, selectedFile]);

  const startTourAt = useCallback(
    (index, { force = false, steps = preUploadTourSteps } = {}) => {
      if (!force && !shouldShowStudentHelpers()) return;
      setActiveSteps(steps);
      setCurrentStepIndex(index);
      setHideChecked(false);
      setIsOpen(true);
    },
    []
  );

  const startTourForCurrentState = useCallback(
    ({ force = false } = {}) => {
      const steps = getTourStepsForCurrentState();
      startTourAt(0, { force, steps });
    },
    [getTourStepsForCurrentState, startTourAt]
  );

  useImperativeHandle(
    ref,
    () => ({
      restartTour: ({ force = true } = {}) => {
        closeTour("dismissed");
        startTourForCurrentState({ force });
      },
      dismissTour: () => closeTour("dismissed")
    }),
    [closeTour, startTourForCurrentState]
  );

  useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveStep(currentStepIndex, activeSteps);
    if (!resolved) {
      closeTour("dismissed");
      return;
    }
    if (resolved.index !== currentStepIndex) {
      setCurrentStepIndex(resolved.index);
      return;
    }

    anchorRef.current = resolved.anchor;
    clearHighlight();
    resolved.anchor.classList.add("tour-highlight");
    highlightedRef.current = resolved.anchor;
    resolved.anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    schedulePosition();
    clearTimeout(followupTimeoutRef.current);
    followupTimeoutRef.current = window.setTimeout(() => {
      schedulePosition();
    }, 350);
  }, [
    activeSteps,
    clearHighlight,
    closeTour,
    currentStepIndex,
    isOpen,
    resolveStep,
    schedulePosition
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleReposition = () => {
      if (!isOpen) return;
      schedulePosition();
    };
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, schedulePosition]);

  useEffect(() => {
    if (!authReady || startedThisLoad.current) return;
    startedThisLoad.current = true;
    const rafId = requestAnimationFrame(() => {
      window.setTimeout(() => {
        startTourForCurrentState({ force: false });
      }, 50);
    });
    return () => cancelAnimationFrame(rafId);
  }, [authReady, startTourForCurrentState]);

  useEffect(() => {
    return () => {
      clearTimeout(followupTimeoutRef.current);
      cancelAnimationFrame(rafRef.current);
      clearHighlight();
    };
  }, [clearHighlight]);

  if (!isOpen) {
    return null;
  }

  const currentStep = activeSteps[currentStepIndex];
  const stepLabel = `${currentStepIndex + 1} of ${activeSteps.length}`;

  return (
    <>
      <div className="tour-overlay" />
      <div
        className="tour-popover"
        role="dialog"
        aria-live="polite"
        ref={popoverRef}
      >
        <button
          className="tour-close"
          type="button"
          aria-label="Close tour"
          onClick={() => closeTour("dismissed")}
        >
          ×
        </button>
        <div className={`tour-arrow ${arrowDirClass}`} ref={arrowRef} />
        <div className="tour-title">{currentStep?.title}</div>
        <div className="tour-body">{currentStep?.body}</div>
        <div className="tour-footer">
          <div className="tour-step">{stepLabel}</div>
          <label className="tour-checkbox-row" htmlFor="tourHideCheckbox">
            <input
              id="tourHideCheckbox"
              type="checkbox"
              checked={hideChecked}
              onChange={(event) => {
                const nextChecked = event.target.checked;
                setHideChecked(nextChecked);
                if (nextChecked) {
                  closeTour("hide");
                }
              }}
            />
            Do not show again
          </label>
          <button
            className="tour-primary-btn"
            type="button"
            onClick={() => {
              if (hideChecked) {
                closeTour("hide");
                return;
              }
              const nextIndex = currentStepIndex + 1;
              if (nextIndex >= activeSteps.length) {
                closeTour("completed");
                return;
              }
              setCurrentStepIndex(nextIndex);
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}

export default forwardRef(StudentTour);
