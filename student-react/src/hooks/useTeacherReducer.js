import { useReducer, useMemo } from "react";
import { TEACHER_MODE_RULE_DEFAULTS } from "../config";

function getRuleDefaults(mode) {
  const d = TEACHER_MODE_RULE_DEFAULTS[mode] || TEACHER_MODE_RULE_DEFAULTS.textual_analysis;
  return {
    allowI: d.allowI ?? false,
    allowAudience: d.allowAudience ?? false,
    enforceClosedThesis: d.enforceClosedThesis ?? true,
    requireBodyEvidence: d.requireBodyEvidence ?? true,
    allowIntroQuotes: d.allowIntroQuotes ?? false,
    allowLongQuotes: d.allowLongQuotes ?? false,
    highlightDevices: d.highlightDevices ?? true,
    allowContractions: d.allowContractions ?? false,
    allowWhich: d.allowWhich ?? false,
    disableWeakVerbs: d.disableWeakVerbs ?? false,
    disableFactRule: d.disableFactRule ?? false,
    disableHumanRule: d.disableHumanRule ?? false,
    disableVagueGeneralRule: d.disableVagueGeneralRule ?? false,
  };
}

let nextFileId = 1;

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
  isRechecking: false,
  isDownloading: false,

  // View
  activeDocId: null, // null = class overview, string = document detail

  // UI (for document detail)
  hint: null,
  zoom: 1.1,
  metricsCollapsed: false,
  mciExpandedMetric: null,
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
    case "SET_ASSIGNMENT_NAME":
      return { ...state, assignmentName: action.payload };
    case "SET_STUDENT_NAME":
      return { ...state, studentName: action.payload };
    case "SET_APPLY_TO_ALL":
      return { ...state, applyToAll: action.payload };
    case "SET_CLASS_ID":
      return { ...state, classId: action.payload };
    case "SET_CLASSES":
      return { ...state, classes: action.payload };
    case "SET_WORKS":
      return { ...state, works: action.payload };

    case "ADD_FILES": {
      const existingNames = new Set(state.files.map((f) => f.fileName));
      const newFiles = action.payload
        .filter((f) => !existingNames.has(f.file.name))
        .map((f) => ({
          id: `file-${nextFileId++}`,
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
          labelCounts: {},
          issues: [],
          totalLabels: 0,
          wordCount: 0,
          hasRevisedSinceMark: false,
          savedHtml: null,
          score: null,
          reviewStatus: "unseen",
        }));
      return { ...state, files: [...state.files, ...newFiles] };
    }

    case "REMOVE_FILE":
      return {
        ...state,
        files: state.files.filter((f) => f.id !== action.payload),
        activeDocId:
          state.activeDocId === action.payload ? null : state.activeDocId,
      };

    case "CLEAR_FILES":
      return { ...state, files: [], activeDocId: null };

    case "UPDATE_FILE_FIELD":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, [action.field]: action.value } : f
        ),
      };

    case "FILE_PROCESSING":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.payload ? { ...f, status: "processing" } : f
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
                markedBlob: action.blob,
                downloadUrl: action.downloadUrl,
                metadata: action.metadata,
                markEventId: action.metadata?.mark_event_id || null,
                labelCounts: action.metadata?.label_counts || {},
                issues: action.metadata?.issues || [],
                totalLabels: action.metadata?.total_labels || 0,
                wordCount: action.metadata?.word_count || 0,
                savedHtml: null,
              }
            : f
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

    case "FILE_SCORE_COMPUTED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, score: action.score } : f
        ),
      };

    case "MARK_START":
      return {
        ...state,
        isProcessing: true,
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

    case "FILE_RECHECKED":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? {
                ...f,
                markedBlob: action.blob,
                downloadUrl: action.downloadUrl || f.downloadUrl,
                metadata: action.metadata || f.metadata,
                labelCounts: action.metadata?.label_counts || f.labelCounts,
                issues: action.metadata?.issues || f.issues,
                totalLabels: action.metadata?.total_labels || f.totalLabels,
                wordCount: action.metadata?.word_count || f.wordCount,
                hasRevisedSinceMark: false,
                savedHtml: null,
              }
            : f
        ),
      };

    case "SET_RECHECKING":
      return { ...state, isRechecking: action.payload };

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

    // Review status (session persistence)
    case "SET_REVIEW_STATUS":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, reviewStatus: action.status } : f
        ),
      };

    case "RESTORE_SESSION": {
      const s = action.payload;
      return {
        ...state,
        mode: s.mode || state.mode,
        rules: s.rules || state.rules,
        assignmentName: s.assignmentName || "",
        studentName: s.studentName || "",
        applyToAll: s.applyToAll ?? true,
        classId: s.classId || "",
        works: s.works || state.works,
        files: s.files || [],
        activeDocId: null,
      };
    }

    // View navigation
    case "SELECT_DOCUMENT": {
      const files = state.files.map((f) =>
        f.id === action.payload && f.reviewStatus === "unseen"
          ? { ...f, reviewStatus: "in_progress" }
          : f
      );
      return { ...state, files, activeDocId: action.payload, hint: null };
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
