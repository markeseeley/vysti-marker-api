import { useMemo, useState } from "react";
import ModeSelect from "@student/components/ModeSelect";
import ModeCard from "@student/components/ModeCard";
import WorkFields from "./WorkFields";
import TeacherDropZone from "./TeacherDropZone";
import { TEACHER_MODES, TEACHER_MODE_RULE_DEFAULTS } from "@student/config";
import { parseFilename } from "@student/lib/filenameParser";
import { FileText } from "@student/components/Icons";

const MAX_BATCH_FILES = 20;

export default function ClassOverview({
  state,
  dispatch,
  derived,
  onMarkAll,
  onCancelMark,
  entitlement,
  onUpgrade,
}) {
  const {
    mode,
    classId,
    classes,
    files,
    isProcessing,
    processProgress,
  } = state;

  const { markedFiles, aggregateLabelCounts, aggregateTotalLabels } = derived;

  const [showClassPrompt, setShowClassPrompt] = useState(false);

  const handleMarkAllWithCheck = () => {
    // If teacher has classes but none selected, nudge them
    if (!classId && classes.length > 0 && mode !== "sandbox") {
      setShowClassPrompt(true);
      return;
    }
    onMarkAll();
  };

  const modeInfo = useMemo(() => {
    const d = TEACHER_MODE_RULE_DEFAULTS[mode] || {};
    return {
      label: d.tag || mode,
      description: d.description || "",
      details: d.details || [],
    };
  }, [mode]);

  const handleFilesAdded = (newRawFiles) => {
    // Free tier: block upload if marks exhausted
    if (entitlement?.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit) {
      onUpgrade?.();
      return;
    }
    // Free tier: limit files to remaining allowance
    let accepted = newRawFiles;
    if (entitlement?.subscription_tier === "free") {
      const freeRemaining = Math.max(0, (entitlement.marks_limit || 1) - (entitlement.marks_used || 0) - files.length);
      if (freeRemaining <= 0) {
        onUpgrade?.();
        return;
      }
      if (accepted.length > freeRemaining) {
        accepted = accepted.slice(0, freeRemaining);
      }
    }
    const remaining = MAX_BATCH_FILES - files.length;
    if (remaining <= 0) {
      alert(`You can upload a maximum of ${MAX_BATCH_FILES} files at once.`);
      return;
    }
    if (accepted.length > remaining) {
      accepted = accepted.slice(0, remaining);
      alert(`Only ${remaining} more file${remaining === 1 ? "" : "s"} can be added (limit: ${MAX_BATCH_FILES}). The first ${remaining} were kept.`);
    }
    const parsed = accepted.map((file) => {
      const p = parseFilename(file.name);
      return {
        file,
        studentName: p.studentName,
        assignmentName: p.assignmentName,
      };
    });

    // Warn about duplicate filenames (against existing files + within new batch)
    const existingNames = new Set(files.map((f) => f.fileName));
    const newNames = parsed.map((f) => f.file.name);
    const dupes = newNames.filter((n) => existingNames.has(n));
    const batchDupes = newNames.filter((n, i) => newNames.indexOf(n) !== i);
    const totalDupes = new Set([...dupes, ...batchDupes]).size;
    if (totalDupes > 0) {
      alert(`Note: ${totalDupes} file${totalDupes === 1 ? " has" : "s have"} the same name as ${dupes.length ? "existing files" : "each other"}. Consider renaming to avoid confusion.`);
    }

    dispatch({ type: "ADD_FILES", payload: parsed });
  };

  const handleRemoveFile = (index) => {
    const f = files[index];
    if (f) {
      if (f.downloadUrl) URL.revokeObjectURL(f.downloadUrl);
      dispatch({ type: "REMOVE_FILE", payload: f.id });
    }
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
                <select
                  id="teacher-class-select"
                  value={classId}
                  onChange={(e) => dispatch({ type: "SET_CLASS_ID", payload: e.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">No class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <a href="/student_progress.html?lens=classes" className="manage-classes-link">Manage classes</a>
              </div>
            </>
          )}
        </section>

        {mode !== "sandbox" && (
          <section className="card works-card">
            <h3 className="works-card-title">Source texts</h3>
            <p className="works-card-hint">
              Enter the author and title so Vysti can check formatting and citations.
            </p>
            <WorkFields
              works={state.works}
              onUpdate={(w) => dispatch({ type: "SET_WORKS", payload: w })}
              maxWorks={3}
            />
          </section>
        )}

        <section className="card upload-card">
          <TeacherDropZone
            onFilesAdded={handleFilesAdded}
            files={files}
            canMark={canMark}
            isProcessing={isProcessing}
            processProgress={processProgress}
            onMarkAll={handleMarkAllWithCheck}
            onCancelMark={onCancelMark}
            isUploadBlocked={entitlement?.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit}
            onBlockedClick={onUpgrade}
          />

          {showClassPrompt && files.length > 0 && (
            <div className="class-prompt-banner">
              <p className="class-prompt-text">No class selected. Add these essays to a class for progress tracking?</p>
              <div className="class-prompt-actions">
                <button
                  type="button"
                  className="class-prompt-btn class-prompt-btn--choose"
                  onClick={() => setShowClassPrompt(false)}
                >
                  Choose Class
                </button>
                <button
                  type="button"
                  className="class-prompt-btn class-prompt-btn--skip"
                  onClick={() => { setShowClassPrompt(false); onMarkAll(); }}
                >
                  Mark Without Class
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Documents list ── */}
        {files.length > 0 && (
          <section className="card docs-card teacher-doc-list-card">
            <h3 className="teacher-doc-list-title">Documents</h3>
            <div className="teacher-doc-list">
              {files.map((f, i) => (
                <div
                  key={f.id}
                  className={`teacher-doc-row${f.status === "marked" ? " doc-row-clickable" : ""}`}
                  onClick={() => {
                    if (f.status === "marked") {
                      dispatch({ type: "SELECT_DOCUMENT", payload: f.id });
                    }
                  }}
                  role={f.status === "marked" ? "button" : undefined}
                  tabIndex={f.status === "marked" ? 0 : undefined}
                >
                  <span className="doc-row-icon">
                    <FileText size={14} />
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
                  {f.status === "queued" && (
                    <button
                      type="button"
                      className="doc-row-remove"
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}
                      aria-label={`Remove ${f.fileName}`}
                      title="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                  {f.status === "marked" && (
                    <span className="doc-row-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {hasAggregate && (
        <section className="card teacher-aggregate-card">
          <div className="teacher-aggregate-summary">
            <span className="aggregate-stat">
              {markedFiles.length} document{markedFiles.length === 1 ? "" : "s"} marked
            </span>
            <span className="aggregate-stat">
              {aggregateTotalLabels} total issue{aggregateTotalLabels === 1 ? "" : "s"}
            </span>
          </div>
        </section>
      )}
    </>
  );
}
