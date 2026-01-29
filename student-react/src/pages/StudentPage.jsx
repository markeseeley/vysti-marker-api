import { useEffect, useMemo, useRef, useState } from "react";
import { useRequireAuth } from "../hooks/useRequireAuth";

const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "peel_paragraph", label: "Mini-essay paragraph" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" }
];

const MODE_EXPLAINER = {
  textual_analysis: {
    description: "A formal and academic essay of analysis with all Vysti Rules running."
  },
  peel_paragraph: {
    description: "A single paragraph that follows the PEEL structure."
  },
  reader_response: {
    description: "A reflective response that connects ideas to the reader's perspective."
  },
  argumentation: {
    description: "Argumentation is more open mode beyond textual analysis."
  }
};

const API_URL = "https://vysti-rules.onrender.com/mark";
const DEFAULT_ZOOM = "1.5";

export default function StudentPage() {
  // TODO: revision examples flow, metrics, tours, and dismiss modal behavior.
  const { supa, isChecking, authError } = useRequireAuth();
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [markedBlob, setMarkedBlob] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);

  const modeExplainer = useMemo(
    () => MODE_EXPLAINER[mode] || MODE_EXPLAINER.textual_analysis,
    [mode]
  );

  const hasResults = Boolean(statusMessage || downloadUrl);
  const showPreview = Boolean(markedBlob);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    container.style.zoom = zoom;
  }, [zoom]);

  useEffect(() => {
    let isActive = true;
    const container = previewRef.current;
    if (!container) return undefined;

    const render = async () => {
      container.innerHTML = "";
      if (!markedBlob) {
        container.innerHTML =
          "<p class='preview-empty'>Upload and mark an essay to preview it here.</p>";
        return;
      }

      try {
        const buf = await markedBlob.arrayBuffer();
        if (!isActive) return;

        if (window.docx?.renderAsync) {
          await window.docx.renderAsync(buf, container, null, { inWrapper: true });
          if (!isActive) return;
          container.contentEditable = "true";
          container.spellcheck = true;
          container.classList.add("preview-editable");
        } else {
          container.innerHTML =
            "<p>Preview not available. Please download the file to view.</p>";
        }
      } catch (err) {
        console.error("Failed to render preview", err);
        if (isActive) {
          container.innerHTML =
            "<p>Error rendering preview. Please download the file to view.</p>";
        }
      }
    };

    render();

    return () => {
      isActive = false;
    };
  }, [markedBlob]);

  useEffect(() => {
    if (!markedBlob) {
      setDownloadUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(markedBlob);
    setDownloadUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [markedBlob]);

  const setError = (message) => {
    setStatusKind("error");
    setStatusMessage(message);
  };

  const clearStatus = () => {
    setStatusKind("");
    setStatusMessage("");
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
    setStatusKind("info");
    setStatusMessage("Processing...");

    try {
      const { data, error } = await supa.auth.getSession();
      if (error || !data?.session) {
        window.location.replace("/signin.html");
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

      const response = await fetch(API_URL, {
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
      clearStatus();
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

  const handleDownload = () => {
    if (!downloadUrl || !selectedFile) return;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = selectedFile.name.replace(/\.docx$/i, "_marked.docx");
    anchor.rel = "noopener";
    anchor.click();
  };

  const handleSignOut = async () => {
    if (!supa) {
      window.location.replace("/signin.html");
      return;
    }

    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      window.location.replace("/signin.html");
    }
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

  return (
    <div className="student-react-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/assets/logo.svg" alt="Vysti" />
        </div>

        <nav></nav>

        <div className="actions">
          <button
            className="topbar-btn"
            id="progressBtn"
            type="button"
            onClick={() => {
              window.location.assign("/student_progress.html");
            }}
          >
            Progress
          </button>
          <button
            className="topbar-btn"
            id="switchModeBtn"
            type="button"
            onClick={() => {
              localStorage.setItem("vysti_role", "teacher");
              window.location.assign("/index.html");
            }}
          >
            Teacher
          </button>
          {/* TODO: repeat tutorial */}
          <button
            className="iconbtn repeat-tutorial-trigger"
            id="repeatTutorialBtn"
            type="button"
            aria-label="Repeat tutorial"
            data-tip="Repeat the tutorial"
            onClick={() => console.log("TODO: repeat tutorial")}
          >
            ?
          </button>
          <button
            className="topbar-btn"
            id="logoutBtn"
            type="button"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="page student-page">
        <form
          id="studentForm"
          className="marker-grid"
          onSubmit={handleSubmit}
          style={{ display: "grid" }}
        >
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

            <div className="mode-card" id="modeCard">
              <div className="mode-card-header">
                <span className="mode-badge" id="modeBadge">
                  {MODES.find((item) => item.value === mode)?.label ||
                    "Analytic essay"}
                </span>
                <span className="mode-tag" id="modeTag"></span>
              </div>
              <div className="mode-desc" id="modeDesc">
                {modeExplainer.description}
              </div>
              {/* TODO: show mode details */}
              <button
                type="button"
                className="mode-more"
                id="modeMoreBtn"
                aria-expanded="false"
                onClick={() => console.log("TODO: show mode details")}
              >
                Want more details?
              </button>
              <div className="mode-details" id="modeDetails" hidden>
                <ul id="modeDetailsList"></ul>
              </div>
            </div>

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
              className="primary-btn"
              id="checkBtn"
              type="submit"
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? "Processing..." : "Mark my essay"}
            </button>
          </section>

          <section className="card upload-card">
            <label>Upload</label>
            <div
              id="dropZone"
              className={`drop-zone${isDragOver ? " dragover" : ""}`}
              tabIndex={0}
              role="button"
              aria-label="Upload .docx file"
              onClick={handleBrowseClick}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleBrowseClick();
                }
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <img
                className="dz-icon"
                src="/assets/cloud-upload.svg"
                alt=""
                aria-hidden="true"
              />
              <div className="dz-title">Drag &amp; drop .docx file here</div>
              <div className="dz-sub">or click to browse</div>
              <input
                ref={fileInputRef}
                type="file"
                id="fileInput"
                name="file"
                accept=".docx"
                hidden
                onChange={handleFileChange}
              />
            </div>

            <ul id="fileList" className="file-list">
              {selectedFile ? <li>{selectedFile.name}</li> : null}
            </ul>
            <button
              type="button"
              id="clearFileBtn"
              className="secondary-btn"
              style={{ display: selectedFile ? "inline-flex" : "none" }}
              onClick={handleClearFile}
            >
              Clear file
            </button>
          </section>

          <section
            className="card rules-card"
            id="resultsCard"
            style={{ display: hasResults ? "block" : "none" }}
          >
            <div
              id="statusArea"
              className={`status-area${statusKind === "error" ? " error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>

            <button
              id="downloadBtn"
              className="secondary-btn"
              type="button"
              style={{
                display: downloadUrl ? "inline-flex" : "none",
                marginTop: "12px"
              }}
              onClick={handleDownload}
            >
              Download marked essay
            </button>

            <div
              id="mostCommonIssuesWrap"
              style={{ marginTop: "20px", display: "none" }}
            >
              {/* TODO: Most common issues chart */}
              <div className="rules-title">Most Common Issues</div>
              <div id="mciScrollViewport" className="mci-scroll-viewport">
                <div id="mciScrollInner" className="mci-scroll-inner">
                  <canvas id="mostCommonIssuesChart"></canvas>
                </div>
              </div>
            </div>
          </section>
        </form>

        <section
          className="card marked-preview-card"
          id="markedPreviewCard"
          style={{ display: showPreview ? "block" : "none" }}
        >
          <div className="preview-header">
            <h2 className="preview-title">Preview</h2>

            <div className="preview-header-right">
              <div
                id="statsPanel"
                className="preview-header-stats"
                style={{ display: "none" }}
              >
                <div className="preview-header-stats-row">
                  <div className="student-stat preview-stat">
                    <div className="student-stat-label">Word count</div>
                    <div id="wordCountStat" className="student-stat-value">
                      —
                    </div>
                  </div>

                  <div className="student-stat preview-stat">
                    <div className="student-stat-label">Total issues</div>
                    <div id="totalIssuesStat" className="student-stat-value">
                      —
                    </div>
                  </div>
                </div>
              </div>

              <div className="preview-tools">
                <label className="preview-zoom" htmlFor="previewZoom">
                  <span>Zoom</span>
                  <select
                    id="previewZoom"
                    value={zoom}
                    onChange={(event) => setZoom(event.target.value)}
                  >
                    <option value="0.8">80%</option>
                    <option value="0.9">90%</option>
                    <option value="1">100%</option>
                    <option value="1.1">110%</option>
                    <option value="1.25">125%</option>
                    <option value="1.5">150%</option>
                  </select>
                </label>
                {/* TODO: power verbs */}
                <button
                  type="button"
                  className="preview-pill-btn"
                  id="previewPowerVerbsBtn"
                  aria-label="Open Power Verbs"
                  onClick={() => console.log("TODO: power verbs")}
                >
                  <span className="preview-pill-icon" aria-hidden="true">
                    📘
                  </span>
                  Power Verbs
                </button>
              </div>
            </div>
          </div>
          <div
            id="markedPreview"
            ref={previewRef}
            className="marked-preview-container"
          ></div>
        </section>
      </main>
    </div>
  );
}
