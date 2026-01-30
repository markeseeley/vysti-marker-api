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
import { useAuthSession } from "./hooks/useAuthSession";
import { logEvent, logError } from "./lib/logger";
import { DEFAULT_ZOOM, MODE_RULE_DEFAULTS, MODES, getApiUrls, getConfig, getConfigError } from "./config";
import {
  buildMarkTextPayload as buildMarkTextPayloadShared,
  exportDocx,
  parseTechniquesHeader as parseTechniquesHeaderShared
} from "@shared/markingApi";
import { downloadBlob } from "@shared/download";
import { extractPreviewText } from "@shared/previewText";
import { markEssay, markText } from "./services/markEssay";

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
  const [mlaName, setMlaName] = useState("");
  const [mlaTeacher, setMlaTeacher] = useState("");
  const [mlaDate, setMlaDate] = useState("");
  const [mlaAssignment, setMlaAssignment] = useState("");

  const config = getConfig();
  const configError = getConfigError();
  const apiUrls = getApiUrls();

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const tourRef = useRef(null);

  const modeExplainer = useMemo(
    () => MODE_RULE_DEFAULTS[mode] || MODE_RULE_DEFAULTS.textual_analysis,
    [mode]
  );

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

  const setError = (message) => {
    setStatus({ message, kind: "error" });
  };

  const setSuccess = (message) => {
    setStatus({ message, kind: "success" });
  };

  const clearStatus = () => {
    setStatus({ message: "", kind: "info" });
  };

  const handleSessionExpired = () => {
    setStatus({ message: "Session expired. Please sign in again.", kind: "error" });
    logEvent("session_expired");
    window.setTimeout(() => {
      redirectToSignin();
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

  const buildMarkedFilename = () => {
    const rawName = selectedFile?.name || "essay.docx";
    const baseName = rawName.replace(/\.docx$/i, "");
    return `${baseName}_marked.docx`;
  };

  const buildRevisedFilename = () => {
    const rawName = selectedFile?.name || "essay.docx";
    const baseName = rawName.replace(/\.docx$/i, "");
    return `${baseName}_revised.docx`;
  };

  const buildMlaHeader = () => {
    const lines = [mlaName, mlaTeacher, mlaAssignment, mlaDate];
    return `${lines.join("\n")}\n\n`;
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

  const updateSelectedFile = (file) => {
    if (!file || !isDocx(file)) {
      if (file) {
        setError("Please upload a .docx file.");
        logError("Invalid file type selected", { fileName: file?.name || "" });
      }
      setSelectedFile(null);
      setMarkedBlob(null);
      setTechniques(EMPTY_TECHNIQUES);
      setLastMarkStatus(null);
      setLastMarkError("");
      setHasRevisedSinceMark(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    clearStatus();
    setSelectedFile(file);
    setMarkedBlob(null);
    setTechniques(EMPTY_TECHNIQUES);
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
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
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
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
    setIsProcessing(true);
    setStatus({ message: "Processing...", kind: "info" });
    setLastMarkStatus(null);
    setLastMarkError("");

    try {
      const { blob, techniquesHeader, status: markStatus } = await markEssay({
        supa,
        file: selectedFile,
        mode,
        assignmentName,
        onSessionExpired: handleSessionExpired
      });
      setMarkedBlob(blob);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      setHasRevisedSinceMark(false);
      setLastMarkStatus({ status: markStatus, ok: true });
      setSuccess("Marked successfully. Scroll down to Preview.");
    } catch (err) {
      console.error("Mark failed", err);
      const message = err?.message || "Failed to mark essay. Please try again.";
      setLastMarkStatus({ status: err?.status ?? null, ok: false });
      setLastMarkError(message);
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleMark();
  };

  const buildMarkTextPayload = (text) =>
    buildMarkTextPayloadShared({
      fileName: selectedFile?.name || "essay.docx",
      text,
      mode
    });

  const handleDownload = () => {
    if (!markedBlob) return;
    const url = URL.createObjectURL(markedBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildMarkedFilename();
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
    logEvent("download_started", { fileName: buildMarkedFilename() });
  };

  const handleClearAll = () => {
    setSelectedFile(null);
    setMarkedBlob(null);
    setTechniques(EMPTY_TECHNIQUES);
    setLastMarkStatus(null);
    setLastMarkError("");
    setHasRevisedSinceMark(false);
    clearStatus();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRecheck = async () => {
    if (!markedBlob) return;
    const text = extractPreviewText(previewRef.current);
    if (!text) {
      setError("Please add text to the preview before rechecking.");
      return;
    }

    setIsRechecking(true);
    setStatus({ message: "Rechecking...", kind: "info" });

    try {
      const { blob, techniquesHeader } = await markText({
        supa,
        payload: buildMarkTextPayload(text),
        onSessionExpired: handleSessionExpired
      });
      setMarkedBlob(blob);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      setHasRevisedSinceMark(false);
      setSuccess("Preview updated.");
    } catch (err) {
      console.error("Recheck failed", err);
      const message = err?.message || "Failed to recheck essay. Please try again.";
      setError(message);
    } finally {
      setIsRechecking(false);
    }
  };

  const handlePreviewEdited = () => {
    setHasRevisedSinceMark(true);
  };

  const handleOpenDownloadModal = () => {
    if (!markedBlob || !hasRevisedSinceMark) return;
    setShowMlaModal(true);
  };

  const handleDownloadRevised = async ({ includeMla }) => {
    if (!markedBlob) return;
    if (!supa) {
      setError("Supabase is not available.");
      return;
    }
    const text = extractPreviewText(previewRef.current);
    if (!text) {
      setError("Could not extract text from preview.");
      return;
    }

    setIsDownloading(true);
    setStatus({ message: "Preparing download...", kind: "info" });

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) {
        handleSessionExpired();
        return;
      }

      const apiBaseUrl = config.apiBaseUrl;
      if (!apiBaseUrl) {
        setError("Missing API configuration. Please refresh.");
        return;
      }

      const outputName = buildRevisedFilename();
      const finalText = includeMla ? `${buildMlaHeader()}${text}` : text;
      const blob = await exportDocx({
        apiBaseUrl,
        token: data.session.access_token,
        fileName: outputName,
        text: finalText
      });
      downloadBlob(blob, outputName);
      setHasRevisedSinceMark(false);
      setSuccess("Revised essay downloaded.");
    } catch (err) {
      console.error("Download revised failed", err);
      if (err?.code === "SESSION_EXPIRED") {
        handleSessionExpired();
        return;
      }
      const message = err?.message || "Failed to download revised essay.";
      setError(message);
    } finally {
      setIsDownloading(false);
      setShowMlaModal(false);
    }
  };

  const handleSignOut = async () => {
    if (!supa) {
      redirectToSignin();
      return;
    }

    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      redirectToSignin();
    }
  };

  const handleRepeatTutorial = () => {
    TOUR_KEYS.forEach((key) => localStorage.removeItem(key));
    tourRef.current?.restartTour({ force: true });
  };

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
  const statusClass =
    status.kind === "success" ? " success" : status.kind === "error" ? " error" : "";
  const diagnosticsData = {
    buildId: config.buildId,
    url: window.location.href,
    uiMode: (() => {
      try {
        return localStorage.getItem("uiMode") || "";
      } catch (err) {
        return "";
      }
    })(),
    apiBaseUrl: config.apiBaseUrl,
    markUrl: apiUrls.markUrl,
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

  return (
    <div className="student-react-shell">
      {config.featureFlags?.reactBeta ? <BetaBanner /> : null}
      <Topbar
        onProgress={() => window.location.assign("/student_progress.html")}
        onTeacher={() => {
          localStorage.setItem("vysti_role", "teacher");
          window.location.assign("/index.html");
        }}
        onRepeatTutorial={handleRepeatTutorial}
        onSignOut={handleSignOut}
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
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? "Processing" : "Mark my essay"}
            </button>
          </section>

          <DropZone
            selectedFile={selectedFile}
            isDragOver={isDragOver}
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
              <button
                id="downloadBtn"
                className="secondary-btn"
                type="button"
                style={{ display: markedBlob ? "inline-flex" : "none" }}
                onClick={handleDownload}
              >
                Download marked essay
              </button>
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

        <PreviewPanel
          markedBlob={markedBlob}
          zoom={zoom}
          onZoomChange={setZoom}
          previewRef={previewRef}
          onRecheck={handleRecheck}
          isRechecking={isRechecking}
          onEdit={handlePreviewEdited}
          onDownloadRevised={handleOpenDownloadModal}
          isDownloading={isDownloading}
          hasRevisedSinceMark={hasRevisedSinceMark}
        />

        <TechniquesPanel
          isOpen={showTechniques}
          onToggle={() => setShowTechniques((prev) => !prev)}
          data={techniques}
        />

        <DiagnosticsPanel
          isOpen={showDiagnostics}
          onToggle={() => setShowDiagnostics((prev) => !prev)}
          data={diagnosticsData}
        />
        <Footer />
      </main>

      {showMlaModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Download revised essay</h3>
            <label>
              <span>Name</span>
              <input
                type="text"
                value={mlaName}
                onChange={(event) => setMlaName(event.target.value)}
              />
            </label>
            <label>
              <span>Teacher</span>
              <input
                type="text"
                value={mlaTeacher}
                onChange={(event) => setMlaTeacher(event.target.value)}
              />
            </label>
            <label>
              <span>Date</span>
              <input
                type="text"
                value={mlaDate}
                onChange={(event) => setMlaDate(event.target.value)}
              />
            </label>
            <label>
              <span>Assignment</span>
              <input
                type="text"
                value={mlaAssignment}
                onChange={(event) => setMlaAssignment(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setShowMlaModal(false)}
                disabled={isDownloading}
              >
                Cancel
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => handleDownloadRevised({ includeMla: false })}
                disabled={isDownloading}
              >
                Download plain
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={() => handleDownloadRevised({ includeMla: true })}
                disabled={isDownloading}
              >
                Download MLA
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
