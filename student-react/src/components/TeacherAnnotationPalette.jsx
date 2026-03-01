import { useState } from "react";

const MARKS = [
  { icon: "\u2713", label: "Good" },
  { icon: "\u263A", label: "Nice work" },
  { icon: "\u2639", label: "Needs work" },
  { icon: "\u2717", label: "Revise" },
  { icon: "?", label: "Unclear" },
  { icon: "\uD83D\uDCAC", label: "" },
];

const prevent = (e) => e.preventDefault();

export default function TeacherAnnotationPalette({ position, onMark, onClose }) {
  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState("");

  if (!position) return null;

  const handleMarkClick = (icon, label) => {
    if (icon === "\uD83D\uDCAC") {
      setCommentMode(true);
      return;
    }
    onMark(icon, label);
  };

  const handleCommentSubmit = () => {
    const text = commentText.trim();
    if (!text) return;
    onMark("\uD83D\uDCAC", text);
    setCommentText("");
    setCommentMode(false);
  };

  const handleClose = () => {
    setCommentMode(false);
    setCommentText("");
    onClose();
  };

  return (
    <div
      className="teacher-annotation-palette"
      style={{ top: position.top, left: position.left }}
      onMouseDown={prevent}
    >
      {!commentMode ? (
        <div className="teacher-annotation-marks">
          {MARKS.map((m) => (
            <button
              key={m.icon}
              type="button"
              className="teacher-annotation-btn"
              title={m.label || "Comment"}
              onMouseDown={prevent}
              onClick={() => handleMarkClick(m.icon, m.label)}
            >
              {m.icon}
            </button>
          ))}
          <button
            type="button"
            className="teacher-annotation-btn teacher-annotation-close"
            title="Close"
            onMouseDown={prevent}
            onClick={handleClose}
          >
            &times;
          </button>
        </div>
      ) : (
        <div className="teacher-annotation-comment">
          <input
            type="text"
            className="teacher-annotation-input"
            name="teacher-annotation-comment"
            placeholder="Type comment…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommentSubmit();
              if (e.key === "Escape") handleClose();
            }}
            autoFocus
          />
          <button
            type="button"
            className="teacher-annotation-submit"
            onMouseDown={prevent}
            onClick={handleCommentSubmit}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
