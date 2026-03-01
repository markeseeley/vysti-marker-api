import { useReducer } from "react";

const initialState = {
  text: "",
  mode: "textual_analysis",
  assignmentName: "",
  authorName: "",
  textTitle: "",
  isChecking: false,
  checkError: null,
  issues: [],
  examples: [],
  labelCounts: {},
  totalLabels: 0,
  wordCount: 0,
  markEventId: null,
  metrics: null,
  mciExpandedMetric: null,
  firstSentenceComponents: {},
};

function writeReducer(state, action) {
  switch (action.type) {
    case "SET_TEXT":
      return { ...state, text: action.payload };
    case "SET_MODE":
      return { ...state, mode: action.payload };
    case "SET_ASSIGNMENT_NAME":
      return { ...state, assignmentName: action.payload };
    case "SET_AUTHOR_NAME":
      return { ...state, authorName: action.payload };
    case "SET_TEXT_TITLE":
      return { ...state, textTitle: action.payload };
    case "CHECK_START":
      return { ...state, isChecking: true, checkError: null };
    case "CHECK_SUCCESS":
      return {
        ...state,
        isChecking: false,
        checkError: null,
        issues: action.payload.issues || [],
        examples: action.payload.examples || [],
        labelCounts: action.payload.label_counts || {},
        totalLabels: action.payload.total_labels || 0,
        wordCount: action.payload.word_count || 0,
        markEventId: action.payload.mark_event_id || null,
        firstSentenceComponents: action.payload.first_sentence_components || {},
        metrics: action.payload.scores || state.metrics,
      };
    case "CHECK_ERROR":
      return { ...state, isChecking: false, checkError: action.payload };
    case "SET_METRICS":
      return { ...state, metrics: action.payload };
    case "SET_MCI_EXPANDED":
      return { ...state, mciExpandedMetric: action.payload };
    case "RESTORE_DRAFT":
      return {
        ...state,
        text: action.payload.text || "",
        authorName: action.payload.authorName || "",
        textTitle: action.payload.textTitle || "",
      };
    default:
      return state;
  }
}

export function useWriteReducer() {
  return useReducer(writeReducer, initialState);
}
