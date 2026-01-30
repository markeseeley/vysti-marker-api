export default function AssignmentTracker({ assignmentName, onChange }) {
  return (
    <div className="assignment-tracker-block">
      <div className="assignment-tracker-title">
        <span className="label-row">Assignment Tracker</span>
      </div>
      <label className="visually-hidden" htmlFor="assignmentName">
        Assignment name (optional)
      </label>
      <input
        type="text"
        id="assignmentName"
        value={assignmentName}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Assignment 01"
        aria-label="Assignment name (optional)"
      />
    </div>
  );
}
