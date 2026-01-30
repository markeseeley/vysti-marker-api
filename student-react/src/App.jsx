import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAuthSession } from "./hooks/useAuthSession";
import { extractPreviewText } from "./lib/previewText";
import { DEFAULT_ZOOM, MODE_RULE_DEFAULTS, MODES } from "./config";
import { markEssay, markText } from "./services/markEssay";

const TOUR_KEYS = [
  "vysti_student_helpers_disabled",
  "vysti_student_tour_completed",
  "vysti_student_tour_hide"
];

function App() {
  const { supa, isChecking, authError, redirectToSignIn } = useAuthSession();
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "info" });
  const [markedBlob, setMarkedBlob] = useState(null);
  const [techniques, setTechniques] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

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
        redirectToSignIn();
      }
    });
    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [redirectToSignIn, supa]);

  const setError = (message) => {
    setStatus({ message, kind: "error" });
  };

  const setSuccess = (message) => {
    setStatus({ message, kind: "success" });
  };

  const clearStatus = () => {
    setStatus({ message: "", kind: "info" });
  };

  const parseTechniquesHeader = (header) => {
    if (!header) return null;
    try {
      return JSON.parse(header);
    } catch (err) {
      console.warn("Failed to parse techniques header:", err);
      return header;
    }
  };

  const sanitizeLabel = (value) => {
    if (!value) return "";
    return String(value)
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
  };

  const buildMarkedFilename = () => {
    const rawName = selectedFile?.name || "essay.docx";
    const baseName = rawName.replace(/\.docx$/i, "");
    const assignmentLabel = sanitizeLabel(assignmentName);
    if (assignmentLabel) {
      return `${assignmentLabel}_${baseName}_marked.docx`;
    }
    return `${baseName}_marked.docx`;
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
      }
      setSelectedFile(null);
      setMarkedBlob(null);
      setTechniques(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    clearStatus();
    setSelectedFile(file);
    setMarkedBlob(null);
    setTechniques(null);
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
    setTechniques(null);
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

    try {
      const { blob, techniquesHeader } = await markEssay({
        supa,
        file: selectedFile,
        mode,
        assignmentName,
        onSessionExpired: redirectToSignIn
      });
      setMarkedBlob(blob);
      setTechniques(parseTechniquesHeader(techniquesHeader));
      setSuccess("Marked successfully. Scroll down to Preview.");
    } catch (err) {
      console.error("Mark failed", err);
      const message = err?.message || "Failed to mark essay. Please try again.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleMark();
  };

  const buildMarkTextPayload = (text) => ({
    file_name: selectedFile?.name || "essay.docx",
    text,
    mode,
    highlight_thesis_devices: false,
    include_summary_table: false,
    student_mode: true,
    assignment_name: assignmentName.trim() || undefined
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
  };

  const handleClearAll = () => {
    setSelectedFile(null);
    setMarkedBlob(null);
    setTechniques(null);
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
      const blob = await markText({
        supa,
        payload: buildMarkTextPayload(text),
        onSessionExpired: redirectToSignIn
      });
      setMarkedBlob(blob);
      setSuccess("Preview updated.");
    } catch (err) {
      console.error("Recheck failed", err);
      const message = err?.message || "Failed to recheck essay. Please try again.";
      setError(message);
    } finally {
      setIsRechecking(false);
    }
  };

  const handleSignOut = async () => {
    if (!supa) {
      redirectToSignIn();
      return;
    }

    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      redirectToSignIn();
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

  return (
    <div className="student-react-shell">
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
                Download marked file
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
        />

        <TechniquesPanel techniques={techniques} />

        <Footer />
      </main>
    </div>
  );
}

export default App;
