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
  const modalRef = useRef(null);
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [date, setDate] = useState("");
  const [assignment, setAssignment] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setAssignment(initialAssignmentName || "");
    // Auto-fill today's date in MLA format (day Month year)
    if (!date) {
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleString("en-US", { month: "long" });
      const year = now.getFullYear();
      setDate(`${day} ${month} ${year}`);
    }
    window.requestAnimationFrame(() => {
      nameRef.current?.focus();
    });
  }, [initialAssignmentName, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const items = Array.from(focusable);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mla-modal-title">
      <div className="modal-card" ref={modalRef}>
        <h3 id="mla-modal-title">Download revised essay</h3>
        <label>
          <span>Name</span>
          <input
            ref={nameRef}
            type="text"
            name="mla-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Teacher</span>
          <input
            type="text"
            name="mla-teacher"
            value={teacher}
            onChange={(event) => setTeacher(event.target.value)}
          />
        </label>
        <label>
          <span>Date</span>
          <input
            type="text"
            name="mla-date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          <span>Assignment</span>
          <input
            type="text"
            name="mla-assignment"
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
            onClick={() => {
              const payload = {
                name: name.trim(),
                teacher: teacher.trim(),
                date: date.trim(),
                assignment: assignment.trim()
              };
              onDownloadMla?.(payload);
            }}
            disabled={isBusy}
          >
            Add MLA + Download
          </button>
        </div>
      </div>
    </div>
  );
}
