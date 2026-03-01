import { useState } from "react";
import { CircleCheck, Clock, XCircle, FileText } from "./Icons";

export default function TeacherDocumentsCard({
  files,
  activeDocId,
  onSelectDocument,
  dispatch,
  activeStudentName,
  activeAssignmentName,
  onStudentNameChange,
  onAssignmentNameChange,
  onFieldBlur,
}) {
  const markedFiles = files.filter((f) => f.status === "marked");
  const [savedFlash, setSavedFlash] = useState(false);

  const handleBlur = () => {
    if (onFieldBlur) {
      onFieldBlur();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  };

  if (!markedFiles.length) return null;

  return (
    <>
      <h3 className="teacher-doc-list-title">Documents</h3>

      {/* Per-document student name + assignment name */}
      <div className="teacher-doc-fields">
        <label className="teacher-doc-field">
          <span className="teacher-doc-field-label">Student</span>
          <input
            type="text"
            name="doc-student-name"
            placeholder="Jane Smith"
            value={activeStudentName || ""}
            onChange={(e) => onStudentNameChange?.(e.target.value)}
            onBlur={handleBlur}
          />
        </label>
        <label className="teacher-doc-field">
          <span className="teacher-doc-field-label">Assignment</span>
          <input
            type="text"
            name="doc-assignment-name"
            placeholder="Homework 01"
            value={activeAssignmentName || ""}
            onChange={(e) => onAssignmentNameChange?.(e.target.value)}
            onBlur={handleBlur}
          />
        </label>
        {savedFlash && (
          <span className="teacher-doc-saved-flash">Saved</span>
        )}
      </div>

      <div className="teacher-doc-list">
        {markedFiles.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`teacher-doc-row doc-row-clickable${f.id === activeDocId ? " doc-row-active" : ""}`}
            onClick={() => onSelectDocument(f.id)}
          >
            <span className="doc-row-icon">
              {f.id === activeDocId ? (
                <CircleCheck size={14} />
              ) : f.reviewStatus === "complete" ? (
                <CircleCheck size={14} className="status-complete" />
              ) : f.reviewStatus === "in_progress" ? (
                <Clock size={14} className="status-in-progress" />
              ) : (
                <XCircle size={14} className="status-unseen" />
              )}
            </span>
            <span className="doc-row-info">
              <span className="doc-row-name">{f.studentName || f.fileName}</span>
            </span>
            <span className="doc-row-status status-marked">
              {f.score != null ? `${f.score}%` : `${f.totalLabels} issue${f.totalLabels === 1 ? "" : "s"}`}
            </span>
            {dispatch && (
              <span
                className={`doc-status-toggle status-toggle-${f.reviewStatus || "unseen"}`}
                role="button"
                tabIndex={0}
                title={`Status: ${f.reviewStatus || "unseen"} \u2014 click to change`}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = { unseen: "in_progress", in_progress: "complete", complete: "unseen" };
                  dispatch({
                    type: "SET_REVIEW_STATUS",
                    id: f.id,
                    status: next[f.reviewStatus || "unseen"],
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    const next = { unseen: "in_progress", in_progress: "complete", complete: "unseen" };
                    dispatch({
                      type: "SET_REVIEW_STATUS",
                      id: f.id,
                      status: next[f.reviewStatus || "unseen"],
                    });
                  }
                }}
              >
                {f.reviewStatus === "complete" ? (
                  <CircleCheck size={12} />
                ) : f.reviewStatus === "in_progress" ? (
                  <Clock size={12} />
                ) : (
                  <XCircle size={12} />
                )}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
