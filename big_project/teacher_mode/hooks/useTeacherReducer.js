import { useReducer, useMemo } from "react";
import { TEACHER_MODE_RULE_DEFAULTS } from "@student/config";
import { DEFAULT_ENABLED } from "@student/lib/teacherToolkit";
import { canonicalLabel } from "@student/lib/dismissIssues";

function getRuleDefaults(mode) {
  const d = TEACHER_MODE_RULE_DEFAULTS[mode] || TEACHER_MODE_RULE_DEFAULTS.textual_analysis;
  return {
    allowI: d.allowI ?? false,
    allowAudience: d.allowAudience ?? false,
    enforceClosedThesis: d.enforceClosedThesis ?? true,
    requireBodyEvidence: d.requireBodyEvidence ?? true,
    allowIntroQuotes: d.allowIntroQuotes ?? false,
    allowLongQuotes: d.allowLongQuotes ?? false,
    highlightDevices: d.highlightDevices ?? false,
    allowContractions: d.allowContractions ?? false,
    allowWhich: d.allowWhich ?? false,
    disableWeakVerbs: d.disableWeakVerbs ?? false,
    disableFactRule: d.disableFactRule ?? false,
    disableHumanRule: d.disableHumanRule ?? false,
    disableVagueGeneralRule: d.disableVagueGeneralRule ?? false,
  };
}

// File IDs use crypto.randomUUID() — unique across sessions and page refreshes.

const initialState = {
  // Config (batch-level)
  mode: "textual_analysis",
  rules: getRuleDefaults("textual_analysis"),
  assignmentName: "",
  studentName: "",
  applyToAll: true,
  classId: "",
  classes: [],
  works: [{ author: "", title: "", isMinor: true }],

  // Files array
  files: [],

  // Processing
  isProcessing: false,
  processProgress: { current: 0, total: 0 },
  isDownloading: false,

  // View
  activeDocId: null, // null = class overview, string = document detail

  // UI (for document detail)
  hint: null,
  zoom: 1.1,
  metricsCollapsed: false,
  mciExpandedMetric: null,

  // Preferences floating card
  prefsOpen: false,

  // Customizable marking toolkit
  toolkitEnabled: [...DEFAULT_ENABLED],
};

function teacherReducer(state, action) {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        rules: getRuleDefaults(action.payload),
      };
    case "SET_RULE":
      return {
        ...state,
        rules: { ...state.rules, [action.key]: action.value },
      };

    // Preferences floating card
    case "TOGGLE_PREFS_OPEN":
      return { ...state, prefsOpen: !state.prefsOpen };
    case "CLOSE_PREFS":
      return { ...state, prefsOpen: false };

    // Customizable marking toolkit
    case "SET_TOOLKIT":
      return { ...state, toolkitEnabled: action.payload };

    case "SET_ASSIGNMENT_NAME":
      return { ...state, assignmentName: action.payload };
    case "SET_STUDENT_NAME":
      return { ...state, studentName: action.payload };
    case "SET_APPLY_TO_ALL":
      return { ...state, applyToAll: action.payload };
    case "SET_CLASS_ID":
      return {
        ...state,
        classId: action.payload,
        // Propagate to queued files so they reflect the current class
        files: state.files.map((f) =>
          f.status === "queued" ? { ...f, classId: action.payload } : f
        ),
      };
    case "SET_CLASSES":
      return { ...state, classes: action.payload };
    case "SET_WORKS":
      return {
        ...state,
        works: action.payload,
        files: state.files.map((f) =>
          f.status === "queued"
            ? { ...f, works: action.payload.map((w) => ({ ...w })) }
            : f.status === "marked"
              ? { ...f, worksChangedSinceMark: true }
              : f
        ),
      };

    case "ADD_FILES": {
      const newFiles = action.payload
        .map((f) => ({
          id: crypto.randomUUID(),
          file: f.file,
          fileName: f.file.name,
          studentName: f.studentName || "",
          assignmentName: f.assignmentName || "",
          classId: state.classId,
          status: "queued",
          error: null,
          markedBlob: null,
          downloadUrl: null,
          metadata: null,
          markEventId: null,
          labelCounts: {},
          issues: [],
          examples: [],
          totalLabels: 0,
          wordCount: 0,
          works: state.works.map((w) => ({ ...w })),
          hasRevisedSinceMark: false,
          worksChangedSinceMark: false,
          savedHtml: null,
          teacherComment: null,
          studentContext: null,
          metrics: null,
          score: null,
          dismissedIssues: [],
        }));
      return { ...state, files: [...state.files, ...newFiles] };
    }

    case "REMOVE_FILE": {
      const remaining = state.files.filter((f) => f.id !== action.payload);
      let nextActive = state.activeDocId;
      if (state.activeDocId === action.payload) {
        // Navigate to adjacent marked document, or class overview if none
        const marked = remaining.filter((f) => f.status === "marked");
        const oldIdx = state.files.findIndex((f) => f.id === action.payload);
        const next = marked.find((f) => state.files.indexOf(f) >= oldIdx)
          || marked[marked.length - 1]
          || null;
        nextActive = next?.id || null;
      }
      return { ...state, files: remaining, activeDocId: nextActive };
    }

    case "CLEAR_FILES":
      return { ...state, files: [], activeDocId: null };

    case "UPDATE_FILE_FIELD":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, [action.field]: action.value } : f
        ),
      };

    case "SET_FILE_WORKS":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? { ...f, works: action.payload, worksChangedSinceMark: f.status === "marked" }
            : f
        ),
      };

    case "FILE_PROCESSING":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.payload ? { ...f, status: "processing" } : f
        ),
      };

    case "FILE_QUEUED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, status: "queued", error: null } : f
        ),
      };

    case "FILE_MARKED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? {
                ...f,
                status: "marked",
                markedMode: action.mode || state.mode,
                classId: f.classId || state.classId,
                works: f.works?.some((w) => w.author || w.title) ? f.works : state.works,
                markedBlob: action.blob,
                downloadUrl: action.downloadUrl,
                metadata: action.metadata,
                markEventId: action.metadata?.mark_event_id || null,
                labelCounts: action.metadata?.label_counts || {},
                issues: action.metadata?.issues || [],
                examples: action.metadata?.examples || [],
                totalLabels: action.metadata?.total_labels || 0,
                wordCount: action.metadata?.word_count || 0,
                savedHtml: null,
                metrics: null,
                score: null,
                worksChangedSinceMark: false,
                dismissedIssues: [],
              }
            : f
        ),
      };

    case "FILE_METRICS_COMPUTED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, metrics: action.metrics } : f
        ),
      };

    case "FILE_SCORE_COMPUTED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, score: action.score } : f
        ),
      };

    case "FILE_ERROR":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? { ...f, status: "error", error: action.error }
            : f
        ),
      };

    case "MARK_START":
      return {
        ...state,
        isProcessing: true,
        prefsOpen: false,
        processProgress: { current: 0, total: action.total || state.files.length },
      };

    case "MARK_PROGRESS":
      return {
        ...state,
        processProgress: {
          ...state.processProgress,
          current: action.current,
        },
      };

    case "MARK_DONE":
      return { ...state, isProcessing: false };

    // Per-file editing
    case "FILE_EDITED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, hasRevisedSinceMark: true } : f
        ),
      };

    case "FILE_SAVED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? { ...f, savedHtml: action.html, hasRevisedSinceMark: false }
            : f
        ),
      };

    case "SET_DOWNLOADING":
      return { ...state, isDownloading: action.payload };

    case "DISMISS_LABEL": {
      const { id, label } = action;
      return {
        ...state,
        files: state.files.map((f) => {
          if (f.id !== id) return f;
          const newCounts = { ...f.labelCounts };
          if (newCounts[label] > 1) {
            newCounts[label] -= 1;
          } else {
            delete newCounts[label];
          }
          return {
            ...f,
            labelCounts: newCounts,
            totalLabels: Math.max(0, f.totalLabels - 1),
            hasRevisedSinceMark: true,
          };
        }),
      };
    }

    case "DISMISS_LABEL_ALL": {
      const { id, label, count } = action;
      return {
        ...state,
        files: state.files.map((f) => {
          if (f.id !== id) return f;
          const newCounts = { ...f.labelCounts };
          delete newCounts[label];
          return {
            ...f,
            labelCounts: newCounts,
            totalLabels: Math.max(0, f.totalLabels - count),
            hasRevisedSinceMark: true,
          };
        }),
      };
    }

    // Dismissed issues tracking (persists across rechecks)
    case "ADD_DISMISSED_ISSUES": {
      const { id, records } = action;
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === id
            ? { ...f, dismissedIssues: [...(f.dismissedIssues || []), ...records] }
            : f
        ),
      };
    }

    case "UNDISMISS_ISSUES": {
      const { id, records } = action;
      const keysToRemove = new Set(
        records.map((r) =>
          `${canonicalLabel(r?.label)}::${(r?.sentence || "").trim()}::${r?.file_name || ""}`
        )
      );
      return {
        ...state,
        files: state.files.map((f) => {
          if (f.id !== id) return f;
          const remaining = (f.dismissedIssues || []).filter((r) => {
            const key = `${canonicalLabel(r?.label)}::${(r?.sentence || "").trim()}::${r?.file_name || ""}`;
            return !keysToRemove.has(key);
          });
          // Restore label counts for undismissed records
          const restoreMap = {};
          records.forEach((r) => {
            const lbl = String(r?.label || "").trim();
            if (lbl) restoreMap[lbl] = (restoreMap[lbl] || 0) + 1;
          });
          const newCounts = { ...f.labelCounts };
          let newTotal = f.totalLabels;
          Object.entries(restoreMap).forEach(([lbl, add]) => {
            newCounts[lbl] = (newCounts[lbl] || 0) + add;
            newTotal += add;
          });
          return {
            ...f,
            dismissedIssues: remaining,
            labelCounts: newCounts,
            totalLabels: newTotal,
            hasRevisedSinceMark: true,
          };
        }),
      };
    }

    // Teacher comment notebook
    case "SET_TEACHER_COMMENT":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, teacherComment: action.comment } : f
        ),
      };

    case "SET_TEACHER_SCORE":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id && f.teacherComment
            ? { ...f, teacherComment: { ...f.teacherComment, score: action.score } }
            : f
        ),
      };

    case "TOGGLE_COMMENT_DOWNLOAD":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id && f.teacherComment
            ? { ...f, teacherComment: { ...f.teacherComment, includeInDownload: f.teacherComment.includeInDownload === false ? true : false } }
            : f
        ),
      };

    case "TOGGLE_DETAILS_DOWNLOAD":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id && f.teacherComment
            ? { ...f, teacherComment: { ...f.teacherComment, includeDetailsInDownload: !f.teacherComment.includeDetailsInDownload } }
            : f
        ),
      };

    // Student context (previous essay data)
    case "SET_STUDENT_CONTEXT":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, studentContext: action.context } : f
        ),
      };

    // View navigation
    case "SELECT_DOCUMENT": {
      const selDoc = state.files.find((f) => f.id === action.payload);
      const selMode = selDoc?.markedMode || state.mode;
      return {
        ...state,
        activeDocId: action.payload,
        hint: null,
        mode: selMode,
        rules: getRuleDefaults(selMode),
      };
    }

    case "BACK_TO_OVERVIEW":
      return { ...state, activeDocId: null, hint: null };

    // Document detail UI
    case "SET_HINT":
      return { ...state, hint: action.payload };
    case "SET_ZOOM":
      return { ...state, zoom: action.payload };
    case "TOGGLE_METRICS_COLLAPSED":
      return { ...state, metricsCollapsed: !state.metricsCollapsed };
    case "SET_MCI_EXPANDED":
      return { ...state, mciExpandedMetric: action.payload };

    // Session restore (Keep Working)
    case "RESTORE_SESSION": {
      const s = action.session;
      return {
        ...state,
        mode: s.mode || state.mode,
        rules: s.rules || state.rules,
        classId: s.classId || "",
        works: s.works?.length ? s.works : state.works,
        activeDocId: s.activeDocId || null,
        files: (s.files || []).map((f) => ({
          ...f,
          file: null,
          markedBlob: f.savedHtml ? new Blob([""]) : null,
          downloadUrl: null,
          error: null,
          classId: f.classId || s.classId || "",
          works: f.works?.length ? f.works : (s.works?.length ? s.works : state.works),
          markEventId: f.markEventId || null,
          hasRevisedSinceMark: false,
          worksChangedSinceMark: false,
          studentContext: null,
          dismissedIssues: f.dismissedIssues || [],
          examples: f.examples || [],
          score: f.score ?? null,
          metrics: f.metrics || null,
          metadata: {
            label_counts: f.labelCounts,
            issues: f.issues,
            examples: f.examples,
            total_labels: f.totalLabels,
            word_count: f.wordCount,
            scores: f.metrics || undefined,
          },
        })),
      };
    }

    default:
      return state;
  }
}

export function useTeacherReducer() {
  const [state, dispatch] = useReducer(teacherReducer, initialState);

  const derived = useMemo(() => {
    const markedFiles = state.files.filter((f) => f.status === "marked");

    // Aggregate label counts across all marked files
    const aggregateLabelCounts = {};
    for (const f of markedFiles) {
      if (!f.labelCounts) continue;
      for (const [label, count] of Object.entries(f.labelCounts)) {
        aggregateLabelCounts[label] =
          (aggregateLabelCounts[label] || 0) + (Number(count) || 0);
      }
    }

    const aggregateTotalLabels = markedFiles.reduce(
      (sum, f) => sum + (f.totalLabels || 0),
      0
    );

    const activeDoc = state.activeDocId
      ? state.files.find((f) => f.id === state.activeDocId) || null
      : null;

    // Navigation indices for sequential document browsing
    const activeMarkedIndex = activeDoc
      ? markedFiles.findIndex((f) => f.id === activeDoc.id)
      : -1;
    const hasPrev = activeMarkedIndex > 0;
    const hasNext = activeMarkedIndex >= 0 && activeMarkedIndex < markedFiles.length - 1;
    const prevDocId = hasPrev ? markedFiles[activeMarkedIndex - 1].id : null;
    const nextDocId = hasNext ? markedFiles[activeMarkedIndex + 1].id : null;
    const positionLabel = activeMarkedIndex >= 0
      ? `${activeMarkedIndex + 1} of ${markedFiles.length}`
      : null;

    return {
      markedFiles,
      aggregateLabelCounts,
      aggregateTotalLabels,
      activeDoc,
      hasPrev,
      hasNext,
      prevDocId,
      nextDocId,
      positionLabel,
    };
  }, [state.files, state.activeDocId]);

  return [state, dispatch, derived];
}
