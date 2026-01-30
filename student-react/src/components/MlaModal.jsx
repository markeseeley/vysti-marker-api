import { useEffect, useRef, useState } from "react";

export default function MlaModal({
  isOpen,
  initialAssignmentName = "",
  onCancel,
  onDownloadAsIs,
  onDownloadMla,
  isBusy = false
}) {
  const nameRef = useRef(null);
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [date, setDate] = useState("");
  const [assignment, setAssignment] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setAssignment(initialAssignmentName || "");
    window.requestAnimationFrame(() => {
      nameRef.current?.focus();
    });
  }, [initialAssignmentName, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Download revised essay</h3>
        <label>
          <span>Name</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Teacher</span>
          <input
            type="text"
            value={teacher}
            onChange={(event) => setTeacher(event.target.value)}
          />
        </label>
        <label>
          <span>Date</span>
          <input
            type="text"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          <span>Assignment</span>
          <input
            type="text"
            value={assignment}
            onChange={(event) => setAssignment(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={onDownloadAsIs}
            disabled={isBusy}
          >
            Download as-is
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={() =>
              onDownloadMla?.({
                name: name.trim(),
                teacher: teacher.trim(),
                date: date.trim(),
                assignment: assignment.trim()
              })
            }
            disabled={isBusy}
          >
            Add MLA + Download
          </button>
        </div>
      </div>
    </div>
  );
}
