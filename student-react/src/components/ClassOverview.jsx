import { useMemo } from "react";
import ModeSelect from "./ModeSelect";
import ModeCard from "./ModeCard";
import AssignmentBuilder from "./AssignmentBuilder";
import WorkFields from "./WorkFields";
// import RulesPanel from "./RulesPanel";  // Preferences panel — commented out; mode defaults control rules
import TeacherDropZone from "./TeacherDropZone";
import MostCommonIssuesChart from "./MostCommonIssuesChart";
import { TEACHER_MODES, TEACHER_MODE_RULE_DEFAULTS } from "../config";
import { parseFilename } from "../lib/filenameParser";
import { FileText, CircleCheck, Clock, XCircle } from "./Icons";

export default function ClassOverview({
  state,
  dispatch,
  derived,
  onMarkAll,
  entitlement,
  onPaywall,
}) {
  const {
    mode,
    rules,
    assignmentName,
    studentName,
    applyToAll,
    classId,
    classes,
    works,
    files,
    isProcessing,
    processProgress,
    mciExpandedMetric,
  } = state;

  const { markedFiles, aggregateLabelCounts, aggregateTotalLabels } = derived;

  const modeInfo = useMemo(() => {
    const d = TEACHER_MODE_RULE_DEFAULTS[mode] || {};
    return {
      label: d.tag || mode,
      description: d.description || "",
      details: d.details || [],
    };
  }, [mode]);

  const handleFilesAdded = (newRawFiles) => {
    // Block file upload if free tier is exhausted
    if (entitlement?.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit) {
      onPaywall?.();
      return;
    }

    // Limit files to remaining free tier allowance
    let accepted = newRawFiles;
    if (entitlement?.subscription_tier === "free") {
      const remaining = Math.max(0, (entitlement.marks_limit || 1) - (entitlement.marks_used || 0) - files.length);
      if (remaining < accepted.length) {
        accepted = accepted.slice(0, remaining);
        if (remaining === 0) {
          onPaywall?.();
          return;
        }
      }
    }

    const parsed = accepted.map((file) => {
      const p = parseFilename(file.name);
      return {
        file,
        studentName: p.studentName,
        assignmentName: p.assignmentName,
      };
    });
    dispatch({ type: "ADD_FILES", payload: parsed });
  };

  const handleRemoveFile = (index) => {
    const f = files[index];
    if (f) {
      if (f.downloadUrl) URL.revokeObjectURL(f.downloadUrl);
      dispatch({ type: "REMOVE_FILE", payload: f.id });
    }
  };

  const handleClearFiles = () => {
    files.forEach((f) => {
      if (f.downloadUrl) URL.revokeObjectURL(f.downloadUrl);
    });
    dispatch({ type: "CLEAR_FILES" });
  };

  const canMark = files.length > 0 && !isProcessing;
  const hasAggregate = Object.keys(aggregateLabelCounts).length > 0;

  return (
    <>
      {/* ── marker-grid: assignment | upload / works | rules ── */}
      <div className="marker-grid">
        <section className="card assignment-card">
          <ModeSelect mode={mode} onChange={(m) => dispatch({ type: "SET_MODE", payload: m })} modes={TEACHER_MODES} />
          <ModeCard
            label={modeInfo.label}
            description={modeInfo.description}
            details={modeInfo.details}
          />

          {mode !== "sandbox" && (
            <>
              <div className="form-section-header">
                <span className="form-section-title">Select class</span>
                <span
                  className="metric-info form-section-info-trigger"
                  tabIndex={0}
                  aria-label="Progress tracking info"
                >
                  i
                  <span className="form-section-popover">
                    <strong className="form-section-popover-title">Class progress</strong>
                    <span className="form-section-popover-body">
                      Select a class to link marked essays to your students. Results will appear on the Progress page where you can track each student's improvement over time.
                    </span>
                  </span>
                </span>
              </div>

              <div className="class-select-row">
                <label style={{ flex: 1, margin: 0 }}>
                  <select
                    name="class-select"
                    value={classId}
                    onChange={(e) => dispatch({ type: "SET_CLASS_ID", payload: e.target.value })}
                  >
                    <option value="">No class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <a href="/classes.html" className="manage-classes-link">Manage classes</a>
              </div>

              <label>
                Student name
                <input
                  type="text"
                  name="student-name"
                  placeholder="Jane Smith"
                  value={studentName}
                  onChange={(e) => dispatch({ type: "SET_STUDENT_NAME", payload: e.target.value })}
                />
              </label>

              <AssignmentBuilder
                assignmentName={assignmentName}
                onAssignmentNameChange={(v) => dispatch({ type: "SET_ASSIGNMENT_NAME", payload: v })}
                applyToAll={applyToAll}
                onApplyToAllChange={(v) => dispatch({ type: "SET_APPLY_TO_ALL", payload: v })}
                showApplyToAll={files.length > 1}
              />
            </>
          )}
        </section>

        <section className="card upload-card">
          <TeacherDropZone
            onFilesAdded={handleFilesAdded}
            files={files}
            onClearFiles={handleClearFiles}
            onRemoveFile={handleRemoveFile}
            canMark={canMark}
            isProcessing={isProcessing}
            processProgress={processProgress}
            onMarkAll={onMarkAll}
          />
        </section>

        {mode !== "sandbox" && (
          <section className="card works-card">
            <div className="form-section-header" style={{ marginTop: 0 }}>
              <span className="form-section-title">Authoritative text</span>
            </div>
            <WorkFields
              works={works}
              onUpdate={(v) => dispatch({ type: "SET_WORKS", payload: v })}
            />
          </section>
        )}

        {/* ── Documents list ── */}
        {files.length > 0 && (
          <section className="card docs-card teacher-doc-list-card">
            <h3 className="teacher-doc-list-title">Documents</h3>

            {/* Progress summary for marked files */}
            {markedFiles.length > 0 && (() => {
              const complete = markedFiles.filter((f) => f.reviewStatus === "complete").length;
              const inProg = markedFiles.filter((f) => f.reviewStatus === "in_progress").length;
              const unseen = markedFiles.length - complete - inProg;
              return (
                <div className="doc-progress-summary">
                  <span className="progress-chip status-complete">{complete} complete</span>
                  <span className="progress-sep">&middot;</span>
                  <span className="progress-chip status-in-progress">{inProg} in progress</span>
                  <span className="progress-sep">&middot;</span>
                  <span className="progress-chip status-unseen">{unseen} unseen</span>
                </div>
              );
            })()}

            <div className="teacher-doc-list">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`teacher-doc-row${f.status === "marked" ? " doc-row-clickable" : ""}`}
                  onClick={() => {
                    if (f.status === "marked") {
                      dispatch({ type: "SELECT_DOCUMENT", payload: f.id });
                    }
                  }}
                  disabled={f.status !== "marked"}
                >
                  <span className="doc-row-icon">
                    {f.status === "marked" ? (
                      f.reviewStatus === "complete" ? (
                        <CircleCheck size={14} className="status-complete" />
                      ) : f.reviewStatus === "in_progress" ? (
                        <Clock size={14} className="status-in-progress" />
                      ) : (
                        <XCircle size={14} className="status-unseen" />
                      )
                    ) : (
                      <FileText size={14} />
                    )}
                  </span>
                  <span className="doc-row-info">
                    <span className="doc-row-name">{f.studentName || f.fileName}</span>
                    {f.studentName && (
                      <span className="doc-row-file">{f.fileName}</span>
                    )}
                  </span>
                  <span className={`doc-row-status status-${f.status}`}>
                    {f.status === "queued" && "Queued"}
                    {f.status === "processing" && "Marking..."}
                    {f.status === "marked" && `${f.totalLabels} issue${f.totalLabels === 1 ? "" : "s"}`}
                    {f.status === "error" && (
                      <span title={f.error || "Unknown error"}>Error</span>
                    )}
                  </span>
                  {f.status === "marked" && (
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
                        <CircleCheck size={14} />
                      ) : f.reviewStatus === "in_progress" ? (
                        <Clock size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                    </span>
                  )}
                  {f.status === "marked" && !f.reviewStatus && (
                    <span className="doc-row-arrow">&rarr;</span>
                  )}
                </button>
              ))}
            </div>
            {hasAggregate && (
              <div className="teacher-aggregate-summary">
                <span className="aggregate-stat">
                  {markedFiles.length} document{markedFiles.length === 1 ? "" : "s"} marked
                </span>
                <span className="aggregate-stat">
                  {aggregateTotalLabels} total issue{aggregateTotalLabels === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </section>
        )}
      </div>

      {hasAggregate && (
        <section className="card teacher-aggregate-card">
          <MostCommonIssuesChart
            labelCounts={aggregateLabelCounts}
            expandedMetric={mciExpandedMetric}
            onExpandedMetricChange={(m) => dispatch({ type: "SET_MCI_EXPANDED", payload: m })}
            markEventId="aggregate"
          />
        </section>
      )}
    </>
  );
}
