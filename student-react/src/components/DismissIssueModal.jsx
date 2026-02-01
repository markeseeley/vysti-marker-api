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
  onNoAsk
}) {
  const cancelRef = useRef(null);
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState("");

  const isOther = reason === "other";
  const otherCount = otherText.length;
  const isValid = Boolean(reason && (!isOther || otherText.trim().length > 0));

  const resetState = () => {
    setReason("");
    setOtherText("");
    setError("");
  };

  useEffect(() => {
    if (!isOpen) return;
    resetState();
    window.requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });
  }, [isOpen]);

  const handleConfirm = (dontAskAgain) => {
    if (!reason) {
      setError("Please select a reason to continue.");
      return;
    }
    if (isOther && !otherText.trim()) {
      setError("Please add a brief explanation for “Other.”");
      return;
    }
    setError("");
    if (dontAskAgain) {
      onNoAsk?.({ reason, other_text: otherText.trim() || null });
      return;
    }
    onConfirm?.({ reason, other_text: otherText.trim() || null });
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
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
          onCancel?.();
        }
      }}
      onKeyDown={onKeyDown}
    >
      <div className="modal-card dismiss-modal">
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
              placeholder="Briefly explain..."
              value={otherText}
              onChange={(event) => {
                setOtherText(event.target.value);
              }}
            />
            <div className="dismiss-char-count">{charCountLabel}</div>
          </>
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
            disabled={!isValid}
          >
            Do not ask me again
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={() => handleConfirm(false)}
            disabled={!isValid}
          >
            Dismiss issue
          </button>
        </div>
      </div>
    </div>
  );
}
