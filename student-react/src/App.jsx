import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { useRequireAuth } from "./hooks/useRequireAuth";
import Footer from "./components/Footer";
import ModeCard from "./components/ModeCard";
import PreviewCard from "./components/PreviewCard";
import ResultsCard from "./components/ResultsCard";
import StudentTour from "./components/StudentTour";
import Topbar from "./components/Topbar";
import UploadCard from "./components/UploadCard";
import { extractPreviewText } from "./lib/previewText";

const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "peel_paragraph", label: "Mini-essay paragraph" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" }
];

const MODE_RULE_DEFAULTS = {
  textual_analysis: {
    description: "A formal and academic essay of analysis with all Vysti Rules running.",
    details: [
      "No first-person allowed or personal pronouns",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  peel_paragraph: {
    description: "One focused analytical paragraph following the Vysti Rules.",
    details: [
      "The first sentence should state the author, genre, title, and summary.",
      "The first sentence should include devices and/or strategies like a closed thesis",
      "No first-person allowed or personal pronouns",
      "Requires quoted evidence in the body of the paragraph.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  reader_response: {
    description: "More personal voice allowed, but still needs argument + evidence.",
    details: [
      "Allows first-person and personal pronouns",
      "Allows contractions and 'which'",
      "First sentence should state the author, genre, title, and summary.",
      "Requires a closed thesis statement.",
      "Requires quoted evidence in body paragraphs.",
      "Strict requirements on organization, evidence, and language.",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  },
  argumentation: {
    description: "Argumentation is more open mode beyond textual analysis.",
    details: [
      "Allows for past tense.",
      "Allows first-person and personal pronouns",
      "Aqua-blue highlights repetitive 'and', weak verbs, and unclarified antecedents",
      "Red strikethroughs forbidden terms."
    ]
  }
};

const API_BASE = "https://vysti-rules.onrender.com";
const MARK_URL = `${API_BASE}/mark`;
const MARK_TEXT_URL = `${API_BASE}/mark_text`;
const DEFAULT_ZOOM = 1.5;

const TOUR_KEYS = [
  "vysti_student_helpers_disabled",
  "vysti_student_tour_completed",
  "vysti_student_tour_hide"
];

function App() {
  const { supa, isChecking, authError } = useRequireAuth();
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "info" });
  const [markedBlob, setMarkedBlob] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const tourRef = useRef(null);

  const redirectToSignIn = () => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/signin.html?redirect=${encodeURIComponent(next)}`);
  };

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    clearStatus();
    setSelectedFile(file);
    setMarkedBlob(null);
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
    if (!supa) {
      setError("Supabase is not available.");
      return;
    }

    setIsProcessing(true);
    setStatus({ message: "Processing...", kind: "info" });

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) {
        localStorage.removeItem("vysti_role");
        redirectToSignIn();
        return;
      }

      const token = data.session.access_token;
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", mode);
      formData.append("include_summary_table", "false");
      formData.append("highlight_thesis_devices", "false");
      formData.append("student_mode", "true");

      if (assignmentName.trim()) {
        formData.append("assignment_name", assignmentName.trim());
      }

      const response = await fetch(MARK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Mark failed (${response.status})`);
      }

      const blob = await response.blob();
      setMarkedBlob(blob);
      setSuccess("Marked successfully. Scroll down to Preview.");
    } catch (err) {
      console.error("Mark failed", err);
      setError("Failed to mark essay. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleMark();
  };

  const getToken = async () => {
    if (!supa) return null;
    const { data, error } = await supa.auth.getSession();
    if (error || !data?.session) {
      localStorage.removeItem("vysti_role");
      redirectToSignIn();
      return null;
    }
    return data.session.access_token;
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

  const handleDownload = async () => {
    if (!markedBlob || !selectedFile) return;
    const text = extractPreviewText(previewRef.current);
    if (!text) {
      setError("Please add text to the preview before downloading.");
      return;
    }

    setIsDownloading(true);
    setStatus({ message: "Preparing download...", kind: "info" });

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(MARK_TEXT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...buildMarkTextPayload(text),
          include_summary_table: true
        })
      });

      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const baseName = selectedFile.name.replace(/\.docx$/i, "");
      anchor.href = url;
      anchor.download = `${baseName}_marked.docx`;
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccess("Download started.");
    } catch (err) {
      console.error("Download failed", err);
      setError("Failed to download marked essay. Please try again.");
    } finally {
      setIsDownloading(false);
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
      const token = await getToken();
      if (!token) return;

      const response = await fetch(MARK_TEXT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildMarkTextPayload(text))
      });

      if (!response.ok) {
        throw new Error(`Recheck failed (${response.status})`);
      }

      const blob = await response.blob();
      setMarkedBlob(blob);
      setSuccess("Preview updated.");
    } catch (err) {
      console.error("Recheck failed", err);
      setError("Failed to recheck essay. Please try again.");
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
            <label>
              <span className="label-row mode-select-label-row">
                <span className="visually-hidden">Assignment type</span>
              </span>
              <select
                id="mode"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                aria-label="Assignment type"
              >
                {MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <ModeCard
              label={
                MODES.find((item) => item.value === mode)?.label || "Analytic essay"
              }
              description={modeExplainer.description}
              details={modeExplainer.details}
            />

            <div className="assignment-tracker-block">
              <div className="assignment-tracker-title">
                <span className="label-row">Assignment Tracker</span>
              </div>
              <label className="visually-hidden" htmlFor="assignmentName">
                Assignment name (optional)
              </label>
              <input
                type="text"
                id="assignmentName"
                value={assignmentName}
                onChange={(event) => setAssignmentName(event.target.value)}
                placeholder="Assignment 01"
                aria-label="Assignment name (optional)"
              />
            </div>

            <button
              className={`primary-btn${isProcessing ? " is-loading loading-cursor" : ""}`}
              id="checkBtn"
              type="submit"
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? "Processing" : "Mark my essay"}
            </button>
          </section>

          <UploadCard
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

          <ResultsCard
            status={status}
            showDownload={Boolean(markedBlob)}
            onDownload={handleDownload}
            isDownloading={isDownloading}
          />
        </form>

        <PreviewCard
          markedBlob={markedBlob}
          zoom={zoom}
          onZoomChange={setZoom}
          previewRef={previewRef}
          onRecheck={handleRecheck}
          isRechecking={isRechecking}
        />

        <Footer />
      </main>
    </div>
  );
}

export default App;
