import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Footer from "./components/Footer";
import BetaBanner from "./components/BetaBanner";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
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
import StatusToasts from "./components/StatusToasts";
import ErrorBoundary from "./components/ErrorBoundary";
import DraftRestoreBanner from "./components/DraftRestoreBanner";
import AttemptHistoryPanel from "./components/AttemptHistoryPanel";
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
  stripStudentHeaderBeforeTitleForDownload
} from "./lib/previewText";
import {
  clearHighlights,
  findBestMatchBlock,
  highlightAllMatches,
  scrollAndFlash
} from "./lib/previewNavigator";
import {
  extractErrorMessage,
  fetchWithTimeout,
  isAuthExpired,
  makeAbortableTimeout
} from "./lib/request";
import { markEssay, markText } from "./services/markEssay";
import { fetchAttemptHistory } from "./services/attemptHistory";
import {
  deleteDraft,
  loadDraft,
  saveDraft,
  shouldAutosave,
  throttle
} from "./services/draftStore";

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

function App() {
  const { supa, isChecking, authError, redirectToSignin } = useAuthSession();
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "info" });
  const [markedBlob, setMarkedBlob] = useState(null);
  const [techniques, setTechniques] = useState(EMPTY_TECHNIQUES);
  const [techniquesParsed, setTechniquesParsed] = useState(null);
  const [userId, setUserId] = useState("");
  const [showTechniques, setShowTechniques] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastMarkStatus, setLastMarkStatus] = useState(null);
  const [lastMarkError, setLastMarkError] = useState("");
  const [authSnapshot, setAuthSnapshot] = useState({
    hasSession: false,
    email: ""
  });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hasRevisedSinceMark, setHasRevisedSinceMark] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showMlaModal, setShowMlaModal] = useState(false);
  const [markedFilenameBase, setMarkedFilenameBase] = useState("");
  const [showRevisionPractice, setShowRevisionPractice] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewErrorStack, setPreviewErrorStack] = useState("");
  const [uiMode, setUiModeState] = useState("");
  const [draftMeta, setDraftMeta] = useState(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState("");
  const [activeRequest, setActiveRequest] = useState(null);
  const [toastQueue, setToastQueue] = useState([]);
  const [fileValidationError, setFileValidationError] = useState("");
  const [dragMessage, setDragMessage] = useState("");
  const lastExtractedRef = useRef("");

  const config = getConfig();
  const configError = getConfigError();
  const apiBase = getApiBaseUrl();
  const markUrl = apiBase ? `${apiBase}/mark` : "";
  const markTextUrl = apiBase ? `${apiBase}/mark_text` : "";
  const exportUrl = apiBase ? `${apiBase}/export_docx` : "";
  const debugHardening = Boolean(config.featureFlags?.debugHardening);
  const practiceEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.revisionPracticeReact) ||
      params.get("practice") === "1" ||
      localStorage.getItem("vysti_practice") === "1"
    );
  }, [config.featureFlags?.revisionPracticeReact]);
  const rolloutConfig = config.rollout?.studentReact || {};
  const allowEmails = (rolloutConfig.allowEmails || []).map((item) =>
    String(item || "").toLowerCase()
  );
  const allowUserIds = rolloutConfig.allowUserIds || [];
  const isAllowlisted =
    (authSnapshot.email && allowEmails.includes(authSnapshot.email.toLowerCase())) ||
    (userId && allowUserIds.includes(userId));
  const canShowReactSwitch = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return isAllowlisted || params.get("react") === "1";
  }, [isAllowlisted]);
  const practiceNavEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.practiceNavigationReact) ||
      params.get("practiceNav") === "1" ||
      localStorage.getItem("vysti_practice_nav") === "1"
    );
  }, [config.featureFlags?.practiceNavigationReact]);
  const practiceHighlightEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.practiceHighlightReact) ||
      params.get("practiceHL") === "1" ||
      localStorage.getItem("vysti_practice_hl") === "1"
    );
  }, [config.featureFlags?.practiceHighlightReact]);
  const hardeningEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.hardeningReact) ||
      params.get("hardening") === "1" ||
      localStorage.getItem("vysti_hardening") === "1"
    );
  }, [config.featureFlags?.hardeningReact]);
  const cancelRequestsEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.cancelRequestsReact) ||
      params.get("cancel") === "1" ||
      localStorage.getItem("vysti_cancel") === "1"
    );
  }, [config.featureFlags?.cancelRequestsReact]);
  const strictFileValidationEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.strictFileValidationReact) ||
      params.get("strict") === "1" ||
      localStorage.getItem("vysti_strict_files") === "1"
    );
  }, [config.featureFlags?.strictFileValidationReact]);
  const statusToastsEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.statusToastsReact) ||
      params.get("statusToasts") === "1" ||
      localStorage.getItem("vysti_status_toasts") === "1"
    );
  }, [config.featureFlags?.statusToastsReact]);
  const autosaveEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.autosaveDraftReact) ||
      params.get("autosave") === "1" ||
      localStorage.getItem("vysti_autosave") === "1"
    );
  }, [config.featureFlags?.autosaveDraftReact]);
  const historyEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      Boolean(config.featureFlags?.revisionHistoryReact) ||
      params.get("history") === "1" ||
      localStorage.getItem("vysti_history") === "1"
    );
  }, [config.featureFlags?.revisionHistoryReact]);

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const tourRef = useRef(null);

  const modeExplainer = useMemo(
    () => MODE_RULE_DEFAULTS[mode] || MODE_RULE_DEFAULTS.textual_analysis,
    [mode]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("react") === "1") {
      try {
        localStorage.setItem("uiMode", "react");
        setUiModeState("react");
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    try {
      setUiModeState(localStorage.getItem("uiMode") || "");
    } catch (err) {
      setUiModeState("");
    }
  }, []);

  useEffect(() => {
    if (practiceEnabled) {
      setShowRevisionPractice(true);
    }
  }, [practiceEnabled]);

  useEffect(() => {
    if (!markedBlob) {
      setPreviewError("");
      setPreviewErrorStack("");
    }
  }, [markedBlob]);

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
        localStorage.removeItem("vysti_role");
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
    if (statusToastsEnabled) {
      pushToast({ kind: "success", title: "Success", message });
    }
  };

  const clearStatus = () => {
    setStatus({ message: "", kind: "info" });
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
    return rawName.replace(/\.docx$/i, "") || "essay";
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
    return lines.length ? `${lines.join("\n")}\n\n` : "";
  };

  const isDocx = (file) => {
    if (!file) return false;
    const name = file.name?.toLowerCase() || "";
    return (
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };

  const validateFile = (file) => {
    if (!file) return { ok: false, message: "No file selected." };
    if (!isDocx(file)) {
      return { ok: false, message: "Only .docx files are allowed." };
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
    } else if (!file || !isDocx(file)) {
      if (file) {
        setError("Please upload a .docx file.");
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
    setDragMessage("");
    updateSelectedFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    setDragMessage("");
    const file = event.dataTransfer?.files?.[0];
    updateSelectedFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
    if (!strictFileValidationEnabled) {
      setDragMessage("Drop to upload");
      return;
    }
    const item = event.dataTransfer?.items?.[0];
    const file = item?.getAsFile?.() || event.dataTransfer?.files?.[0];
    if (!file) {
      setDragMessage("Drop to upload");
      return;
    }
    const validation = validateFile(file);
    setDragMessage(validation.ok ? "Drop to upload" : validation.message);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setDragMessage("");
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
    clearStatus();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMark = async () => {
    if (!selectedFile) {
      setError("Please select a .docx file first.");
      return;
    }
    if (requestActive) return;
    setIsProcessing(true);
    setStatus({
      message: hardeningEnabled ? "Uploading..." : "Processing...",
      kind: "info"
    });
    if (statusToastsEnabled) {
      pushToast({ kind: "info", title: "Marking", message: "Uploading essay..." });
    }
    setLastMarkStatus(null);
    setLastMarkError("");
    const abortable = hardeningEnabled || cancelRequestsEnabled ? startRequest("mark") : null;

    try {
      const { blob, techniquesHeader, status: markStatus } = await markEssay({
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
      setMarkedBlob(blob);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      const parsed = parseTechniquesHeaderShared(techniquesHeader);
      setTechniquesParsed(Array.isArray(parsed) ? parsed : null);
      setHasRevisedSinceMark(false);
      setPreviewError("");
      setPreviewErrorStack("");
      const baseName = (selectedFile?.name || "essay.docx").replace(/\.docx$/i, "") || "essay";
      setMarkedFilenameBase(baseName);
      setSelectedAttempt(null);
      if (historyEnabled) {
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

  const handleClearAll = () => {
    setSelectedFile(null);
    setMarkedBlob(null);
    setTechniques(EMPTY_TECHNIQUES);
    setTechniquesParsed(null);
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
    setMarkedFilenameBase("");
    setFileValidationError("");
    setDraftMeta(null);
    setDraftDismissed(false);
    setSelectedAttempt(null);
    setAttempts([]);
    setPreviewError("");
    setPreviewErrorStack("");
    clearStatus();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRecheck = async () => {
    if (!markedBlob) return;
    if (requestActive) return;
    const text = extractPreviewTextFromContainer(previewRef.current);
    if (!text) {
      setError("Please add text to the preview before rechecking.");
      return;
    }

    setIsRechecking(true);
    setStatus({ message: "Rechecking...", kind: "info" });
    if (statusToastsEnabled) {
      pushToast({ kind: "info", title: "Rechecking", message: "Rechecking essay..." });
    }
    const abortable = hardeningEnabled || cancelRequestsEnabled ? startRequest("recheck") : null;

    try {
      const { blob, techniquesHeader } = await markText({
        supa,
        payload: buildMarkTextPayload(text),
        onSessionExpired: handleSessionExpired,
        signal: abortable?.signal,
        timeoutMs: hardeningEnabled ? 60000 : undefined
      });
      setMarkedBlob(blob);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      const parsed = parseTechniquesHeaderShared(techniquesHeader);
      setTechniquesParsed(Array.isArray(parsed) ? parsed : null);
      setHasRevisedSinceMark(false);
      setPreviewError("");
      setPreviewErrorStack("");
      setSelectedAttempt(null);
      if (historyEnabled) {
        refreshAttemptHistory();
      }
      setSuccess("Rechecked ✅");
    } catch (err) {
      console.error("Recheck failed", err);
      if (err?.code === "TIMEOUT") {
        setError("This took too long. Try again (or check connection).", err);
      } else if (err?.code === "ABORTED") {
        setStatus({ message: "Canceled.", kind: "info" });
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
  };

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

  const handleDeleteDraft = () => {
    if (!selectedFile || !userId) return;
    deleteDraft({ userId, fileName: selectedFile.name, mode });
    setDraftMeta(null);
    setDraftDismissed(true);
    setStatus({ kind: "info", message: "Draft deleted." });
  };

  const handleNavigateToExample = (sentence) => {
    if (!practiceNavEnabled) return;
    const container = previewRef.current;
    if (!container) {
      setStatus({ kind: "error", message: "Preview is not ready yet." });
      return;
    }
    const match = findBestMatchBlock(container, sentence);
    if (!match || !match.el) {
      setStatus({
        kind: "error",
        message: "Couldn’t find that sentence in the preview (docx HTML mismatch)."
      });
      return;
    }
    if (config.featureFlags?.debugPracticeNavigation) {
      console.log("[practiceNav] match score:", match.score, "sentence:", sentence);
    }
    scrollAndFlash(match.el);
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

  useEffect(() => {
    if (!autosaveEnabled || !userId || !selectedFile || !previewRef.current) return;
    const container = previewRef.current;
    const saveNow = () => {
      const text = extractPreviewTextFromContainer(container);
      if (!shouldAutosave(text)) return;
      if (text === lastExtractedRef.current) return;
      lastExtractedRef.current = text;
      const payload = saveDraft({ userId, fileName: selectedFile.name, mode, text });
      if (payload) {
        setDraftMeta(payload);
      }
      if (config.featureFlags?.debugAutosave) {
        console.log("[autosave] saved", {
          length: text.length,
          savedAt: payload?.savedAt || ""
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
    userId,
    selectedFile,
    mode,
    previewRef,
    config.featureFlags?.debugAutosave
  ]);

  useEffect(() => {
    if (!autosaveEnabled || !userId || !selectedFile) return;
    const draft = loadDraft({ userId, fileName: selectedFile.name, mode });
    if (draft?.text) {
      setDraftMeta(draft);
      setDraftDismissed(false);
    } else {
      setDraftMeta(null);
    }
  }, [autosaveEnabled, userId, selectedFile, mode]);

  async function refreshAttemptHistory() {
    if (!historyEnabled || !supa || !userId || !selectedFile) return;
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
      if (config.featureFlags?.debugHistory) {
        console.log("[history] attempts", attemptRows.map((row) => row.id));
      }
    } catch (err) {
      setAttemptsError(err?.message || "Failed to load history.");
    } finally {
      setAttemptsLoading(false);
    }
  }

  useEffect(() => {
    if (!historyEnabled || !userId || !selectedFile) {
      setAttempts([]);
      setAttemptsError("");
      return;
    }
    refreshAttemptHistory();
  }, [historyEnabled, userId, selectedFile]);

  const handleOpenDownloadModal = () => {
    if (!markedBlob || !hasRevisedSinceMark) return;
    setShowMlaModal(true);
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
    if (statusToastsEnabled) {
      pushToast({ kind: "info", title: "Exporting", message: "Preparing download..." });
    }
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

      if (isAuthExpired(response)) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const blob = await response.blob();
      downloadBlob(blob, outputName);
      setHasRevisedSinceMark(false);
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
      localStorage.removeItem("vysti_role");
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/student_react.html")}`
      );
    }
  };

  const setUiMode = (value) => {
    try {
      localStorage.setItem("uiMode", value);
      setUiModeState(value);
    } catch (err) {}
  };

  const clearUiMode = () => {
    try {
      localStorage.removeItem("uiMode");
      setUiModeState("");
    } catch (err) {}
  };

  const handleBackToClassic = () => {
    setUiMode("classic");
    window.location.replace("/student.html?classic=1");
  };

  const handleSwitchToReact = () => {
    setUiMode("react");
    window.location.replace("/student_react.html?react=1");
  };

  const handleRepeatTutorial = () => {
    TOUR_KEYS.forEach((key) => localStorage.removeItem(key));
    tourRef.current?.restartTour({ force: true });
  };

  const diagnosticsData = useMemo(() => {
    if (!showDiagnostics) return null;
    return {
      buildId: config.buildId,
      url: window.location.href,
      uiMode: (() => {
        try {
          return localStorage.getItem("uiMode") || "";
        } catch (err) {
          return "";
        }
      })(),
      apiBaseUrl: apiBase,
      markUrl,
      markTextUrl,
      exportUrl,
      techniquesParsedCount: Array.isArray(techniquesParsed) ? techniquesParsed.length : null,
      supabaseUrl: config.supabaseUrl,
      auth: {
        hasSession: authSnapshot.hasSession,
        email: authSnapshot.email
      },
      lastMark: {
        status: lastMarkStatus?.status ?? null,
        ok: lastMarkStatus?.ok ?? null,
        error: lastMarkError
      },
      configError: configError ? configError.message || String(configError) : ""
    };
  }, [
    apiBase,
    authSnapshot,
    config.buildId,
    config.supabaseUrl,
    configError,
    exportUrl,
    lastMarkError,
    lastMarkStatus,
    markTextUrl,
    markUrl,
    showDiagnostics,
    techniquesParsed
  ]);

  if (isChecking) {
    return (
      <main className="page student-page student-react-shell">
        <div className="card form-card">
          <p>Checking session...</p>
        </div>
      </main>
    );
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
      {config.featureFlags?.reactBeta ? <BetaBanner /> : null}
      <Topbar
        onProgress={() => window.location.assign("/student_progress.html")}
        onTeacher={() => {
          localStorage.setItem("vysti_role", "teacher");
          window.location.assign("/index.html");
        }}
        onRepeatTutorial={handleRepeatTutorial}
        onSignOut={handleSignOut}
        onBackToClassic={handleBackToClassic}
        onSwitchToReact={handleSwitchToReact}
        showReactSwitch={canShowReactSwitch}
      />

      <StudentTour
        ref={tourRef}
        authReady={authReady}
        selectedFile={selectedFile}
        markedBlob={markedBlob}
        hasResults={hasResults}
        previewRef={previewRef}
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

            <button
              className={`primary-btn${isProcessing ? " is-loading loading-cursor" : ""}`}
              id="checkBtn"
              type="submit"
              disabled={!selectedFile || isProcessing || requestActive}
            >
              {isProcessing ? "Processing" : "Mark my essay"}
            </button>
          </section>

          <DropZone
            selectedFile={selectedFile}
            isDragOver={isDragOver}
            dragMessage={dragMessage}
            validationError={fileValidationError}
            onBrowseClick={handleBrowseClick}
            onFileChange={handleFileChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClearFile={handleClearFile}
            fileInputRef={fileInputRef}
          />

          <section className="card rules-card" id="resultsCard">
            <div
              id="statusArea"
              className={`status-area${statusClass}`}
              role="status"
              aria-live="polite"
            >
              {status.message}
            </div>
            <div className="results-actions">
              {cancelRequestsEnabled && activeRequest ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={handleCancelRequest}
                >
                  Cancel {activeRequest.kind}
                </button>
              ) : null}
              {practiceEnabled ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => setShowRevisionPractice((prev) => !prev)}
                >
                  Revision practice
                </button>
              ) : null}
              <button
                className="secondary-btn"
                type="button"
                style={{ display: selectedFile ? "inline-flex" : "none" }}
                onClick={handleClearAll}
              >
                Clear / Start over
              </button>
            </div>
          </section>
        </form>

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
            onRecheck={handleRecheck}
            isRechecking={isRechecking}
            isProcessing={isProcessing || requestActive}
            onEdit={handlePreviewEdited}
            onDownloadMarked={handleDownload}
            onDownloadRevised={handleOpenDownloadModal}
            isDownloading={isDownloading}
            hasRevisedSinceMark={hasRevisedSinceMark}
            previewError={previewError}
            previewErrorStack={previewErrorStack}
            showDebug={debugHardening}
            onClearPreview={handleClearPreview}
            onPreviewError={handlePreviewError}
          />
        </ErrorBoundary>

        {practiceEnabled && showRevisionPractice ? (
          <ErrorBoundary
            inline
            title="Something broke while rendering revision practice."
            message="Try reloading or continue without this panel."
          >
            <RevisionPracticePanel
              enabled={practiceEnabled}
              practiceNavEnabled={practiceNavEnabled}
              practiceHighlightEnabled={practiceHighlightEnabled}
              externalAttempt={selectedAttempt}
              onClearExternalAttempt={() => setSelectedAttempt(null)}
              supa={supa}
              selectedFile={selectedFile}
              markedBlob={markedBlob}
              previewRef={previewRef}
              techniques={techniques}
              onOpenDiagnostics={() => setShowDiagnostics(true)}
              onNavigateToExample={handleNavigateToExample}
              onHighlightExamples={handleHighlightExamples}
              onClearHighlights={handleClearHighlights}
            />
          </ErrorBoundary>
        ) : null}

        {historyEnabled ? (
          <AttemptHistoryPanel
            enabled={historyEnabled}
            attempts={attempts}
            selectedAttemptId={selectedAttempt?.id || null}
            onSelectAttempt={(attempt) => setSelectedAttempt(attempt)}
            onRefresh={refreshAttemptHistory}
            isLoading={attemptsLoading}
            error={attemptsError}
          />
        ) : null}

        <TechniquesPanel
          isOpen={showTechniques}
          onToggle={() => setShowTechniques((prev) => !prev)}
          data={techniques}
        />

        <ErrorBoundary
          inline
          title="Something broke while rendering diagnostics."
          message="Try reloading or continue without diagnostics."
        >
          <DiagnosticsPanel
            isOpen={showDiagnostics}
            onToggle={() => setShowDiagnostics((prev) => !prev)}
            data={diagnosticsData}
            rolloutConfig={rolloutConfig}
            uiMode={uiMode}
            buildId={config.buildId}
            onSetUiMode={setUiMode}
            onClearUiMode={clearUiMode}
          />
        </ErrorBoundary>
        <Footer />
      </main>

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
    </div>
  );
}

export default App;
