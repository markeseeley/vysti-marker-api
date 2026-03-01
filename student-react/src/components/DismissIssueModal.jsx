import { useEffect, useMemo, useRef, useState } from "react";

const REASONS = [
  { value: "no_issue", label: "There is no issue" },
  { value: "unable_to_repair", label: "Unable to repair issue" },
  { value: "unclear_guidance", label: "Unclear student guidance for issue" },
  { value: "other", label: "Other" }
];

export default function DismissIssueModal({
  isOpen,
  onCancel,
  onConfirm,
  onNoAsk,
  onDismissAll,
  dismissAllCount,
  dismissLabel
}) {
  const cancelRef = useRef(null);
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState("");
  const [dismissAll, setDismissAll] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const isOther = reason === "other";
  const otherCount = otherText.length;
  const isValid = Boolean(reason && (!isOther || otherText.trim().length > 0));
  const showDismissAll = dismissAllCount > 1 && onDismissAll;

  const resetState = () => {
    setReason("");
    setOtherText("");
    setError("");
    setDismissAll(false);
    setConfirmingAll(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    resetState();
    window.requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });
  }, [isOpen]);

  const buildResult = () => ({
    reason,
    other_text: otherText.trim() || null
  });

  const handleConfirm = (dontAskAgain) => {
    if (!reason) {
      setError("Please select a reason to continue.");
      return;
    }
    if (isOther && !otherText.trim()) {
      setError("Please add a brief explanation for \u201cOther.\u201d");
      return;
    }
    setError("");
    // If "dismiss all" is checked, show confirmation first
    if (dismissAll) {
      setConfirmingAll(true);
      return;
    }
    if (dontAskAgain) {
      onNoAsk?.(buildResult());
      return;
    }
    onConfirm?.(buildResult());
  };

  const handleDismissAllConfirm = () => {
    onDismissAll?.(buildResult());
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmingAll) {
        setConfirmingAll(false);
      } else {
        onCancel?.();
      }
    }
  };

  const charCountLabel = useMemo(() => `${otherCount}/280`, [otherCount]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismissIssueTitle"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (confirmingAll) setConfirmingAll(false);
          else onCancel?.();
        }
      }}
      onKeyDown={onKeyDown}
    >
      <div className="modal-card dismiss-modal">
        {confirmingAll ? (
          <>
            <div id="dismissIssueTitle" className="modal-title">
              Dismiss all {dismissAllCount} issues
            </div>
            <div className="dismiss-all-warning">
              <p>
                This will dismiss all <strong>{dismissAllCount}</strong> remaining{" "}
                <strong>{dismissLabel}</strong> issues for this session.
              </p>
              <p className="dismiss-all-caution">
                Dismissed issues will stay hidden, even after rechecking. Use "Dismissed issues" to restore them.
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setConfirmingAll(false)}
              >
                Go back
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={handleDismissAllConfirm}
              >
                Dismiss all {dismissAllCount}
              </button>
            </div>
          </>
        ) : (
          <>
            <div id="dismissIssueTitle" className="modal-title">
              Dismiss issue
            </div>
            <div className="modal-question">Why are you dismissing this issue?</div>
            <div className="modal-reasons">
              {REASONS.map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="dismissReason"
                    value={item.value}
                    checked={reason === item.value}
                    onChange={() => {
                      setReason(item.value);
                      setError("");
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            {isOther ? (
              <>
                <textarea
                  maxLength={280}
                  className="dismiss-other"
                  name="dismiss-other-reason"
                  placeholder="Briefly explain..."
                  value={otherText}
                  onChange={(event) => {
                    setOtherText(event.target.value);
                  }}
                />
                <div className="dismiss-char-count">{charCountLabel}</div>
              </>
            ) : null}
            {showDismissAll ? (
              <label className="dismiss-all-option">
                <input
                  type="checkbox"
                  name="dismiss-all"
                  checked={dismissAll}
                  onChange={(e) => setDismissAll(e.target.checked)}
                />
                Dismiss all {dismissAllCount} &ldquo;{dismissLabel}&rdquo; issues
              </label>
            ) : null}
            {error ? <div className="modal-error">{error}</div> : null}
            <div className="modal-actions">
              <button
                ref={cancelRef}
                className="secondary-btn"
                type="button"
                onClick={() => onCancel?.()}
              >
                Cancel
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => handleConfirm(true)}
                disabled={!isValid || dismissAll}
              >
                Do not ask me again
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={() => handleConfirm(false)}
                disabled={!isValid}
              >
                {dismissAll ? `Dismiss all ${dismissAllCount}` : "Dismiss issue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
