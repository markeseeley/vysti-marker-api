export default function AssignmentBuilder({
  assignmentName,
  onAssignmentNameChange,
  applyToAll,
  onApplyToAllChange,
  showApplyToAll,
}) {
  return (
    <div className="assignment-builder">
      <label>
        Assignment name
        <input
          type="text"
          id="assignmentName"
          placeholder="Homework 01"
          value={assignmentName}
          onChange={(e) => onAssignmentNameChange(e.target.value)}
        />
      </label>

      {showApplyToAll && (
        <label className="apply-to-all-row">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => onApplyToAllChange(e.target.checked)}
          />
          Apply to all uploaded files
        </label>
      )}
    </div>
  );
}
