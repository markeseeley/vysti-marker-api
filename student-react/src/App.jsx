import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import "./App.css";
import Footer from "./components/Footer";
import ModeSelect from "./components/ModeSelect";
import ModeCard from "./components/ModeCard";
import PreviewPanel from "./components/PreviewPanel";
import StudentTour from "./components/StudentTour";
import Topbar from "./components/Topbar";
import AssignmentTracker from "./components/AssignmentTracker";
import DropZone from "./components/DropZone";
import TechniquesPanel from "./components/TechniquesPanel";
import MlaModal from "./components/MlaModal";
import RevisionPracticePanel from "./components/RevisionPracticePanel";
import MostCommonIssuesChart from "./components/MostCommonIssuesChart";
import MostCommonIssuesDetail from "./components/MostCommonIssuesDetail";
import StatusToasts from "./components/StatusToasts";
import ErrorBoundary from "./components/ErrorBoundary";
import DraftRestoreBanner from "./components/DraftRestoreBanner";
import AttemptHistoryPanel from "./components/AttemptHistoryPanel";
import MetricInfoPopover from "./components/MetricInfoPopover";
import PowerVerbsPopover from "./components/PowerVerbsPopover";
import PaywallModal from "./components/PaywallModal";
import { useAuthSession } from "./hooks/useAuthSession";
import { logEvent, logError } from "./lib/logger";
import { DEFAULT_ZOOM, MODE_RULE_DEFAULTS, MODES, getConfig, getConfigError } from "./config";
import {
  buildMarkTextPayload as buildMarkTextPayloadShared,
  parseTechniquesHeader as parseTechniquesHeaderShared
} from "@shared/markingApi";
import { downloadBlob } from "@shared/download";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import {
  extractPreviewTextFromContainer,
  stripStudentHeaderBeforeTitleForDownload,
  wordCountFromText,
  cleanupCommonTypos
} from "./lib/previewText";
import {
  applyDismissalsToLabelCounts,
  loadDismissedIssuesFromStorage,
  saveDismissedIssuesToStorage,
  canonicalLabel
} from "./lib/dismissIssues";
import { applyDismissalsToPreviewDOM } from "./lib/previewDismissals";
import { buildPowerVerbFormsSet, loadPowerVerbs } from "./lib/powerVerbs";
import { loadThesisDevicesLexicon, WEAK_VERBS } from "./lib/studentMetrics";
import {
  clearHighlights,
  clearDeviceHighlights,
  enableFocusMode,
  findBestMatchBlock,
  highlightAllMatches,
  highlightTechniquesBlock,
  highlightThesisDevicesInBlock,
  highlightVarietyBlock,
  scrollAndFlash
} from "./lib/previewNavigator";
import { applyRepetitionHighlights, clearRepetitionHighlights } from "./lib/repetitionHighlight";
import {
  extractErrorMessage,
  fetchWithTimeout,
  isAuthExpired,
  makeAbortableTimeout
} from "./lib/request";
import { markEssay, markText } from "./services/markEssay";

import { fetchAttemptHistory } from "./services/attemptHistory";
import { fetchLatestMarkEvent } from "./services/revisionPractice";
import {
  deleteDraft,
  loadDraft,
  saveDraft,
  shouldAutosave,
  throttle
} from "./services/draftStore";
import {
  saveRevisionDraftToSupabase,
  loadRevisionDraftFromSupabase,
  deleteRevisionDraftFromSupabase,
  findAllRevisionDrafts,
  createSupabaseThrottledSaver
} from "./services/revisionDraftStore";
import { peekTeacherSession } from "./services/teacherSessionStore";
import { peekWriteDraft } from "./WriteApp";

const TOUR_KEYS = [
  "vysti_student_helpers_disabled",
  "vysti_student_tour_completed",
  "vysti_student_tour_hide"
];

const EMPTY_TECHNIQUES = {
  type: "none",
  items: [],
  raw: "",
  error: ""
};

const MAX_DOCX_BYTES = 15 * 1024 * 1024;
const METRIC_DETAILS_COLLAPSE_KEY = "vysti_metric_details_collapsed";

function App() {
  const { supa, isChecking, authError, products, entitlement, redirectToSignin } = useAuthSession();
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "info" });
  const [markedBlob, setMarkedBlob] = useState(null);
  const [markMetadata, setMarkMetadata] = useState(null);
  const [techniques, setTechniques] = useState(EMPTY_TECHNIQUES);
  const [techniquesParsed, setTechniquesParsed] = useState(null);
  const [userId, setUserId] = useState("");
  const [showTechniques, setShowTechniques] = useState(false);
  const [lastMarkStatus, setLastMarkStatus] = useState(null);
  const [lastMarkError, setLastMarkError] = useState("");
  const [authSnapshot, setAuthSnapshot] = useState({
    hasSession: false,
    email: ""
  });
  const [zoom, setZoom] = useState(1.1);
  const [hasRevisedSinceMark, setHasRevisedSinceMark] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showMlaModal, setShowMlaModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [markedFilenameBase, setMarkedFilenameBase] = useState("");
  const [mciLabelCounts, setMciLabelCounts] = useState({});
  const [mciLabelCountsRaw, setMciLabelCountsRaw] = useState({});
  const [mciIssues, setMciIssues] = useState([]);
  const [mciIssuesRich, setMciIssuesRich] = useState([]);
  const [mciLoading, setMciLoading] = useState(false);
  const [mciError, setMciError] = useState("");
  const [mciSelectedLabel, setMciSelectedLabel] = useState("");
  const [mciMarkEventId, setMciMarkEventId] = useState(null);
  const [currentMarkEvent, setCurrentMarkEvent] = useState(null);
  const [mciRefreshToken, setMciRefreshToken] = useState(0);
  const [mciExpandedMetric, setMciExpandedMetric] = useState(null);
  const [dismissedIssues, setDismissedIssues] = useState([]);
  const dismissedIssuesRef = useRef([]);
  dismissedIssuesRef.current = dismissedIssues;
  const [previewError, setPreviewError] = useState("");
  const [previewErrorStack, setPreviewErrorStack] = useState("");
  const [draftMeta, setDraftMeta] = useState(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [saveProgressState, setSaveProgressState] = useState("idle"); // "idle" | "saving" | "saved"
  const saveProgressTimerRef = useRef(null);
  const supaThrottledSaverRef = useRef(null);
  const [pendingSavedDrafts, setPendingSavedDrafts] = useState([]); // [{ fileName, mode, savedAt, text }, ...]
  const [keepWorkingItems, setKeepWorkingItems] = useState([]);
  const [isRestoringDraft, setIsRestoringDraft] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState("");
  const [activeRequest, setActiveRequest] = useState(null);
  const [toastQueue, setToastQueue] = useState([]);
  const [fileValidationError, setFileValidationError] = useState("");

  const lastExtractedRef = useRef("");
  const [wordCount, setWordCount] = useState(null);
  const [works, setWorks] = useState([{ author: "", title: "", isMinor: true }]);
  const [activeWorkIndex, setActiveWorkIndex] = useState(0);
  const [studentMetrics, setStudentMetrics] = useState(null);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [metricInfoState, setMetricInfoState] = useState({
    open: false,
    anchorEl: null,
    metricKey: null
  });
  const [powerVerbsState, setPowerVerbsState] = useState({
    open: false,
    anchorEl: null,
    textareaRef: null
  });
  const [previewHint, setPreviewHint] = useState(null);
  const [powerVerbFormsSet, setPowerVerbFormsSet] = useState(null);
  const [thesisDevicesLexicon, setThesisDevicesLexicon] = useState(null);
  const previewMetricsTimerRef = useRef(0);
  const pendingCenteredTextsRef = useRef(null);
  const pendingItalicTextsRef = useRef(null);

  const config = getConfig();
  const configError = getConfigError();
  const apiBase = getApiBaseUrl();
  const markUrl = apiBase ? `${apiBase}/mark` : "";
  const markTextUrl = apiBase ? `${apiBase}/mark_text` : "";
  const exportUrl = apiBase ? `${apiBase}/export_docx` : "";
  const debugHardening = Boolean(config.featureFlags?.debugHardening);
  // Safe localStorage reader — returns null instead of throwing in private browsing
  const lsGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const practiceEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.revisionPracticeReact) ||
      params.get("practice") === "1" ||
      lsGet("vysti_practice") === "1"
    );
  }, [config.featureFlags?.revisionPracticeReact]);
  const practiceNavEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.practiceNavigationReact) ||
      params.get("practiceNav") === "1" ||
      lsGet("vysti_practice_nav") === "1"
    );
  }, [config.featureFlags?.practiceNavigationReact]);
  const practiceHighlightEnabled = false; // Removed: buttons were confusing
  const hardeningEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.hardeningReact) ||
      params.get("hardening") === "1" ||
      lsGet("vysti_hardening") === "1"
    );
  }, [config.featureFlags?.hardeningReact]);
  const cancelRequestsEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.cancelRequestsReact) ||
      params.get("cancel") === "1" ||
      lsGet("vysti_cancel") === "1"
    );
  }, [config.featureFlags?.cancelRequestsReact]);
  const strictFileValidationEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.strictFileValidationReact) ||
      params.get("strict") === "1" ||
      lsGet("vysti_strict_files") === "1"
    );
  }, [config.featureFlags?.strictFileValidationReact]);
  const statusToastsEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.statusToastsReact) ||
      params.get("statusToasts") === "1" ||
      lsGet("vysti_status_toasts") === "1"
    );
  }, [config.featureFlags?.statusToastsReact]);
  const autosaveEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.autosaveDraftReact) ||
      params.get("autosave") === "1" ||
      lsGet("vysti_autosave") === "1"
    );
  }, [config.featureFlags?.autosaveDraftReact]);
  const saveProgressEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.saveProgressReact) ||
      params.get("saveProgress") === "1" ||
      lsGet("vysti_save_progress") === "1"
    );
  }, [config.featureFlags?.saveProgressReact]);
  const historyEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.revisionHistoryReact) ||
      params.get("history") === "1" ||
      lsGet("vysti_history") === "1"
    );
  }, [config.featureFlags?.revisionHistoryReact]);
  const attemptHistoryOverride = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("attemptHistory") === "1";
  }, []);
  const showAttemptHistory = historyEnabled && (debugHardening || attemptHistoryOverride);

  const previewRef = useRef(null);
  const undoStackRef = useRef([]);
  const undoDebounceRef = useRef(null);
  const lastSnapshotHtmlRef = useRef(null);
  const MAX_UNDO = 50;
  const fileInputRef = useRef(null);
  const tourRef = useRef(null);
  // Spelling suggestions from LanguageTool — keyed by "label|found_value"
  // Stored in a ref because Supabase doesn't persist them; we merge them back
  // into examples fetched from Supabase after a mark/recheck.
  const spellingSuggestionsRef = useRef(new Map());

  const modeExplainer = useMemo(
    () => MODE_RULE_DEFAULTS[mode] || MODE_RULE_DEFAULTS.textual_analysis,
    [mode]
  );

  // Enable Recheck when assignment mode changes after essay is already marked
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      if (markedBlob) setHasRevisedSinceMark(true);
    }
  }, [mode, markedBlob]);

  const totalIssues = useMemo(() => {
    return Object.values(mciLabelCounts || {}).reduce(
      (sum, count) => sum + (Number(count) || 0),
      0
    );
  }, [mciLabelCounts]);

  // ── Product guard: redirect to role selection if not onboarded ──
  useEffect(() => {
    if (isChecking) return;
    if (!products.has_revise && !products.has_mark) {
      window.location.assign("/role.html");
    }
  }, [isChecking, products]);

  // ── Detect Stripe checkout return (read URL synchronously in state init) ──
  const [checkoutParam] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("checkout");
    if (v) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    return v;
  });
  useEffect(() => {
    if (checkoutParam === "success") {
      setStatus({ message: "Payment successful! You now have full access.", kind: "success" });
    } else if (checkoutParam === "cancelled") {
      setStatus({ message: "Checkout was cancelled. You can try again any time.", kind: "info" });
    }
  }, [checkoutParam]);

  useEffect(() => {
    try {
      setMetricsCollapsed(localStorage.getItem(METRIC_DETAILS_COLLAPSE_KEY) === "1");
    } catch (err) {
      setMetricsCollapsed(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    loadPowerVerbs().then(({ list }) => {
      if (!isActive) return;
      setPowerVerbFormsSet(buildPowerVerbFormsSet(list));
    }).catch(() => {});
    loadThesisDevicesLexicon().then(({ lexicon }) => {
      if (!isActive) return;
      setThesisDevicesLexicon(lexicon);
    }).catch(() => {});
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.body.classList.add("popovers-ready");
    });
    return () => cancelAnimationFrame(raf);
  }, []);


  useEffect(() => {
    if (!supa || !selectedFile || !markedBlob) {
      setMciLabelCounts({});
      setMciLabelCountsRaw({});
      setMciIssues([]);
      setMciIssuesRich([]);
      setMciError("");
      setMciLoading(false);
      setMciMarkEventId(null);
      setCurrentMarkEvent(null);
      return;
    }

    if (selectedAttempt) {
      const counts = selectedAttempt.labelCounts || {};
      const issues = selectedAttempt.issues || [];
      setMciLabelCountsRaw(counts);
      setMciLabelCounts(
        applyDismissalsToLabelCounts(counts, dismissedIssues, selectedFile?.name)
      );
      setMciIssues(issues);
      setMciIssuesRich(issues);
      setMciError("");
      setMciLoading(false);
      setMciMarkEventId(selectedAttempt.id || null);
      setCurrentMarkEvent(selectedAttempt || null);
      if (!mciSelectedLabel) {
        const firstLabel = Object.keys(counts || {})[0] || "";
        setMciSelectedLabel((prev) => prev || firstLabel);
      }
      return;
    }

    let isActive = true;
    const load = async () => {
      setMciLoading(true);
      setMciError("");
      try {
        const { data, error } = await supa.auth.getSession();
        if (error || !data?.session?.user?.id) {
          throw new Error("Session expired. Please sign in again.");
        }
        let attempts = 0;
        let result = null;
        while (attempts < 5) {
          if (!isActive) return;
          const { markEvent, labelCountsFiltered, issuesFiltered, examples } =
            await fetchLatestMarkEvent({
              supa,
              userId: data.session.user.id,
              fileName: selectedFile.name
            });
          if (markEvent) {
            result = { markEvent, labelCountsFiltered, issuesFiltered, examples };
            break;
          }
          attempts += 1;
          if (attempts < 5) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
        if (!isActive) return;
        if (!result?.markEvent) {
          // Don't clear existing chart data — the mark/recheck handler
          // already populated it eagerly from the API response.  Clearing
          // here would cause the chart to flicker empty during the brief
          // window between Supabase delete and insert of the new mark event.
          return;
        }
        setMciLabelCountsRaw(result.labelCountsFiltered || {});
        setMciLabelCounts(
          applyDismissalsToLabelCounts(
            result.labelCountsFiltered || {},
            dismissedIssues,
            selectedFile?.name
          )
        );
        // Use examples for pill navigation (contains sentence + paragraph_index).
        // Supabase doesn't store 'suggestions', so merge them from the ref
        // populated during the most recent mark/recheck.
        const supaExamples = result.examples || [];
        const sugMap = spellingSuggestionsRef.current;
        if (sugMap.size) {
          for (const ex of supaExamples) {
            if (!ex.suggestions && ex.found_value) {
              const key = `${ex.label}|${ex.found_value}`;
              const sug = sugMap.get(key);
              if (sug) ex.suggestions = sug;
            }
          }
        }
        setMciIssues(supaExamples);
        setMciIssuesRich(result.issuesFiltered || []);
        setMciMarkEventId(result.markEvent?.id || null);
        setCurrentMarkEvent(result.markEvent || null);
        if (!mciSelectedLabel) {
          const firstLabel = Object.keys(result.labelCountsFiltered || {})[0] || "";
          setMciSelectedLabel((prev) => prev || firstLabel);
        }
      } catch (err) {
        if (!isActive) return;
        setMciError(err?.message || "Failed to load issue data.");
        setMciLabelCounts({});
        setMciIssues([]);
        setMciIssuesRich([]);
        setMciMarkEventId(null);
        setCurrentMarkEvent(null);
      } finally {
        if (isActive) setMciLoading(false);
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [
    supa,
    selectedFile,
    markedBlob,
    selectedAttempt,
    mciRefreshToken
    // Note: mciSelectedLabel and dismissedIssues intentionally excluded —
    // mciSelectedLabel is set inside this effect,
    // dismissedIssues has its own dedicated effect for applying to label counts
  ]);

  useEffect(() => {
    if (!selectedFile?.name) {
      setDismissedIssues([]);
      return;
    }
    const loaded = loadDismissedIssuesFromStorage({
      markEventId: mciMarkEventId,
      fileName: selectedFile.name
    });
    if (loaded.length > 0) {
      setDismissedIssues(loaded);
      return;
    }
    // New storage key has no data — use ref to check current dismissals
    // (avoids stale closure when mciMarkEventId transitions null → newId)
    const current = dismissedIssuesRef.current;
    if (current.length > 0 && current.some((r) => r?.file_name === selectedFile.name)) {
      // Carry over: save under the new key and keep state intact
      saveDismissedIssuesToStorage({
        markEventId: mciMarkEventId,
        fileName: selectedFile.name,
        dismissedIssues: current
      });
      return;
    }
    setDismissedIssues([]);
  }, [mciMarkEventId, selectedFile?.name]);

  useEffect(() => {
    if (!selectedFile?.name) return;
    setMciLabelCounts(
      applyDismissalsToLabelCounts(mciLabelCountsRaw, dismissedIssues, selectedFile.name)
    );
  }, [dismissedIssues, mciLabelCountsRaw, selectedFile?.name]);

  useEffect(() => {
    if (!markedBlob) {
      setPreviewError("");
      setPreviewErrorStack("");
    }
  }, [markedBlob]);

  useEffect(() => {
    if (!markedBlob || !previewRef.current || !selectedFile?.name) return;
    const timer = window.setTimeout(() => {
      applyDismissalsToPreviewDOM(
        previewRef.current,
        dismissedIssues,
        selectedFile.name
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [dismissedIssues, markedBlob, selectedFile?.name]);

  const handleUndismiss = (recordsToRestore) => {
    if (!recordsToRestore?.length || !selectedFile?.name) return;
    // Build a set of keys to remove
    const keysToRemove = new Set(
      recordsToRestore.map((r) =>
        `${canonicalLabel(r?.label)}::${(r?.sentence || "").trim()}::${r?.file_name || ""}`
      )
    );
    const next = (dismissedIssues || []).filter((r) => {
      const key = `${canonicalLabel(r?.label)}::${(r?.sentence || "").trim()}::${r?.file_name || ""}`;
      return !keysToRemove.has(key);
    });
    setDismissedIssues(next);
    saveDismissedIssuesToStorage({
      markEventId: mciMarkEventId,
      fileName: selectedFile.name,
      dismissedIssues: next
    });
  };

  useEffect(() => {
    if (!markedBlob) {
      setWordCount(null);
      setStudentMetrics(null);
      return;
    }
    schedulePreviewStatsUpdate(80);
    return () => {
      if (previewMetricsTimerRef.current) {
        window.clearTimeout(previewMetricsTimerRef.current);
      }
    };
  }, [
    markedBlob,
    mode,
    mciLabelCounts,
    mciMarkEventId,
    powerVerbFormsSet,
    thesisDevicesLexicon
  ]);

  useEffect(() => {
    if (!supa) return undefined;
    let isActive = true;
    const loadUser = async () => {
      try {
        const { data } = await supa.auth.getSession();
        if (!isActive) return;
        setUserId(data?.session?.user?.id || "");
      } catch (err) {
        if (!isActive) return;
        setUserId("");
      }
    };
    loadUser();
    const { data: subscription } = supa.auth.onAuthStateChange(() => {
      loadUser();
    });
    return () => {
      isActive = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [supa]);

  useEffect(() => {
    if (!supa) return undefined;
    const { data: subscription } = supa.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        try { localStorage.removeItem("vysti_role"); localStorage.removeItem("vysti_products"); } catch {}
        redirectToSignin();
      }
    });
    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [redirectToSignin, supa]);

  useEffect(() => {
    if (!supa) return undefined;
    let isActive = true;
    const refreshSnapshot = async () => {
      try {
        const { data } = await supa.auth.getSession();
        if (!isActive) return;
        setAuthSnapshot({
          hasSession: Boolean(data?.session),
          email: data?.session?.user?.email || ""
        });
      } catch (err) {
        if (!isActive) return;
        setAuthSnapshot({ hasSession: false, email: "" });
      }
    };
    refreshSnapshot();
    const { data: subscription } = supa.auth.onAuthStateChange(() => {
      refreshSnapshot();
    });
    return () => {
      isActive = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [supa]);

  const pushToast = (toast) => {
    if (!statusToastsEnabled) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToastQueue((prev) => [...prev, { id, ...toast }]);
  };

  const dismissToast = (id) => {
    setToastQueue((prev) => prev.filter((toast) => toast.id !== id));
  };

  const setError = (message, details = null) => {
    setStatus({ message, kind: "error" });
    if (statusToastsEnabled) {
      pushToast({ kind: "error", title: "Error", message, details });
    }
  };

  const setSuccess = (message) => {
    setStatus({ message, kind: "success" });
  };

  const handlePaywall = () => {
    setShowPaywall(true);
  };

  const clearStatus = () => {
    setStatus({ message: "", kind: "info" });
  };

  const closeAllGuidanceOverlays = () => {
    setPreviewHint(null);
    setMetricInfoState({ open: false, anchorEl: null, metricKey: null });
    setPowerVerbsState({ open: false, anchorEl: null, textareaRef: null });
  };

  const recomputePreviewStats = () => {
    const container = previewRef.current;
    if (!container) return;
    const text = extractPreviewTextFromContainer(container);
    if (!text) return;
    const wc = wordCountFromText(text);
    setWordCount(Number.isFinite(wc) ? wc : null);
    // Scores are computed server-side and set from the marking response.
    // Word count still updates live during inline editing.
  };

  const schedulePreviewStatsUpdate = (delayMs = 350) => {
    if (previewMetricsTimerRef.current) {
      window.clearTimeout(previewMetricsTimerRef.current);
    }
    previewMetricsTimerRef.current = window.setTimeout(() => {
      recomputePreviewStats();
    }, delayMs);
  };

  const startRequest = (kind) => {
    const abortable = makeAbortableTimeout(0);
    setActiveRequest({ kind, cancel: abortable.cancel });
    return abortable;
  };

  const endRequest = () => {
    setActiveRequest(null);
  };

  const handleSessionExpired = () => {
    setStatus({ message: "Session expired—signing you back in…", kind: "error" });
    logEvent("session_expired");
    window.setTimeout(() => {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      redirectToSignin(returnTo);
    }, 150);
  };

  const parseTechniquesHeader = (header) => {
    if (!header) {
      return { type: "none", items: [], raw: "", error: "" };
    }
    const parsed = parseTechniquesHeaderShared(header);
    if (Array.isArray(parsed)) {
      const allStrings = parsed.every((item) => typeof item === "string");
      const allObjects = parsed.every(
        (item) => item && typeof item === "object" && !Array.isArray(item)
      );
      if (allStrings) {
        return { type: "strings", items: parsed, raw: header, error: "" };
      }
      if (allObjects) {
        return { type: "objects", items: parsed, raw: header, error: "" };
      }
    }
    if (typeof parsed === "string") {
      return {
        type: "invalid",
        items: [],
        raw: parsed,
        error: "Techniques header present but invalid JSON"
      };
    }
    return {
      type: "invalid",
      items: [],
      raw: header,
      error: "Techniques header present but invalid JSON"
    };
  };

  const getFilenameBase = () => {
    if (markedFilenameBase) return markedFilenameBase;
    const rawName = selectedFile?.name || "essay.docx";
    return rawName.replace(/\.(docx|pdf)$/i, "") || "essay";
  };

  const buildMarkedFilename = () => `${getFilenameBase()}_marked.docx`;

  const buildRevisedFilename = () => `${getFilenameBase()}_revised.docx`;

  const buildMlaHeader = (fields) => {
    const lines = [
      fields?.name?.trim(),
      fields?.teacher?.trim(),
      fields?.assignment?.trim(),
      fields?.date?.trim()
    ].filter(Boolean);
    // Each field must be separated by a double newline so the backend
    // treats each as its own paragraph in the .docx (single newlines
    // get collapsed into one line by build_doc_from_text).
    return lines.length ? `${lines.join("\n\n")}\n\n` : "";
  };

  const isAcceptedFile = (file) => {
    if (!file) return false;
    const name = file.name?.toLowerCase() || "";
    return (
      name.endsWith(".docx") ||
      name.endsWith(".pdf") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/pdf"
    );
  };

  const validateFile = (file) => {
    if (!file) return { ok: false, message: "No file selected." };
    if (!isAcceptedFile(file)) {
      return { ok: false, message: "Only .docx and .pdf files are allowed." };
    }
    if (file.size > MAX_DOCX_BYTES) {
      return {
        ok: false,
        message: "File is too large (max 15MB)."
      };
    }
    return { ok: true, message: "" };
  };

  const updateSelectedFile = (file) => {
    if (strictFileValidationEnabled) {
      const validation = validateFile(file);
      if (!validation.ok) {
        if (file) {
          logError("Invalid file selected", {
            fileName: file?.name || "",
            reason: validation.message
          });
        }
        setFileValidationError(validation.message);
        setError(validation.message);
        setSelectedFile(null);
        setMarkedBlob(null);
        setTechniques(EMPTY_TECHNIQUES);
        setTechniquesParsed(null);
        setLastMarkStatus(null);
        setLastMarkError("");
        setHasRevisedSinceMark(false);
        setMarkedFilenameBase("");
        setPreviewError("");
        setPreviewErrorStack("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
    } else if (!file || !isAcceptedFile(file)) {
      if (file) {
        setError("Please upload a .docx or .pdf file.");
        logError("Invalid file type selected", { fileName: file?.name || "" });
      }
      setSelectedFile(null);
      setMarkedBlob(null);
      setTechniques(EMPTY_TECHNIQUES);
      setTechniquesParsed(null);
      setLastMarkStatus(null);
      setLastMarkError("");
      setHasRevisedSinceMark(false);
      setMarkedFilenameBase("");
      setPreviewError("");
      setPreviewErrorStack("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    clearStatus();
    setFileValidationError("");
    setSelectedFile(file);
    setMarkedBlob(null);
    setTechniques(EMPTY_TECHNIQUES);
    setTechniquesParsed(null);
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
    setMarkedFilenameBase("");
    setPreviewError("");
    setPreviewErrorStack("");
    logEvent("file_selected", { fileName: file?.name || "" });
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    updateSelectedFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    updateSelectedFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setMarkedBlob(null);
    setTechniques(EMPTY_TECHNIQUES);
    setTechniquesParsed(null);
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
    setMarkedFilenameBase("");
    setFileValidationError("");
    setPreviewError("");
    setPreviewErrorStack("");
    setWordCount(null);
    setStudentMetrics(null);
    closeAllGuidanceOverlays();
    clearStatus();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMark = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }
    if (requestActive) return;
    closeAllGuidanceOverlays();
    setIsProcessing(true);
    setStatus({
      message: hardeningEnabled ? "Uploading..." : "Processing...",
      kind: "info"
    });
    if (statusToastsEnabled) {
      // Toast removed — status bar is sufficient
    }
    setLastMarkStatus(null);
    setLastMarkError("");
    const abortable = hardeningEnabled || cancelRequestsEnabled ? startRequest("mark") : null;

    try {
      const { blob, metadata, techniquesHeader, status: markStatus } = await markEssay({
        supa,
        file: selectedFile,
        mode,
        assignmentName,
        onSessionExpired: handleSessionExpired,
        signal: abortable?.signal,
        timeoutMs: hardeningEnabled ? 90000 : undefined
      });
      setStatus({
        message: hardeningEnabled ? "Rendering preview..." : "Marked successfully. Scroll down to Preview.",
        kind: "info"
      });
      // Clear selected attempt BEFORE setting markedBlob to avoid double MCI effect trigger
      setSelectedAttempt(null);
      setMarkedBlob(blob);
      setMarkMetadata(metadata);
      if (metadata?.scores) setStudentMetrics(metadata.scores);
      // Eagerly populate chart data from the API response so the focus-area
      // chart renders immediately without waiting for the Supabase round-trip.
      if (metadata?.label_counts) {
        setMciLabelCountsRaw(metadata.label_counts);
        setMciLabelCounts(metadata.label_counts);
      }
      if (metadata?.issues) setMciIssuesRich(metadata.issues);
      if (metadata?.mark_event_id) {
        setMciMarkEventId(metadata.mark_event_id);
      }
      // Cache spelling suggestions in a ref so they survive the Supabase round-trip
      // (Supabase doesn't store the suggestions column)
      if (metadata?.examples?.length) {
        const sugMap = new Map();
        for (const ex of metadata.examples) {
          if (ex.suggestions?.length && ex.found_value) {
            sugMap.set(`${ex.label}|${ex.found_value}`, ex.suggestions);
          }
        }
        spellingSuggestionsRef.current = sugMap;
        setMciIssues(metadata.examples);
      }
      setWorks([{
        author: metadata?.guessed_author || "",
        title: metadata?.guessed_title || "",
        isMinor: metadata?.guessed_is_minor ?? true,
      }]);
      setActiveWorkIndex(0);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      const parsed = parseTechniquesHeaderShared(techniquesHeader);
      setTechniquesParsed(Array.isArray(parsed) ? parsed : null);
      setHasRevisedSinceMark(false);
      schedulePreviewStatsUpdate(120);
      setPreviewError("");
      setPreviewErrorStack("");
      const baseName = (selectedFile?.name || "essay.docx").replace(/\.(docx|pdf)$/i, "") || "essay";
      setMarkedFilenameBase(baseName);
      if (showAttemptHistory) {
        refreshAttemptHistory();
      }
      setLastMarkStatus({ status: markStatus, ok: true });
      setSuccess("Marked successfully. Scroll down to Preview.");
    } catch (err) {
      console.error("Mark failed", err);
      if (err?.code === "TIMEOUT") {
        setError("This took too long. Try again (or check connection).", err);
      } else if (err?.code === "ABORTED") {
        setStatus({ message: "Canceled.", kind: "info" });
      } else if (err?.isEntitlementError) {
        handlePaywall("upload");
      } else {
        const message = err?.message || "Failed to mark essay. Please try again.";
        setLastMarkStatus({ status: err?.status ?? null, ok: false });
        setLastMarkError(message);
        setError(message, err);
      }
    } finally {
      abortable?.clear?.();
      if (abortable) endRequest();
      setIsProcessing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleMark();
  };

  const buildMarkTextPayload = (text) =>
    ({
      ...buildMarkTextPayloadShared({
        fileName: selectedFile?.name || "essay.docx",
        text,
        mode
      }),
      include_summary_table: false
    });

  const handleDownload = () => {
    if (!markedBlob) return;
    const filename = buildMarkedFilename();
    downloadBlob(markedBlob, filename);
    logEvent("download_started", { fileName: filename });
  };


  const handleRecheck = async () => {
    if (!markedBlob) return;
    if (requestActive) return;
    if (!hasRevisedSinceMark) return;
    closeAllGuidanceOverlays();
    // Clear focus mode and all highlights before recheck
    const container = previewRef.current;
    if (container) clearAllHighlightModes(container);

    // Save centered paragraph texts so we can restore centering after re-render
    const centeredTexts = new Set();
    if (container) {
      container.querySelectorAll("p, li").forEach((p) => {
        const s = window.getComputedStyle(p);
        if (s.textAlign === "center" || s.textAlign === "-webkit-center") {
          const t = (p.textContent || "").trim();
          if (t) centeredTexts.add(t);
        }
      });
    }
    pendingCenteredTextsRef.current = centeredTexts.size ? centeredTexts : null;

    // Save italic text runs so we can restore them after re-render
    // Map: paragraphText → Set<italicSubstring>
    const italicMap = new Map();
    if (container) {
      container.querySelectorAll("p, li").forEach((p) => {
        const paraText = (p.textContent || "").trim();
        if (!paraText) return;
        const italicRuns = new Set();
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (!t) continue;
          let el = node.parentElement;
          while (el && el !== p.parentElement) {
            const fs = window.getComputedStyle(el).fontStyle;
            if (fs === "italic" || fs === "oblique") {
              italicRuns.add(t);
              break;
            }
            el = el.parentElement;
          }
        }
        if (italicRuns.size > 0) italicMap.set(paraText, italicRuns);
      });
    }
    pendingItalicTextsRef.current = italicMap.size ? italicMap : null;

    const rawText = extractPreviewTextFromContainer(container);
    if (!rawText) {
      // Clear all old data when document is empty
      handleClearPreview();
      setError("Please add text to the preview before rechecking.");
      return;
    }
    const text = cleanupCommonTypos(rawText);

    setIsRechecking(true);
    setStudentMetrics(null);
    setMciSelectedLabel("");
    setStatus({ message: "Rechecking...", kind: "info" });
    if (statusToastsEnabled) {
      // Toast removed — status bar is sufficient
    }
    const abortable = hardeningEnabled || cancelRequestsEnabled ? startRequest("recheck") : null;

    try {
      const recheckPayload = buildMarkTextPayload(text);
      const validWorks = works.filter(w => w.author.trim() || w.title.trim());
      if (validWorks.length > 0) {
        recheckPayload.titles = validWorks.map(w => ({
          author: w.author.trim(),
          title: w.title.trim(),
          is_minor: w.isMinor,
        }));
      }
      const { blob, metadata, techniquesHeader } = await markText({
        supa,
        payload: recheckPayload,
        onSessionExpired: handleSessionExpired,
        signal: abortable?.signal,
        timeoutMs: hardeningEnabled ? 60000 : undefined
      });
      // Clear selected attempt BEFORE setting markedBlob to avoid double MCI effect trigger
      setSelectedAttempt(null);
      setMarkedBlob(blob);
      if (metadata) {
        setMarkMetadata(metadata);
        if (metadata?.scores) setStudentMetrics(metadata.scores);
        // Eagerly populate chart data from the API response so the focus-area
        // chart renders immediately without waiting for the Supabase round-trip.
        if (metadata?.label_counts) {
          setMciLabelCountsRaw(metadata.label_counts);
          setMciLabelCounts(metadata.label_counts);
        }
        if (metadata?.issues) setMciIssuesRich(metadata.issues);
        if (metadata?.mark_event_id) {
          setMciMarkEventId(metadata.mark_event_id);
        }
        if (metadata?.examples?.length) {
          const sugMap = new Map();
          for (const ex of metadata.examples) {
            if (ex.suggestions?.length && ex.found_value) {
              sugMap.set(`${ex.label}|${ex.found_value}`, ex.suggestions);
            }
          }
          spellingSuggestionsRef.current = sugMap;
          setMciIssues(metadata.examples);
        }
      }
      setTechniques(parseTechniquesHeader(techniquesHeader));
      const parsed = parseTechniquesHeaderShared(techniquesHeader);
      setTechniquesParsed(Array.isArray(parsed) ? parsed : null);
      // Note: do NOT reset hasRevisedSinceMark here — the user has revised
      // their essay and should be able to download the revised version after recheck.
      schedulePreviewStatsUpdate(120);
      setPreviewError("");
      setPreviewErrorStack("");
      if (showAttemptHistory) {
        refreshAttemptHistory();
      }
      setSuccess("Rechecked ✅");
    } catch (err) {
      console.error("Recheck failed", err);
      if (err?.code === "TIMEOUT") {
        setError("This took too long. Try again (or check connection).", err);
      } else if (err?.code === "ABORTED") {
        setStatus({ message: "Canceled.", kind: "info" });
      } else if (err?.isEntitlementError) {
        handlePaywall("recheck");
      } else {
        const message = err?.message || "Failed to recheck essay. Please try again.";
        setError(message, err);
      }
    } finally {
      abortable?.clear?.();
      if (abortable) endRequest();
      setIsRechecking(false);
    }
  };

  const handlePreviewEdited = () => {
    setHasRevisedSinceMark(true);
    schedulePreviewStatsUpdate(350);
  };

  // ── Undo helpers ──
  const saveUndoSnapshot = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const html = container.innerHTML;
    if (html === lastSnapshotHtmlRef.current) return;
    lastSnapshotHtmlRef.current = html;
    const stack = undoStackRef.current;
    stack.push(html);
    if (stack.length > MAX_UNDO) stack.shift();
  }, []);

  const debouncedSnapshot = useCallback(() => {
    clearTimeout(undoDebounceRef.current);
    undoDebounceRef.current = setTimeout(saveUndoSnapshot, 400);
  }, [saveUndoSnapshot]);

  const handleUndo = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const html = stack.pop();
    lastSnapshotHtmlRef.current = html;
    container.innerHTML = DOMPurify.sanitize(html, { FORCE_BODY: true });
    setHasRevisedSinceMark(true);
    schedulePreviewStatsUpdate(350);
  }, []);

  // Capture undo snapshot on text input (debounced)
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const onBeforeInput = () => debouncedSnapshot();
    container.addEventListener("beforeinput", onBeforeInput);
    return () => container.removeEventListener("beforeinput", onBeforeInput);
  }, [debouncedSnapshot]);

  // Intercept Ctrl+Z / Cmd+Z on the preview container
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const onKeyDown = (e) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  // Initialize undo stack when a new marked blob renders
  useEffect(() => {
    if (!markedBlob) return;
    // Small delay to let useDocxPreview finish rendering
    const t = setTimeout(() => {
      const container = previewRef.current;
      if (container) {
        undoStackRef.current = [];
        lastSnapshotHtmlRef.current = container.innerHTML;
      }
    }, 500);
    return () => clearTimeout(t);
  }, [markedBlob]);

  const handlePreviewError = (err) => {
    if (!err) {
      setPreviewError("");
      setPreviewErrorStack("");
      return;
    }
    setPreviewError(err?.message || "Preview render failed");
    setPreviewErrorStack(err?.stack || "");
  };

  const handleClearPreview = () => {
    setMarkedBlob(null);
    setHasRevisedSinceMark(false);
    setPreviewError("");
    setPreviewErrorStack("");
    setWordCount(null);
    setWorks([{ author: "", title: "", isMinor: true }]);
    setActiveWorkIndex(0);
    setStudentMetrics(null);
    setMciSelectedLabel("");
    setMarkMetadata(null);
  };

  const handleRefreshMci = () => {
    setMciRefreshToken((prev) => prev + 1);
  };

  const scrollToRevisionPractice = () => {
    const target = document.getElementById("revisionPracticeCard");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOpenRevisionFromLabel = (label) => {
    if (!label) return;
    setMciSelectedLabel(label);
    scrollToRevisionPractice();
  };

  const handleTourNeedsRevisionLabel = () => {
    // Labels that work well in the Revision card for the tour walkthrough.
    // Each shows a clear, bounded error the student can fix in one sentence.
    const TOUR_REPAIRABLE = new Set([
      // Power — verb quality
      "Avoid weak verbs",
      // Analysis — quotation handling
      "Shorten, modify, and integrate quotations",
      "Only cite a quotation once",
      "No quotations in thesis statements",
      "Avoid beginning a sentence with a quotation",
      // Precision — concision
      "Avoid referring to the reader or audience unless necessary",
      "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
      "Use the author's name instead of 'the author'",
      "No 'I', 'we', 'us', 'our' or 'you' in academic writing",
      "No contractions in academic writing",
      "Avoid the word 'which'",
      "Avoid using the word 'and' more than twice in a sentence",
      // Precision — clarity / vague terms
      "Avoid the vague term 'society'",
      "Avoid the vague term 'universe'",
      "Avoid the vague term 'reality'",
      "Avoid the vague term 'life'",
      "Avoid the vague term 'truth'",
      "Avoid the vague term 'human'",
      "Avoid the vague term 'people'",
      "Avoid the vague term 'everyone'",
      "Avoid the vague term 'individual'",
      "Clarify pronouns and antecedents",
      "Do not refer to the text as a text; refer to context instead",
      "Avoid absolute language like 'always' or 'never'",
      "Avoid the word 'ethos'",
      "Avoid the word 'pathos'",
      "Avoid the word 'logos'",
      "Avoid the word 'very'",
      "Avoid the phrase 'a lot'",
      "Avoid the word 'fact'",
      "Avoid the word 'proof'",
      "Avoid the word 'prove'",
      // Precision — conventions
      "Check subject-verb agreement",
      "Spelling error",
      "Commonly confused word",
      "Comma after introductory word",
      "Possessive apostrophe",
      "Write out the numbers one through ten",
      "Article error",
      "Uncountable noun",
    ]);

    const labels = Object.keys(mciLabelCounts || {});
    const repairable = labels.find((l) => (mciLabelCounts[l] || 0) > 0 && TOUR_REPAIRABLE.has(l));
    if (repairable) {
      setMciSelectedLabel(repairable);
      scrollToRevisionPractice();
    }
  };


  const handleCancelRequest = () => {
    if (!cancelRequestsEnabled) return;
    if (!activeRequest?.cancel) return;
    activeRequest.cancel();
    pushToast({ kind: "warn", title: "Canceled", message: "Request canceled." });
    setStatus({ message: "Canceled.", kind: "info" });
  };

  const restoreDraft = async (draftText) => {
    if (!draftText) return;
    if (!supa) {
      setError("Supabase is not available.");
      return;
    }
    if (!apiBase) {
      setError("Missing API configuration. Please refresh.");
      return;
    }
    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) {
        handleSessionExpired();
        return;
      }
      const outputName = buildRevisedFilename();
      const response = await fetchWithTimeout(
        `${apiBase}/export_docx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ file_name: outputName, text: draftText })
        },
        { timeoutMs: 60000 }
      );

      if (isAuthExpired(response)) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const blob = await response.blob();
      setMarkedBlob(blob);
      setHasRevisedSinceMark(true);
      setStatus({ kind: "success", message: "Draft restored into preview." });
      setDraftMeta(null);
      setDraftDismissed(true);
    } catch (err) {
      console.error("Draft restore failed", err);
      setError(err?.message || "Failed to restore draft.");
    }
  };

  const handleRestoreDraft = () => {
    if (!draftMeta?.text) return;
    restoreDraft(draftMeta.text);
  };

  const handleDismissDraft = () => {
    setDraftDismissed(true);
  };

  const handleKeepWorking = async (draft) => {
    if (!draft?.text) return;
    if (draft.mode) setMode(draft.mode);

    // Create a synthetic File so MCI effect and autosave key work
    const fileName = draft.fileName || "essay.docx";
    const syntheticFile = new File([""], fileName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    setSelectedFile(syntheticFile);

    const text = cleanupCommonTypos(draft.text);
    setIsRestoringDraft(true);
    setIsRechecking(true);
    setStudentMetrics(null);
    setMciSelectedLabel("");
    setStatus({ message: "Restoring your revision\u2026", kind: "info" });

    try {
      const payload = {
        ...buildMarkTextPayloadShared({
          fileName,
          text,
          mode: draft.mode || mode
        }),
        include_summary_table: false
      };
      const { blob, metadata, techniquesHeader } = await markText({
        supa,
        payload,
        onSessionExpired: handleSessionExpired
      });
      setSelectedAttempt(null);
      setMarkedBlob(blob);
      if (metadata) {
        setMarkMetadata(metadata);
        if (metadata?.scores) setStudentMetrics(metadata.scores);
        if (metadata?.examples?.length) {
          const sugMap = new Map();
          for (const ex of metadata.examples) {
            if (ex.suggestions?.length && ex.found_value) {
              sugMap.set(`${ex.label}|${ex.found_value}`, ex.suggestions);
            }
          }
          spellingSuggestionsRef.current = sugMap;
          setMciIssues(metadata.examples);
        }
      }
      setTechniques(parseTechniquesHeader(techniquesHeader));
      const parsed = parseTechniquesHeaderShared(techniquesHeader);
      setTechniquesParsed(Array.isArray(parsed) ? parsed : null);
      setHasRevisedSinceMark(true);
      schedulePreviewStatsUpdate(120);
      setPreviewError("");
      setPreviewErrorStack("");
      setSuccess("Revision restored.");
      setTimeout(() => setMciRefreshToken((prev) => prev + 1), 1500);
    } catch (err) {
      console.error("Keep working restore failed", err);
      setError(err?.message || "Failed to restore revision.");
    } finally {
      setIsRechecking(false);
      setIsRestoringDraft(false);
    }
  };

  const handleDeleteDraft = () => {
    if (!selectedFile || !userId) return;
    deleteDraft({ userId, fileName: selectedFile.name, mode });
    if (saveProgressEnabled && supa) {
      deleteRevisionDraftFromSupabase({ supa, userId, fileName: selectedFile.name, mode });
    }
    setDraftMeta(null);
    setDraftDismissed(true);
    setStatus({ kind: "info", message: "Draft deleted." });
  };

  const handleSaveProgress = async () => {
    const container = previewRef.current;
    if (!container || !userId || !selectedFile) return;
    const text = extractPreviewTextFromContainer(container);
    if (!shouldAutosave(text)) {
      setStatus({ kind: "info", message: "Not enough text to save." });
      return;
    }
    clearTimeout(saveProgressTimerRef.current);
    setSaveProgressState("saving");
    try {
      const localPayload = saveDraft({ userId, fileName: selectedFile.name, mode, text });
      if (supa) {
        const result = await saveRevisionDraftToSupabase({
          supa, userId, fileName: selectedFile.name, mode, text,
          markEventId: mciMarkEventId
        });
        const savedAt = result?.savedAt || localPayload?.savedAt;
        setDraftMeta({ text, savedAt });
      } else if (localPayload) {
        setDraftMeta(localPayload);
      }
      setSaveProgressState("saved");
      saveProgressTimerRef.current = setTimeout(() => setSaveProgressState("idle"), 2500);
    } catch (err) {
      console.warn("[saveProgress] error:", err);
      setSaveProgressState("idle");
      setStatus({ kind: "error", message: "Failed to save progress." });
    }
  };

  const handleNavigateToExample = (sentenceOrExample) => {
    const container = previewRef.current;
    if (!container) {
      setStatus({ kind: "error", message: "Preview is not ready yet." });
      return false;
    }

    // Accept either a string OR an object with a sentence field.
    const exampleObj =
      typeof sentenceOrExample === "string"
        ? { sentence: sentenceOrExample }
        : sentenceOrExample || {};

    const sentence = String(
      exampleObj?.sentence || exampleObj?.sentence_text || exampleObj?.text || ""
    ).trim();

    if (!sentence) {
      setStatus({ kind: "error", message: "No sentence to navigate to." });
      return false;
    }

    // Clear all active highlight modes so the UI doesn't "stick"
    clearAllHighlightModes(container);

    // IMPORTANT: pass the full example object so paragraph_index can be used.
    const match = findBestMatchBlock(container, { ...exampleObj, sentence });

    if (!match || !match.el) {
      setStatus({
        kind: "error",
        message: "Couldn’t find that sentence in the preview (docx HTML mismatch)."
      });
      return false;
    }

    // Apply optional highlight class (e.g. yellow for conventions)
    if (exampleObj.highlightClass) {
      if (match.hits?.length) {
        match.hits.forEach((span) => span.classList.add(exampleObj.highlightClass));
      } else if (match.el) {
        match.el.classList.add(exampleObj.highlightClass);
      }
    }

    scrollAndFlash(match.el, { block: "center" });
    enableFocusMode(container, { match, label: exampleObj?.label });
    return true;
  };

  // ── Smooth scroll helpers (eased, non-jarring) ──
  const smoothScrollTo = (element, targetScrollTop, duration = 380) => {
    const start = element.scrollTop;
    const delta = targetScrollTop - start;
    if (Math.abs(delta) < 2) return;
    const startTime = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      element.scrollTop = start + delta * ease(progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const smoothPageScroll = (targetY, duration = 420) => {
    const start = window.scrollY;
    const delta = targetY - start;
    if (Math.abs(delta) < 2) return Promise.resolve();
    const startTime = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return new Promise((resolve) => {
      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        window.scrollTo(0, start + delta * ease(progress));
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  };

  const handleHighlightVarietyParagraph = (example) => {
    const container = previewRef.current;
    if (!container) return false;

    clearAllHighlightModes(container);
    const blockEl = highlightVarietyBlock(container, example);
    if (!blockEl) return false;
    enableFocusMode(container);

    const topbar = document.querySelector(".topbar");
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    const zoom = parseFloat(container.style.zoom) || 1;

    // Scroll helper: positions block inside container at visible top
    const scrollContainerToBlock = () => {
      const cRect = container.getBoundingClientRect();
      const bRect = blockEl.getBoundingClientRect();
      const visibleTop = Math.max(cRect.top, topbarH);
      const delta = ((bRect.top - visibleTop) - 40) / zoom;
      if (Math.abs(delta) > 2) {
        smoothScrollTo(container, container.scrollTop + delta, 350);
      }
    };

    // 1. Page scroll: smoothly bring preview card near top of viewport
    const card = document.getElementById("markedPreviewCard");
    const needsPageScroll = card &&
      Math.abs(card.getBoundingClientRect().top - (topbarH + 8)) > 50;

    if (needsPageScroll) {
      smoothPageScroll(
        window.scrollY + card.getBoundingClientRect().top - topbarH - 8, 400
      ).then(scrollContainerToBlock).catch(() => {});
    } else {
      scrollContainerToBlock();
    }

    blockEl.classList.add("vysti-flash-highlight");
    window.setTimeout(() => blockEl.classList.remove("vysti-flash-highlight"), 1400);
    return true;
  };

  // Strip Vysti inline labels ("→ ...") from text for clean matching
  const stripVystiLabelsFromText = (text) =>
    String(text || "")
      .replace(/\s*→\s*[^.!?\n]{0,180}/g, " ")
      .replace(/\*\s*Rewrite this paragraph for practice\s*\*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const handleHighlightTechniquesParagraph = (example, paraText) => {
    const container = previewRef.current;
    if (!container) return { ok: false, devices: [] };
    clearAllHighlightModes(container);

    // Get all non-empty preview blocks
    const allBlocks = Array.from(container.querySelectorAll("p, li")).filter(
      (b) => (b.textContent || "").trim().length > 0
    );

    // Helper: detect if a block is centered (title/heading)
    const isCentered = (block) => {
      const style = window.getComputedStyle(block);
      return style.textAlign === "center" || style.textAlign === "-webkit-center";
    };

    // Filter out all centered blocks (titles, section headings, etc.)
    let nonCenteredBlocks = allBlocks.filter((block) => !isCentered(block));

    // Strip leading header blocks (date, name, class, etc.)
    // — mirrors studentMetrics.js stripLeadingHeaderParagraphs()
    const isHeaderBlock = (block) => {
      const t = (block.textContent || "").trim();
      const wc = t.split(/\s+/).filter(Boolean).length;
      if (wc > 12) return false;
      if (/[.!?]/.test(t)) return false;
      return /\d/.test(t) ||
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) ||
        /\b(teacher|class|block|period|assignment|name|date)\b/i.test(t);
    };
    let headersStripped = 0;
    while (nonCenteredBlocks.length > 3 && headersStripped < 6 && isHeaderBlock(nonCenteredBlocks[0])) {
      nonCenteredBlocks = nonCenteredBlocks.slice(1);
      headersStripped++;
    }

    // Strip title-like first paragraph (short, no sentence-ending punctuation,
    // followed by a longer paragraph that looks like an actual intro)
    if (nonCenteredBlocks.length >= 4) {
      const firstText = (nonCenteredBlocks[0].textContent || "").trim();
      const firstWc = firstText.split(/\s+/).filter(Boolean).length;
      if (firstWc <= 20 && !/[.!?]["'\u201D\u2019)]*\s*$/.test(firstText)) {
        const secondText = (nonCenteredBlocks[1].textContent || "").trim();
        const secondWc = secondText.split(/\s+/).filter(Boolean).length;
        if (secondWc >= 20) {
          nonCenteredBlocks = nonCenteredBlocks.slice(1);
        }
      }
    }

    if (nonCenteredBlocks.length < 3) {
      // Not enough paragraphs to distinguish intro/body/conclusion
      return { ok: false, devices: [] };
    }

    // Body = non-centered blocks minus first (intro) and last (conclusion)
    const bodyBlocks = nonCenteredBlocks.slice(1, -1);
    if (!bodyBlocks.length) return { ok: false, devices: [] };

    // Map paragraph_index to a block (including intro)
    const ex = typeof example === "string" ? { sentence: example } : example || {};
    const pIdx = ex.paragraph_index;

    let blockEl = null;

    // Check if this is the intro paragraph (pIdx === 0)
    if (typeof pIdx === "number" && pIdx >= 0 && pIdx < allBlocks.length) {
      const targetBlock = allBlocks[pIdx];

      // Special case: intro paragraph is first non-centered block
      // Use indexOf to check position rather than reference equality
      const targetInNonCentered = nonCenteredBlocks.indexOf(targetBlock);
      if (targetInNonCentered === 0) {
        blockEl = nonCenteredBlocks[0];
      } else if (targetInNonCentered < 0) {
        // Target is a centered block (e.g. the title) — if it precedes the
        // first non-centered block in allBlocks, treat as the intro paragraph
        const firstNCAllIdx = allBlocks.indexOf(nonCenteredBlocks[0]);
        if (pIdx <= firstNCAllIdx) {
          blockEl = nonCenteredBlocks[0];
        } else {
          // Centered block after the intro — use nearest body block
          const bodyIdx = Math.min(Math.max(0, Math.floor(bodyBlocks.length / 2)), bodyBlocks.length - 1);
          blockEl = bodyBlocks[bodyIdx];
        }
      } else {
        // Otherwise, map to body blocks
        const targetBodyIdx = bodyBlocks.indexOf(targetBlock);
        if (targetBodyIdx >= 0) {
          blockEl = bodyBlocks[targetBodyIdx];
        } else {
          // Paragraph is not in body (it's intro or conclusion) — use nearest body block
          const bodyIdx = Math.min(Math.max(0, Math.floor(bodyBlocks.length / 2)), bodyBlocks.length - 1);
          blockEl = bodyBlocks[bodyIdx];
        }
      }
    } else {
      // Default to first body paragraph if no valid pIdx
      blockEl = bodyBlocks[0];
    }

    if (!blockEl) return { ok: false, devices: [] };
    blockEl.classList.add("vysti-preview-tech-block");
    enableFocusMode(container);

    const lexiconSize = thesisDevicesLexicon?.size || 0;
    if (!lexiconSize) {
      setStatus({ kind: "warn", message: "Techniques lexicon not loaded." });
    } else {
      highlightThesisDevicesInBlock(blockEl, thesisDevicesLexicon);
    }

    const topbar = document.querySelector(".topbar");
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    const zoom = parseFloat(container.style.zoom) || 1;

    // Scroll helper: positions block inside container at visible top
    const scrollContainerToBlock = () => {
      const cRect = container.getBoundingClientRect();
      const bRect = blockEl.getBoundingClientRect();
      const visibleTop = Math.max(cRect.top, topbarH);
      const delta = ((bRect.top - visibleTop) - 40) / zoom;
      if (Math.abs(delta) > 2) {
        smoothScrollTo(container, container.scrollTop + delta, 350);
      }
    };

    // 1. Page scroll: smoothly bring preview card near top of viewport
    const card = document.getElementById("markedPreviewCard");
    const needsPageScroll = card &&
      Math.abs(card.getBoundingClientRect().top - (topbarH + 8)) > 50;

    if (needsPageScroll) {
      smoothPageScroll(
        window.scrollY + card.getBoundingClientRect().top - topbarH - 8, 400
      ).then(scrollContainerToBlock).catch(() => {});
    } else {
      scrollContainerToBlock();
    }

    blockEl.classList.add("vysti-flash-highlight");
    window.setTimeout(() => blockEl.classList.remove("vysti-flash-highlight"), 1400);

    // Return detected devices from what was ACTUALLY highlighted in the DOM,
    // not from a separate text scan of the raw paragraph (which can disagree
    // due to Vysti labels, partial block matches, or substring false positives)
    let devices = [];
    if (thesisDevicesLexicon) {
      let highlightedSpans = blockEl.querySelectorAll(".vysti-device-hit");

      // If this is the intro paragraph, filter to only techniques in the thesis (last sentence)
      // Use indexOf to check position rather than reference equality
      const blockIndex = nonCenteredBlocks.indexOf(blockEl);
      const isIntroBlock = blockIndex === 0;
      if (isIntroBlock) {
        // Find the last sentence in the intro paragraph by finding the last period/!/?
        const blockText = blockEl.textContent || "";

        // Find the position of the last sentence-ending punctuation
        const lastPeriod = blockText.lastIndexOf('.');
        const lastQuestion = blockText.lastIndexOf('?');
        const lastExclaim = blockText.lastIndexOf('!');
        const lastPunctPos = Math.max(lastPeriod, lastQuestion, lastExclaim);

        if (lastPunctPos > 0) {
          // Find the second-to-last sentence-ending punctuation
          const beforeLast = blockText.substring(0, lastPunctPos);
          const secondLastPeriod = beforeLast.lastIndexOf('.');
          const secondLastQuestion = beforeLast.lastIndexOf('?');
          const secondLastExclaim = beforeLast.lastIndexOf('!');
          const secondLastPunctPos = Math.max(secondLastPeriod, secondLastQuestion, secondLastExclaim);

          // Thesis sentence starts after the second-to-last punctuation
          const thesisStartPos = secondLastPunctPos >= 0 ? secondLastPunctPos + 1 : 0;
          const thesisSentence = blockText.substring(thesisStartPos).trim();

          // Filter spans to only those within the thesis sentence
          highlightedSpans = Array.from(highlightedSpans).filter((span) => {
            const spanText = (span.textContent || "").trim();
            return spanText && thesisSentence.toLowerCase().includes(spanText.toLowerCase());
          });
        }
      }

      const canonicals = new Set();

      // Primary: read device names from the green-highlighted spans
      highlightedSpans.forEach((span) => {
        const t = (span.textContent || "").trim().toLowerCase();
        if (t && thesisDevicesLexicon.has(t)) {
          canonicals.add(thesisDevicesLexicon.get(t));
        }
      });

      // If no span-level matches (e.g. multi-word terms split across spans),
      // scan the appropriate text content with word-boundary regex
      if (canonicals.size === 0 && highlightedSpans.length > 0) {
        let textToScan = blockEl.textContent || "";

        // For intro, only scan the thesis sentence
        if (isIntroBlock) {
          const lastPeriod = textToScan.lastIndexOf('.');
          const lastQuestion = textToScan.lastIndexOf('?');
          const lastExclaim = textToScan.lastIndexOf('!');
          const lastPunctPos = Math.max(lastPeriod, lastQuestion, lastExclaim);

          if (lastPunctPos > 0) {
            const beforeLast = textToScan.substring(0, lastPunctPos);
            const secondLastPeriod = beforeLast.lastIndexOf('.');
            const secondLastQuestion = beforeLast.lastIndexOf('?');
            const secondLastExclaim = beforeLast.lastIndexOf('!');
            const secondLastPunctPos = Math.max(secondLastPeriod, secondLastQuestion, secondLastExclaim);
            const thesisStartPos = secondLastPunctPos >= 0 ? secondLastPunctPos + 1 : 0;
            textToScan = textToScan.substring(thesisStartPos);
          }
        }

        const scanText = textToScan.toLowerCase();
        for (const [term, canonical] of thesisDevicesLexicon.entries()) {
          if (!term) continue;
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`\\b${escaped}\\b`, "i");
          if (re.test(scanText)) canonicals.add(canonical);
        }
      }

      devices = Array.from(canonicals).sort();
    }
    return { ok: true, devices };
  };

  // ── Scan ALL body paragraphs for techniques (for summary popover) ──
  const handleScanAllTechniques = useCallback(() => {
    if (!thesisDevicesLexicon?.size || !studentMetrics?.variety?.details) return [];
    const paras = studentMetrics.variety.details.paragraphsOriginal || [];
    const bodyIndices = studentMetrics.variety.details.bodyParagraphPreviewIndices || [];
    const found = new Set();
    for (const idx of bodyIndices) {
      const text = (paras[idx] || "").toLowerCase();
      for (const [term, canonical] of thesisDevicesLexicon.entries()) {
        if (!term) continue;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
          found.add(canonical);
        }
      }
    }
    return Array.from(found).sort();
  }, [thesisDevicesLexicon, studentMetrics]);

  // ── Power Verb jump: scan preview DOM for weak verbs not in power verbs list ──
  const powerVerbHistoryRef = useRef([]);  // array of { span, word, blockEl }
  const powerVerbIndexRef = useRef(0);
  const powerVerbScanModeRef = useRef("weak"); // "weak" or "found"

  const nounRepetitionHistoryRef = useRef([]);  // array of { span, lemma, blockEl }
  const nounRepetitionActiveRef = useRef(false); // toggle state
  const [highlightResetKey, setHighlightResetKey] = useState(0);

  const cleanupPowerVerbHighlights = (container) => {
    if (!container) return;
    container.querySelectorAll(".vysti-power-verb-hit, .vysti-power-verb-found").forEach((sp) => {
      const parent = sp.parentNode;
      if (parent) {
        while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
        parent.removeChild(sp);
      }
    });
    container.normalize();
  };

  const handleJumpPowerVerb = (delta = 1, { mode = "weak" } = {}) => {
    const container = previewRef.current;
    if (!container) return { ok: false, idx: 0, total: 0, word: "" };

    // Rebuild when mode changes
    const modeChanged = mode !== powerVerbScanModeRef.current;
    if (modeChanged) {
      cleanupPowerVerbHighlights(container);
      powerVerbHistoryRef.current = [];
      powerVerbIndexRef.current = 0;
      powerVerbScanModeRef.current = mode;
    }

    // Build list on first call, on refresh, or if DOM was rebuilt (recheck/re-mark)
    const hitsStale = powerVerbHistoryRef.current.length > 0 &&
      !powerVerbHistoryRef.current[0]?.span?.isConnected;
    if (!powerVerbHistoryRef.current.length || delta === 0 || hitsStale) {
      clearAllHighlightModes(container);

      const blocks = Array.from(container.querySelectorAll("p, li"));
      // Pass 1: collect all {node, start, end, word, blockEl}
      const matches = [];

      // Helper: check if a text node is inside a Vysti label (yellow "→ ..." labels)
      const isInsideVystiLabel = (textNode, blockEl) => {
        // Check the text itself
        const t = (textNode.textContent || "").trim();
        if (t.startsWith("\u2192")) return true; // → arrow
        // Walk up to the nearest span and check its full text
        let el = textNode.parentElement;
        while (el && el !== blockEl) {
          if (el.tagName === "SPAN") {
            const spanText = (el.textContent || "").trim();
            if (spanText.startsWith("\u2192")) return true;
            // Also check for bold+yellow styling (Vysti label pattern)
            const style = el.getAttribute("style") || "";
            if (style.includes("background") && style.includes("yellow")) return true;
            if (style.includes("background-color") && (style.includes("#ff") || style.includes("rgb(255"))) return true;
          }
          const cl = el.classList;
          if (cl && (cl.contains("vysti-label") || cl.contains("vysti-inline-label") || cl.contains("vysti-clickable-label"))) {
            return true;
          }
          if (el.hasAttribute && el.hasAttribute("data-vysti")) return true;
          el = el.parentElement;
        }
        return false;
      };

      // Helper: build a set of character ranges inside double quotes for a block
      const getQuoteRanges = (text) => {
        const ranges = [];
        let inQuote = false;
        let start = 0;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
            if (!inQuote) {
              inQuote = true;
              start = i;
            } else {
              ranges.push([start, i]);
              inQuote = false;
            }
          }
        }
        return ranges;
      };

      const isInsideQuotes = (charIdx, ranges) => {
        for (const [s, e] of ranges) {
          if (charIdx >= s && charIdx <= e) return true;
        }
        return false;
      };

      for (const block of blocks) {
        // Build quote ranges from the block's full text
        const blockText = block.textContent || "";
        const quoteRanges = getQuoteRanges(blockText);

        // Build a char-offset map: for each text node, track its start offset in blockText
        const nodeOffsets = new Map();
        let charOffset = 0;
        const offsetWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let oNode;
        while ((oNode = offsetWalker.nextNode())) {
          nodeOffsets.set(oNode, charOffset);
          charOffset += (oNode.textContent || "").length;
        }

        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            if (isInsideVystiLabel(node, block)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let textNode;
        while ((textNode = walker.nextNode())) {
          const text = textNode.textContent || "";
          const nodeStart = nodeOffsets.get(textNode) || 0;
          const wordRe = /\b([a-zA-Z]+)\b/g;
          let m;
          while ((m = wordRe.exec(text))) {
            const wordLower = m[1].toLowerCase();
            if (mode === "found") {
              // Scanning for power verbs the student used
              if (!powerVerbFormsSet || !powerVerbFormsSet.has(wordLower)) continue;
            } else {
              // Scanning for weak verbs that need replacement
              if (!WEAK_VERBS.has(wordLower)) continue;
              if (powerVerbFormsSet && powerVerbFormsSet.has(wordLower)) continue;
              // Skip "state"/"states" when used as a noun ("the state of", "United States")
              if (wordLower === "state" || wordLower === "states") {
                const after = text.slice(m.index + m[1].length, m.index + m[1].length + 4).toLowerCase();
                const before = text.slice(Math.max(0, m.index - 7), m.index).toLowerCase();
                if (after.startsWith(" of ") || before.endsWith("united ")) continue;
              }
            }
            // Skip words inside double quotes
            const absCharIdx = nodeStart + m.index;
            if (quoteRanges.length && isInsideQuotes(absCharIdx, quoteRanges)) continue;
            matches.push({
              node: textNode,
              start: m.index,
              end: m.index + m[1].length,
              word: m[1],   // preserve original case for display matching
              blockEl: block
            });
          }
        }
      }

      // Pass 2: wrap matches — group by text node, process each in reverse offset order
      const byNode = new Map();
      for (const m of matches) {
        if (!byNode.has(m.node)) byNode.set(m.node, []);
        byNode.get(m.node).push(m);
      }

      const hits = [];
      for (const [node, nodeMatches] of byNode) {
        // Sort descending by start so splitting from the end keeps earlier offsets valid
        nodeMatches.sort((a, b) => b.start - a.start);
        let curNode = node;
        for (const m of nodeMatches) {
          try {
            const curText = curNode.textContent || "";
            // Adjust: if this node was shortened by a prior split, skip
            if (m.start >= curText.length) continue;
            const actualEnd = Math.min(m.end, curText.length);

            // Split after the word
            if (actualEnd < curText.length) {
              curNode.splitText(actualEnd);
            }
            // Split before the word
            const targetNode = m.start > 0 ? curNode.splitText(m.start) : curNode;

            const span = document.createElement("span");
            span.className = mode === "found" ? "vysti-power-verb-found" : "vysti-power-verb-hit";
            targetNode.parentNode.insertBefore(span, targetNode);
            span.appendChild(targetNode);
            hits.push({ span, word: m.word, blockEl: m.blockEl });
          } catch (e) {
            // Skip if DOM manipulation fails
          }
        }
      }

      // Sort hits by DOM position (compareDocumentPosition)
      hits.sort((a, b) => {
        if (a.span === b.span) return 0;
        const pos = a.span.compareDocumentPosition(b.span);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      powerVerbHistoryRef.current = hits;
      powerVerbIndexRef.current = -1;
    }

    const hits = powerVerbHistoryRef.current;
    if (!hits.length) return { ok: false, idx: 0, total: 0, word: "" };

    // Advance index — ref tracks the last-shown index (starts at -1 meaning "nothing shown yet")
    const lastShown = powerVerbIndexRef.current;
    let idx;
    if (lastShown < 0) {
      // First time: show verb 0 regardless of delta
      idx = 0;
    } else if (delta === -1) {
      // Prev: go backward in document
      idx = (lastShown - 1 + hits.length) % hits.length;
    } else {
      // Next: go forward in document
      idx = (lastShown + 1) % hits.length;
    }
    powerVerbIndexRef.current = idx;

    const hit = hits[idx];
    if (!hit?.span) return { ok: false, idx, total: hits.length, word: "" };

    // Remove "current" from all, add to this one
    container.querySelectorAll(".vysti-power-verb-current").forEach((el) =>
      el.classList.remove("vysti-power-verb-current")
    );
    clearHighlights(container);
    hit.span.classList.add("vysti-power-verb-current");
    enableFocusMode(container);

    // Select the weak verb text so clicking a power verb in the dictionary replaces it
    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(hit.span);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (_) {}

    // Scroll to the verb span
    const topbar = document.querySelector(".topbar");
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    const zoom = parseFloat(container.style.zoom) || 1;

    const scrollContainerToVerb = () => {
      const cRect = container.getBoundingClientRect();
      const sRect = hit.span.getBoundingClientRect();
      const visibleTop = Math.max(cRect.top, topbarH);
      const d = ((sRect.top - visibleTop) - 80) / zoom;
      if (Math.abs(d) > 2) {
        smoothScrollTo(container, container.scrollTop + d, 350);
      }
    };

    const card = document.getElementById("markedPreviewCard");
    const needsPageScroll = card &&
      Math.abs(card.getBoundingClientRect().top - (topbarH + 8)) > 50;

    if (needsPageScroll) {
      smoothPageScroll(
        window.scrollY + card.getBoundingClientRect().top - topbarH - 8, 400
      ).then(scrollContainerToVerb).catch(() => {});
    } else {
      scrollContainerToVerb();
    }

    return { ok: true, idx, total: hits.length, word: hit.word };
  };

  // Unified: clear ALL active highlight modes (repetition, power verbs, tech/variety blocks)
  const clearAllHighlightModes = (container) => {
    if (!container) return;
    clearHighlights(container);
    clearDeviceHighlights(container);
    cleanupPowerVerbHighlights(container);
    if (nounRepetitionActiveRef.current) {
      clearRepetitionHighlights(container);
      nounRepetitionHistoryRef.current = [];
      nounRepetitionActiveRef.current = false;
    }
    container.classList.remove("vysti-highlight-focus-mode");
    // Signal PreviewMetrics to reset pill UI states (e.g. repetitionActive)
    setHighlightResetKey((k) => k + 1);
  };

  const handleRefocus = () => {
    const container = previewRef.current;
    if (!container) return;
    // Only lift the gray dimming — keep labels, maroon borders, etc.
    container.classList.remove("vysti-highlight-focus-mode");
    setPreviewHint(null);
    setHighlightResetKey((k) => k + 1);
  };

  const handleToggleRepetition = () => {
    const container = previewRef.current;
    if (!container) return { active: false, total: 0 };

    // If currently active, turn off
    if (nounRepetitionActiveRef.current) {
      clearRepetitionHighlights(container);
      container.classList.remove("vysti-highlight-focus-mode");
      nounRepetitionHistoryRef.current = [];
      nounRepetitionActiveRef.current = false;
      return { active: false, total: 0 };
    }

    const repeatedNouns = studentMetrics?.power?.details?.repeatedNouns || [];
    if (!repeatedNouns.length) return { active: false, total: 0 };

    // Turn on: clear all other highlight modes first
    clearAllHighlightModes(container);

    const result = applyRepetitionHighlights(container, repeatedNouns, { thesisDevicesLexicon });
    nounRepetitionHistoryRef.current = result.hits;
    nounRepetitionActiveRef.current = true;
    enableFocusMode(container);

    // Scroll to preview card
    const card = document.getElementById("markedPreviewCard");
    const topbar = document.querySelector(".topbar");
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    if (card) {
      const needsPageScroll = Math.abs(card.getBoundingClientRect().top - (topbarH + 8)) > 50;
      if (needsPageScroll) {
        smoothPageScroll(window.scrollY + card.getBoundingClientRect().top - topbarH - 8, 400);
      }
    }

    return { active: true, total: result.total };
  };

  const scrollToMarkedPreview = ({ clear = true } = {}) => {
    const container = previewRef.current;
    if (clear && container) {
      clearHighlights(container);
      clearRepetitionHighlights(container);
      nounRepetitionHistoryRef.current = [];
      nounRepetitionActiveRef.current = false;
    }
    const previewCard = document.getElementById("markedPreviewCard");
    if (!previewCard) return false;
    const topbar = document.querySelector(".topbar");
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;

    const targetY = window.scrollY + previewCard.getBoundingClientRect().top - topbarH - 8;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 800; // 800ms (0.8s)
    let startTime = null;

    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const scroll = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      window.scrollTo(0, startY + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(scroll);
      }
    };

    requestAnimationFrame(scroll);
    return true;
  };


  const handleHighlightExamples = (examples) => {
    if (!practiceHighlightEnabled) return;
    const container = previewRef.current;
    if (!container) return;
    const count = highlightAllMatches(container, examples);
    setStatus({
      kind: "info",
      message: `Highlighted ${count} matching paragraphs in the preview.`
    });
  };

  const handleClearHighlights = () => {
    const container = previewRef.current;
    if (!container) return;
    clearHighlights(container);
    setStatus({ kind: "info", message: "Highlights cleared." });
  };

  // ── Autosave: localStorage (2.5 s) + Supabase (10 s) ──
  useEffect(() => {
    if (!autosaveEnabled || !userId || !selectedFile || !previewRef.current) return;
    const container = previewRef.current;

    // Lazy-init the Supabase throttled saver
    if (saveProgressEnabled && !supaThrottledSaverRef.current) {
      supaThrottledSaverRef.current = createSupabaseThrottledSaver(60000);
    }

    const saveNow = () => {
      const text = extractPreviewTextFromContainer(container);
      if (!shouldAutosave(text)) return;
      if (text === lastExtractedRef.current) return;
      lastExtractedRef.current = text;
      const payload = saveDraft({ userId, fileName: selectedFile.name, mode, text });
      if (payload) {
        setDraftMeta(payload);
      }
      // Also queue a Supabase save (throttled at 10 s)
      if (saveProgressEnabled && supa) {
        supaThrottledSaverRef.current?.(() => {
          saveRevisionDraftToSupabase({
            supa, userId, fileName: selectedFile.name, mode, text,
            markEventId: mciMarkEventId
          }).then((result) => {
            if (result?.savedAt) setDraftMeta((prev) => ({ ...prev, savedAt: result.savedAt }));
          }).catch(() => {});
        });
      }
    };
    const throttledSave = throttle(saveNow, 2500);
    container.addEventListener("input", throttledSave);
    container.addEventListener("paste", throttledSave);
    return () => {
      container.removeEventListener("input", throttledSave);
      container.removeEventListener("paste", throttledSave);
    };
  }, [
    autosaveEnabled,
    saveProgressEnabled,
    userId,
    selectedFile,
    mode,
    previewRef,
    supa,
    mciMarkEventId
  ]);

  // ── Load draft on file select: check localStorage + Supabase ──
  useEffect(() => {
    if (!autosaveEnabled || !userId || !selectedFile) return;
    const localDraft = loadDraft({ userId, fileName: selectedFile.name, mode });

    if (!saveProgressEnabled || !supa) {
      // localStorage only
      if (localDraft?.text) {
        setDraftMeta(localDraft);
        setDraftDismissed(false);
      } else {
        setDraftMeta(null);
      }
      return;
    }

    // Check both localStorage and Supabase, use the newer one
    let cancelled = false;
    (async () => {
      const supaDraft = await loadRevisionDraftFromSupabase({
        supa, userId, fileName: selectedFile.name, mode
      });
      if (cancelled) return;

      const localTime = localDraft?.savedAt ? new Date(localDraft.savedAt).getTime() : 0;
      const supaTime = supaDraft?.savedAt ? new Date(supaDraft.savedAt).getTime() : 0;

      const best = supaTime >= localTime && supaDraft?.text
        ? { text: supaDraft.text, savedAt: supaDraft.savedAt }
        : localDraft?.text
          ? localDraft
          : null;

      if (best?.text) {
        setDraftMeta(best);
        setDraftDismissed(false);
      } else {
        setDraftMeta(null);
      }
    })();

    return () => { cancelled = true; };
  }, [autosaveEnabled, saveProgressEnabled, userId, selectedFile, mode, supa]);

  // ── Check for saved revisions (for "Keep working" button/dropdown) ──
  // Runs on load AND whenever markedBlob changes so the list stays fresh
  // even while the student is revising (allows switching between drafts).
  useEffect(() => {
    if (!saveProgressEnabled || !supa || !userId) {
      setPendingSavedDrafts([]);
      return;
    }
    let cancelled = false;
    findAllRevisionDrafts({ supa, userId }).then((drafts) => {
      if (!cancelled) setPendingSavedDrafts(drafts);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [saveProgressEnabled, supa, userId, markedBlob]);

  // ── Compute cross-app "Keep working" items (Mark + Write) ──
  useEffect(() => {
    if (!userId) { setKeepWorkingItems([]); return; }
    const items = [];
    const markInfo = peekTeacherSession(userId);
    if (markInfo) {
      items.push({
        mode: "mark",
        label: "Mark",
        sublabel: `${markInfo.fileCount} document${markInfo.fileCount === 1 ? "" : "s"}`,
        time: markInfo.savedAt,
        href: "/teacher_react.html",
      });
    }
    const writeInfo = peekWriteDraft(userId);
    if (writeInfo) {
      items.push({
        mode: "write",
        label: "Write",
        sublabel: writeInfo.textTitle || "Draft",
        time: writeInfo.savedAt,
        href: "/write_react.html",
      });
    }
    setKeepWorkingItems(items);
  }, [userId]);

  // ── Auto-load a specific draft when arriving via ?resumeDraft=... ──
  // (e.g. from the student_progress "Resume" button)
  const resumeDraftHandled = useRef(false);
  useEffect(() => {
    if (resumeDraftHandled.current) return;
    if (!supa || !userId) return;
    const params = new URLSearchParams(window.location.search);
    const draftName = params.get("resumeDraft");
    if (!draftName) return;
    const draftMode = params.get("resumeMode") || "textual_analysis";

    resumeDraftHandled.current = true;
    // Clean the URL so a browser refresh doesn't re-trigger
    const clean = new URL(window.location);
    clean.searchParams.delete("resumeDraft");
    clean.searchParams.delete("resumeMode");
    window.history.replaceState({}, "", clean);

    loadRevisionDraftFromSupabase({ supa, userId, fileName: draftName, mode: draftMode })
      .then((result) => {
        if (result?.text) {
          handleKeepWorking({ fileName: draftName, mode: draftMode, text: result.text, savedAt: result.savedAt });
        }
      }).catch(() => {});
  }, [supa, userId]);

  async function refreshAttemptHistory() {
    if (!showAttemptHistory || !supa || !userId || !selectedFile) return;
    setAttemptsLoading(true);
    setAttemptsError("");
    try {
      const attemptRows = await fetchAttemptHistory({
        supa,
        userId,
        fileName: selectedFile.name,
        limit: 10
      });
      setAttempts(attemptRows);
    } catch (err) {
      setAttemptsError(err?.message || "Failed to load history.");
    } finally {
      setAttemptsLoading(false);
    }
  }

  useEffect(() => {
    if (!showAttemptHistory || !userId || !selectedFile) {
      setAttempts([]);
      setAttemptsError("");
      return;
    }
    refreshAttemptHistory();
  }, [showAttemptHistory, userId, selectedFile]);

  const handleOpenDownloadModal = () => {
    if (!markedBlob || !hasRevisedSinceMark) return;
    setShowMlaModal(true);
  };

  const handleToggleMetricsDetails = () => {
    setMetricsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(METRIC_DETAILS_COLLAPSE_KEY, next ? "1" : "0");
      } catch (err) {}
      return next;
    });
  };

  const handleOpenMetricInfo = (event) => {
    const key = event?.currentTarget?.dataset?.metric;
    if (!key) return;
    closeAllGuidanceOverlays();
    setMetricInfoState({ open: true, anchorEl: event.currentTarget, metricKey: key });
  };

  const handleOpenPowerVerbs = (event, { word } = {}) => {
    // Close other overlays but keep the pill hint visible (it shows nav for weak verbs)
    setMetricInfoState({ open: false, anchorEl: null, metricKey: null });
    // If no explicit word, check for a double-click selection in the preview
    let target = word || "";
    if (!target) {
      const sel = window.getSelection?.();
      const selText = (sel?.toString() || "").trim();
      if (selText && !/\s/.test(selText) && previewRef.current?.contains(sel?.anchorNode)) {
        target = selText;
      }
    }
    setPowerVerbsState({
      open: true,
      anchorEl: event?.currentTarget || null,
      textareaRef: null,
      targetWord: target
    });
  };

  // Update dictionary target word without reopening (used by hint nav prev/next)
  const handleUpdatePowerVerbTarget = (word) => {
    setPowerVerbsState((prev) => ({ ...prev, targetWord: word || "" }));
  };

  const handleOpenPowerVerbsForTextarea = ({ anchorEl, textareaRef, selectedWord }) => {
    closeAllGuidanceOverlays();
    setPowerVerbsState({
      open: true,
      anchorEl: anchorEl || null,
      textareaRef: textareaRef || null,
      targetWord: selectedWord || ""
    });
  };


  const handleDownloadRevised = async ({ includeMla, fields }) => {
    if (!markedBlob) return;
    if (requestActive) return;
    if (!supa) {
      setError("Supabase is not available.");
      return;
    }
    const text = extractPreviewTextFromContainer(previewRef.current);
    if (!text) {
      setError("Could not extract text from preview.");
      return;
    }

    setIsDownloading(true);
    setStatus({ message: "Preparing download...", kind: "info" });
    const abortable = hardeningEnabled || cancelRequestsEnabled ? startRequest("export") : null;

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) {
        handleSessionExpired();
        return;
      }

      if (!apiBase) {
        setError("Missing API configuration. Please refresh.");
        return;
      }

      const outputName = buildRevisedFilename();
      const finalText = includeMla
        ? `${buildMlaHeader(fields)}${stripStudentHeaderBeforeTitleForDownload(text)}`
        : text;
      const response = await fetchWithTimeout(
        `${apiBase}/export_docx`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ file_name: outputName, text: finalText }),
          signal: abortable?.signal
        },
        { timeoutMs: hardeningEnabled ? 60000 : undefined }
      );

      if (response.status === 402) {
        handlePaywall("download");
        return;
      }

      if (isAuthExpired(response)) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const blob = await response.blob();
      downloadBlob(blob, outputName);
      setSuccess("Revised essay downloaded.");
    } catch (err) {
      console.error("Download revised failed", err);
      if (err?.code === "TIMEOUT") {
        setError("This took too long. Try again (or check connection).", err);
      } else if (err?.code === "ABORTED") {
        setStatus({ message: "Canceled.", kind: "info" });
      } else {
        const message = err?.message || "Failed to download revised essay.";
        setError(message, err);
      }
    } finally {
      abortable?.clear?.();
      if (abortable) endRequest();
      setIsDownloading(false);
      setShowMlaModal(false);
    }
  };

  const handleSignOut = async () => {
    if (!supa) {
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/student_react.html")}`
      );
      return;
    }

    try {
      await supa.auth.signOut();
    } finally {
      try { localStorage.removeItem("vysti_role"); localStorage.removeItem("vysti_products"); } catch {}
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/student_react.html")}`
      );
    }
  };


  const handleRepeatTutorial = () => {
    TOUR_KEYS.forEach((key) => { try { localStorage.removeItem(key); } catch {} });
    tourRef.current?.restartTour({ force: true });
  };


  if (isChecking) {
    return null;
  }

  if (authError) {
    return (
      <main className="page student-page student-react-shell">
        <div className="card form-card">
          <p>{authError}</p>
        </div>
      </main>
    );
  }

  const authReady = !isChecking && !authError;
  const hasResults = Boolean(status.message) || Boolean(markedBlob);
  const requestActive = hardeningEnabled || cancelRequestsEnabled ? Boolean(activeRequest) : false;
  const statusClass =
    status.kind === "success" ? " success" : status.kind === "error" ? " error" : "";

  return (
    <div className="student-react-shell">
      {statusToastsEnabled ? (
        <StatusToasts toasts={toastQueue} onDismiss={dismissToast} />
      ) : null}
      <Topbar
        onRepeatTutorial={handleRepeatTutorial}
        onSignOut={handleSignOut}
        pendingSavedDrafts={pendingSavedDrafts.filter(
          (d) => !(selectedFile && d.fileName === selectedFile.name && d.mode === mode)
        )}
        onKeepWorking={handleKeepWorking}
        keepWorkingItems={keepWorkingItems}
        entitlement={entitlement}
        onSubscribe={() => setShowPaywall(true)}
      />

      <StudentTour
        ref={tourRef}
        authReady={authReady}
        selectedFile={selectedFile}
        markedBlob={markedBlob}
        onTourNeedsRevisionLabel={handleTourNeedsRevisionLabel}
      />

      <main className="page student-page">
        <DraftRestoreBanner
          visible={autosaveEnabled && !draftDismissed && Boolean(draftMeta?.text)}
          savedAt={draftMeta?.savedAt}
          onRestore={handleRestoreDraft}
          onDismiss={handleDismissDraft}
          onDelete={handleDeleteDraft}
        />
        <form className="marker-grid" onSubmit={handleSubmit}>
          <section className="card form-card">
            <ModeSelect mode={mode} onChange={setMode} />

            <ModeCard
              label={
                MODES.find((item) => item.value === mode)?.label || "Analytic essay"
              }
              description={modeExplainer.description}
              details={modeExplainer.details}
            />

            <AssignmentTracker
              assignmentName={assignmentName}
              onChange={setAssignmentName}
            />
          </section>

          <DropZone
            selectedFile={selectedFile}
            isDragOver={isDragOver}
            validationError={fileValidationError}
            onBrowseClick={handleBrowseClick}
            onFileChange={handleFileChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClearFile={handleClearFile}
            fileInputRef={fileInputRef}
            isProcessing={isProcessing}
            requestActive={requestActive}
            hasResults={hasResults}
            metrics={studentMetrics}
            mode={mode}
            totalIssues={totalIssues}
            wordCount={wordCount}
            labelCounts={mciLabelCounts}
            onOpenRevisionFromLabel={handleOpenRevisionFromLabel}
            processingLabel={isRestoringDraft ? "Loading..." : undefined}
          />

          <section
            className={`card rules-card${markedBlob ? " results-enter" : ""}`}
            id="resultsCard"
            style={{ display: markedBlob ? "block" : "none" }}
          >
            {practiceEnabled ? (
              <>
                {mciError ? (
                  <div className="helper-text error-text">
                    <p>{mciError}</p>
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={handleRefreshMci}
                    >
                      Refresh issue data
                    </button>
                  </div>
                ) : null}
                <MostCommonIssuesChart
                  labelCounts={mciLabelCounts}
                  markEventId={mciMarkEventId}
                  expandedMetric={mciExpandedMetric}
                  onExpandedMetricChange={(metric) => {
                    setMciExpandedMetric(metric);
                    tourRef.current?.notifyAction("mciExpandedMetric");
                  }}
                  cohesionDetails={studentMetrics?.cohesion?.details}
                />
              </>
            ) : null}
          </section>
        </form>

        {practiceEnabled && markedBlob ? (
          <MostCommonIssuesDetail
            expandedMetric={mciExpandedMetric}
            onClose={() => setMciExpandedMetric(null)}
            labelCounts={mciLabelCounts}
            issues={mciIssuesRich}
            onSelectLabel={(label) => {
              setMciSelectedLabel(label);
              scrollToRevisionPractice();
              tourRef.current?.notifyAction("mciSelectedLabel");
            }}
            markEventId={mciMarkEventId}
          />
        ) : null}

        <ErrorBoundary
          inline
          title="Something broke while rendering the preview."
          message="Try reloading or use the classic view."
        >
          <PreviewPanel
            markedBlob={markedBlob}
            zoom={zoom}
            onZoomChange={setZoom}
            previewRef={previewRef}
            labelCounts={mciLabelCounts}
            issues={mciIssues}
            onNavigateToPreviewSentence={handleNavigateToExample}
            onJumpPowerVerb={handleJumpPowerVerb}
            onToggleRepetition={handleToggleRepetition}
            highlightResetKey={highlightResetKey}
            onScrollToPreview={scrollToMarkedPreview}
            onHighlightVarietyParagraph={handleHighlightVarietyParagraph}
            onHighlightTechniquesParagraph={handleHighlightTechniquesParagraph}
            onScanAllTechniques={handleScanAllTechniques}
            onOpenRevisionFromLabel={handleOpenRevisionFromLabel}
            onRecheck={handleRecheck}
            isRechecking={isRechecking}
            isProcessing={isProcessing || requestActive}
            onEdit={handlePreviewEdited}
            onDownloadMarked={handleDownload}
            onDownloadRevised={handleOpenDownloadModal}
            isDownloading={isDownloading}
            hasRevisedSinceMark={hasRevisedSinceMark}
            wordCount={wordCount}
            totalIssues={totalIssues}
            markMetadata={markMetadata}
            metrics={studentMetrics}
            metricsCollapsed={metricsCollapsed}
            onToggleMetricsDetails={handleToggleMetricsDetails}
            onOpenMetricInfo={handleOpenMetricInfo}
            onOpenPowerVerbs={handleOpenPowerVerbs}
            onUpdatePowerVerbTarget={handleUpdatePowerVerbTarget}
            hint={previewHint}
            onDismissHint={() => {
              setPreviewHint(null);
              cleanupPowerVerbHighlights(previewRef.current);
              powerVerbHistoryRef.current = [];
              powerVerbIndexRef.current = -1;
            }}
            onShowPillHint={setPreviewHint}
            mode={mode}
            previewError={previewError}
            previewErrorStack={previewErrorStack}
            showDebug={debugHardening}
            onClearPreview={handleClearPreview}
            onPreviewError={handlePreviewError}
            selectedFileName={selectedFile?.name || ""}
            works={works}
            activeWorkIndex={activeWorkIndex}
            onWorksChange={setWorks}
            onActiveWorkIndexChange={setActiveWorkIndex}
            onRefocus={handleRefocus}
            onUndo={handleUndo}
            dismissedIssues={dismissedIssues}
            onUndismiss={handleUndismiss}
            onSaveProgress={handleSaveProgress}
            saveProgressState={saveProgressState}
            lastSavedAt={draftMeta?.savedAt}
            saveProgressEnabled={saveProgressEnabled}
            entitlement={entitlement}
            onPaywall={handlePaywall}
            onRendered={() => {
              const c = previewRef.current;
              if (!c) return;
              // Restore centering
              const texts = pendingCenteredTextsRef.current;
              if (texts) {
                pendingCenteredTextsRef.current = null;
                c.querySelectorAll("p, li").forEach((p) => {
                  const t = (p.textContent || "").trim();
                  if (t && texts.has(t)) p.style.textAlign = "center";
                });
              }
              // Restore italic formatting
              const italics = pendingItalicTextsRef.current;
              if (italics) {
                pendingItalicTextsRef.current = null;
                c.querySelectorAll("p, li").forEach((p) => {
                  const paraText = (p.textContent || "").trim();
                  const runs = italics.get(paraText);
                  if (!runs) return;
                  // Check if ALL text in the paragraph was italic
                  if (runs.size === 1 && runs.has(paraText)) {
                    p.style.fontStyle = "italic";
                    return;
                  }
                  // Partial italic — wrap matching text nodes
                  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
                  const nodesToWrap = [];
                  let node;
                  while ((node = walker.nextNode())) {
                    const t = node.textContent.trim();
                    if (!t || !runs.has(t)) continue;
                    const parent = node.parentElement;
                    if (parent) {
                      const fs = window.getComputedStyle(parent).fontStyle;
                      if (fs !== "italic" && fs !== "oblique") nodesToWrap.push(node);
                    }
                  }
                  for (const n of nodesToWrap) {
                    const i = document.createElement("i");
                    n.parentNode.insertBefore(i, n);
                    i.appendChild(n);
                  }
                });
              }
            }}
          />
        </ErrorBoundary>

        {practiceEnabled && markedBlob ? (
          <ErrorBoundary
            inline
            title="Something broke while rendering revision practice."
            message="Try reloading or continue without this panel."
          >
            <RevisionPracticePanel
              enabled={practiceEnabled}
              requestActive={requestActive}
              practiceNavEnabled={practiceNavEnabled}
              practiceHighlightEnabled={practiceHighlightEnabled}
              externalAttempt={selectedAttempt}
              onClearExternalAttempt={() => setSelectedAttempt(null)}
              supa={supa}
              selectedFile={selectedFile}
              markedBlob={markedBlob}
              previewRef={previewRef}
              techniques={techniques}
              dismissedIssues={dismissedIssues}
              onDismissedIssuesChange={setDismissedIssues}
              selectedLabelOverride={mciSelectedLabel}
              onSelectedLabelChange={(label) => setMciSelectedLabel(label)}

              onNavigateToExample={handleNavigateToExample}
              onHighlightExamples={handleHighlightExamples}
              onClearHighlights={handleClearHighlights}
              mode={mode}
              onPreviewEdited={handlePreviewEdited}
              onOpenPowerVerbs={handleOpenPowerVerbsForTextarea}
              onCheckRewriteResult={(payload) => tourRef.current?.notifyAction("checkRewriteResult", payload)}
              onApplyToPreview={(payload) => tourRef.current?.notifyAction("applyToPreview", payload)}
            />
          </ErrorBoundary>
        ) : null}

        {showAttemptHistory ? (
          <AttemptHistoryPanel
            enabled={showAttemptHistory}
            attempts={attempts}
            selectedAttemptId={selectedAttempt?.id || null}
            onSelectAttempt={(attempt) => setSelectedAttempt(attempt)}
            onRefresh={refreshAttemptHistory}
            isLoading={attemptsLoading}
            error={attemptsError}
          />
        ) : null}

        <Footer />
      </main>

      <MetricInfoPopover
        isOpen={metricInfoState.open}
        anchorEl={metricInfoState.anchorEl}
        metricKey={metricInfoState.metricKey}
        metricData={studentMetrics?.[metricInfoState.metricKey]}
        labelCounts={markMetadata?.vysti_label_counts}
        onClose={() => setMetricInfoState({ open: false, anchorEl: null, metricKey: null })}
      />
      <PowerVerbsPopover
        isOpen={powerVerbsState.open}
        anchorEl={powerVerbsState.anchorEl}
        previewRef={previewRef}
        textareaRef={powerVerbsState.textareaRef}
        targetWord={powerVerbsState.targetWord}
        onClose={() => setPowerVerbsState({ open: false, anchorEl: null, textareaRef: null, targetWord: "" })}
        onVerbApplied={() => {
          handlePreviewEdited();
          // Live-update Power meter pills: one fewer weak verb, one more power verb
          setStudentMetrics((prev) => {
            if (!prev?.power?.details) return prev;
            const d = prev.power.details;
            const newWeak = Math.max(0, (d.weakCount || 0) - 1);
            const newPower = (d.powerCount || 0) + 1;
            return {
              ...prev,
              power: {
                ...prev.power,
                details: { ...d, weakCount: newWeak, powerCount: newPower },
              },
            };
          });
          // Auto-advance to next weak verb after replacing one
          // Clear stale hits so handleJumpPowerVerb rescans the (now-modified) DOM
          powerVerbHistoryRef.current = [];
          powerVerbIndexRef.current = -1;
          // Small delay lets the DOM settle after replacement
          window.setTimeout(() => {
            const result = handleJumpPowerVerb(1, { mode: "weak" });
            if (result.ok) {
              // Update dictionary conjugation to match the new weak verb
              setPowerVerbsState((prev) => ({ ...prev, targetWord: result.word }));
              // Update pill hint subheader
              setPreviewHint((prev) => prev ? {
                ...prev,
                subheader: `${result.idx + 1} / ${result.total}${result.word ? ` "${result.word}"` : ""}`
              } : prev);
            } else {
              // No more weak verbs — show success and close dictionary
              const POWER_DONE = [
                "All weak verbs replaced — nice work!",
                "No more weak verbs to fix. Your writing is strong!",
                "That's the last one — all weak verbs are gone!",
              ];
              setPreviewHint({
                title: "Power verbs",
                body: POWER_DONE[Math.floor(Math.random() * POWER_DONE.length)],
                subheader: "",
                nav: null
              });
              setPowerVerbsState({ open: false, anchorEl: null, textareaRef: null, targetWord: "" });
            }
          }, 80);
        }}
      />
      <MlaModal
        isOpen={showMlaModal}
        initialAssignmentName={assignmentName}
        isBusy={isDownloading}
        onCancel={() => setShowMlaModal(false)}
        onDownloadAsIs={() => handleDownloadRevised({ includeMla: false })}
        onDownloadMla={(fields) =>
          handleDownloadRevised({ includeMla: true, fields })
        }
      />
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        returnPath="/student_react.html"
      />
    </div>
  );
}

export default App;
