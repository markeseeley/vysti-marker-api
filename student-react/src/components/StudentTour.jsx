import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";


const TOUR_HIDE_KEY = "vysti_student_tour_hide";
const TOUR_DONE_KEY = "vysti_student_tour_completed";
const STUDENT_HELPERS_DISABLED_KEY = "vysti_student_helpers_disabled";

// ── Pre-upload tour (unchanged) ──────────────────────────────────────

const preUploadTourSteps = [
  {
    anchor: "#mode",
    title: "Assignment type",
    body: "Choose your assignment type so Vysti applies the right marking rules."
  },
  {
    anchor: "#assignmentName",
    title: "Track your drafts",
    body: "Name your assignment and number each draft to track your progress over time."
  },
  {
    anchor: "#dropZone",
    title: "Upload your essay",
    body: "Drag and drop your .docx file here, or click to browse. Then click \u2018Mark my essay\u2019 to get started."
  }
];

// ── Post-upload tour (unchanged) ─────────────────────────────────────

const postUploadTourSteps = [
  {
    anchor: "#checkBtn",
    title: "Mark my essay",
    body: "Click here to generate a preview and revise your work."
  }
];

// ── Interactive post-preview tour (gamified walkthrough) ─────────────

const interactivePostPreviewSteps = [
  // 0 — Score explanation
  {
    type: "info",
    anchor: ".dz-score-pill",
    title: "Your essay results",
    body:
      "Here are your results. Remember, Vysti checks mechanics, structure, and style \u2014 not the content of your ideas. That\u2019s for your teacher to evaluate."
  },
  // 1 — ACTION: click a metric bar to expand the zoom-in chart
  {
    type: "action",
    anchor: "#mostCommonIssuesWrap",
    actionKey: "mciExpandedMetric",
    title: "Your focus areas",
    body:
      "Each bar groups your issues by metric. Click any bar to zoom in and see the specific issues inside it.",
    nudgeText: "Click one of the colored bars in the chart above.",
    highlightClass: "tour-highlight-glow"
  },
  // 2 — Explain the zoom-in chart (must click a bar to advance)
  {
    type: "info",
    anchor: ".mci-detail",
    actionKey: "mciSelectedLabel",
    requireAction: true,
    title: "Zoom-in chart",
    body:
      "Each bar here is a specific writing issue Vysti found. Click any bar to start guided revision practice for that issue."
  },
  // 3 — Revision practice (auto-selects a repairable issue, advances on Check rewrite)
  {
    type: "info",
    anchor: "#revisionPracticeCard",
    selectRevisionLabel: true,
    actionKey: "checkRewriteResult",
    requireAction: true,
    title: "Let\u2019s repair an issue",
    body:
      "We\u2019ve picked an issue you can fix right here. Read the guidance on the left, then edit the sentence on the right. When you\u2019re ready, click \u2018Check rewrite\u2019."
  },
  // 4 — Dynamic: approved → listen for Apply to Preview, rejected → listen for Check rewrite
  {
    type: "info",
    anchor: "#revisionPracticeCard",
    actionKey: "applyToPreview",
    requireAction: true,
    highlightChild: ".apply-to-preview-btn",
    title: "Nice work!",
    body:
      "Your rewrite was approved! Now click the highlighted \u2018Apply to Preview\u2019 button to replace the original sentence in your essay.",
    _rejectedTitle: "Not quite \u2014 try again",
    _rejectedBody:
      "Your rewrite wasn\u2019t approved yet. Edit the sentence and click \u2018Check rewrite\u2019 again.",
    _rejectedActionKey: "checkRewriteResult"
  },
  // 5 — Celebration!
  {
    type: "info",
    anchor: "#revisionPracticeCard",
    title: "You repaired your first issue!",
    body:
      "That\u2019s exactly how revision works in Vysti: pick an issue, rewrite, check, apply. Keep going through more issues to improve your score.",
    celebrate: true
  },
  // 6 — Preview explanation
  {
    type: "info",
    anchor: "#markedPreviewCard",
    title: "Your Preview",
    body:
      "Your issues are color-coded to match their meters: red for Power, blue for Analysis, green for Cohesion, and gold for Precision. You can revise directly here or use the Revision Practice guidance above."
  },
  // 7 — Recheck
  {
    type: "info",
    anchor: "#recheckDocumentBtn",
    highlightClass: "tour-highlight-glow",
    title: "Recheck your essay",
    body:
      "After making changes, click \u2018Recheck my essay\u2019 to update your scores and see your improvement."
  },
  // 8 — Download wrap-up
  {
    type: "info",
    anchor: "#recheckDocumentBtn",
    title: "Keep improving",
    body:
      "Keep revising and rechecking to improve your scores. When you\u2019re happy, download your revised essay as a clean .docx file. You\u2019ve got this!"
  }
];

// ─────────────────────────────────────────────────────────────────────

const shouldShowStudentHelpers = () => {
  return ![
    STUDENT_HELPERS_DISABLED_KEY,
    TOUR_DONE_KEY,
    TOUR_HIDE_KEY
  ].some((key) => { try { return localStorage.getItem(key) === "1"; } catch { return false; } });
};

function StudentTour(
  { authReady, selectedFile, markedBlob, onTourNeedsRevisionLabel },
  ref
) {
  const [activeSteps, setActiveSteps] = useState(preUploadTourSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [arrowDirClass, setArrowDirClass] = useState("tour-arrow-down");
  const [hideChecked, setHideChecked] = useState(false);

  // Interactive tour state
  const [waitingForAction, setWaitingForAction] = useState(null);
  const [lastCheckApproved, setLastCheckApproved] = useState(null);
  const [showNudge, setShowNudge] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const startedThisLoad = useRef(false);
  const anchorRef = useRef(null);
  const highlightedRef = useRef(null);
  const highlightedChildRef = useRef(null);
  const popoverRef = useRef(null);
  const arrowRef = useRef(null);
  const rafRef = useRef(0);
  const followupTimeoutRef = useRef(0);
  const nudgeTimeoutRef = useRef(0);

  // Refs for stable access in useImperativeHandle
  const waitingForActionRef = useRef(null);
  const currentStepIndexRef = useRef(0);
  const activeStepsRef = useRef(preUploadTourSteps);
  const isOpenRef = useRef(false);

  useEffect(() => { waitingForActionRef.current = waitingForAction; }, [waitingForAction]);
  useEffect(() => { currentStepIndexRef.current = currentStepIndex; }, [currentStepIndex]);
  useEffect(() => { activeStepsRef.current = activeSteps; }, [activeSteps]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove(
        "tour-highlight", "tour-highlight-glow", "tour-action-target"
      );
      highlightedRef.current = null;
    }
    if (highlightedChildRef.current) {
      highlightedChildRef.current.classList.remove("tour-highlight-glow");
      highlightedChildRef.current = null;
    }
  }, []);

  const closeTour = useCallback(
    (reason) => {
      try {
        if (reason === "hide") {
          localStorage.setItem(STUDENT_HELPERS_DISABLED_KEY, "1");
          localStorage.setItem(TOUR_DONE_KEY, "1");
        } else if (reason === "completed") {
          localStorage.setItem(TOUR_DONE_KEY, "1");
        }
      } catch {}
      clearHighlight();
      setIsOpen(false);
      setHideChecked(false);
      setWaitingForAction(null);
      setShowNudge(false);
      setShowCelebration(false);
      setLastCheckApproved(null);
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
    if (markedBlob) {
      return interactivePostPreviewSteps;
    }
    if (selectedFile) {
      return postUploadTourSteps;
    }
    return preUploadTourSteps;
  }, [markedBlob, selectedFile]);

  const startTourAt = useCallback(
    (index, { force = false, steps = preUploadTourSteps } = {}) => {
      if (!force && !shouldShowStudentHelpers()) return;
      setActiveSteps(steps);
      setCurrentStepIndex(index);
      setHideChecked(false);
      setWaitingForAction(null);
      setLastCheckApproved(null);
      setShowNudge(false);
      setShowCelebration(false);
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

  // ── Imperative handle (includes notifyAction) ─────────────────────

  useImperativeHandle(
    ref,
    () => ({
      restartTour: ({ force = true } = {}) => {
        closeTour("dismissed");
        startTourForCurrentState({ force });
      },
      dismissTour: () => closeTour("dismissed"),

      notifyAction: (actionKey, payload) => {
        if (!isOpenRef.current || !waitingForActionRef.current) return;

        if (actionKey !== waitingForActionRef.current) {
          // Wrong action — show nudge
          setShowNudge(true);
          clearTimeout(nudgeTimeoutRef.current);
          nudgeTimeoutRef.current = setTimeout(() => setShowNudge(false), 3000);
          return;
        }

        // Correct action — advance
        setShowNudge(false);
        setWaitingForAction(null);

        if (actionKey === "checkRewriteResult") {
          setLastCheckApproved(payload?.approved === true);
        }

        const nextIdx = currentStepIndexRef.current + 1;
        if (nextIdx >= activeStepsRef.current.length) {
          closeTour("completed");
        } else {
          setCurrentStepIndex(nextIdx);
        }
      }
    }),
    [closeTour, startTourForCurrentState]
  );

  // ── Step resolution + highlight ───────────────────────────────────

  const retryTimerRef = useRef(0);

  useEffect(() => {
    clearTimeout(retryTimerRef.current);
    if (!isOpen) return;

    const attempt = (retries) => {
      const step = activeSteps[currentStepIndex];
      // Try to find this step's exact anchor first
      const exactAnchor = step ? document.querySelector(step.anchor) : null;

      if (exactAnchor) {
        // Found the anchor for the current step — use it directly
      } else if (retries > 0) {
        // Anchor not in DOM yet — wait and retry (don't skip ahead)
        retryTimerRef.current = window.setTimeout(() => attempt(retries - 1), 150);
        return;
      } else {
        // Retries exhausted — fall back to scanning forward
        const resolved = resolveStep(currentStepIndex, activeSteps);
        if (!resolved) {
          closeTour("dismissed");
          return;
        }
        if (resolved.index !== currentStepIndex) {
          setCurrentStepIndex(resolved.index);
          return;
        }
      }

      const anchor = exactAnchor || document.querySelector(step.anchor);
      if (!anchor) { closeTour("dismissed"); return; }

      anchorRef.current = anchor;
      clearHighlight();

      // Auto-select a repairable label for the revision walkthrough
      if (step?.selectRevisionLabel) {
        onTourNeedsRevisionLabel?.();
      }

      // Apply highlight class
      const hlClass = step?.highlightClass || "tour-highlight";
      anchor.classList.add(hlClass);

      // Highlight a child element (e.g. a specific button inside the anchor)
      if (step?.highlightChild) {
        const child = anchor.querySelector(step.highlightChild);
        if (child) {
          child.classList.add("tour-highlight-glow");
          highlightedChildRef.current = child;
        }
      }

      // Set waiting state for any step with an actionKey
      // When rejected, _rejectedActionKey overrides the default actionKey
      const effectiveActionKey = (lastCheckApproved === false && step?._rejectedActionKey)
        || step?.actionKey
        || null;
      if (effectiveActionKey) {
        if (step.type === "action") {
          anchor.classList.add("tour-action-target");
        }
        setWaitingForAction(effectiveActionKey);
      } else {
        setWaitingForAction(null);
      }

      // Celebration
      if (step?.celebrate) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }

      highlightedRef.current = anchor;
      anchor.scrollIntoView({ block: "center", behavior: "smooth" });
      positionPopover();

      // Re-position after scroll/animation settles
      clearTimeout(followupTimeoutRef.current);
      followupTimeoutRef.current = window.setTimeout(() => {
        positionPopover();
      }, 400);
    };

    attempt(6); // up to ~900ms of retries for async-mounted anchors

    return () => clearTimeout(retryTimerRef.current);
  }, [
    activeSteps,
    clearHighlight,
    closeTour,
    currentStepIndex,
    isOpen,
    lastCheckApproved,
    resolveStep,
    positionPopover
  ]);

  // ── Reposition on scroll/resize ───────────────────────────────────

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

  // ── Document click listener for wrong-click nudges during actions ─

  useEffect(() => {
    if (!waitingForAction || !isOpen) return undefined;

    const handleDocumentClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (highlightedRef.current?.contains(e.target)) return;

      setShowNudge(true);
      clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = setTimeout(() => setShowNudge(false), 3000);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [waitingForAction, isOpen]);

  // ── Auto-start on page load ───────────────────────────────────────

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

  // ── Cleanup ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearTimeout(followupTimeoutRef.current);
      clearTimeout(nudgeTimeoutRef.current);
      cancelAnimationFrame(rafRef.current);
      clearHighlight();
    };
  }, [clearHighlight]);

  // ── Render ────────────────────────────────────────────────────────

  if (!isOpen) {
    return null;
  }

  const currentStep = activeSteps[currentStepIndex];
  const isAction = currentStep?.type === "action";
  const stepLabel = `${currentStepIndex + 1} of ${activeSteps.length}`;

  // Dynamic body for step 4 (rejection loop)
  let displayTitle = currentStep?.title;
  let displayBody = currentStep?.body;
  const isRejected = currentStep?._rejectedTitle && lastCheckApproved === false;
  if (isRejected) {
    displayTitle = currentStep._rejectedTitle;
    displayBody = currentStep._rejectedBody;
  }

  // Hide Next button when step requires the action to be completed (but show "Try again" on rejection)
  const hideNextBtn = isAction || (currentStep?.requireAction && !isRejected);

  return (
    <>
      <div className="tour-overlay" />

      {showCelebration ? (
        <div className="tour-celebration" aria-hidden="true">
          <div className="tour-celebration-burst" />
        </div>
      ) : null}

      <div
        className={`tour-popover${showCelebration ? " tour-popover-celebrate" : ""}`}
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
          &times;
        </button>
        <div className={`tour-arrow ${arrowDirClass}`} ref={arrowRef} />

        {showCelebration ? (
          <div className="tour-celebrate-icon" aria-hidden="true">&#127881;</div>
        ) : null}

        <div className="tour-title">{displayTitle}</div>
        <div className="tour-body">{displayBody}</div>

        {showNudge && currentStep?.nudgeText ? (
          <div className="tour-nudge" role="alert">
            {currentStep.nudgeText}
          </div>
        ) : null}

        <div className="tour-footer">
          <div className="tour-step">{stepLabel}</div>

          {!hideNextBtn ? (
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
          ) : null}

          {!hideNextBtn ? (
            <button
              className="tour-primary-btn"
              type="button"
              onClick={() => {
                if (hideChecked) {
                  closeTour("hide");
                  return;
                }

                // Rejection: loop back to previous step (revision)
                if (currentStep?._rejectedTitle && lastCheckApproved === false) {
                  setLastCheckApproved(null);
                  setCurrentStepIndex(currentStepIndex - 1);
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
              {currentStep?._rejectedTitle && lastCheckApproved === false
                ? "Try again"
                : currentStepIndex + 1 >= activeSteps.length
                  ? "Done"
                  : "Next"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default forwardRef(StudentTour);
