import { useEffect, useRef, useState } from "react";
import { getSupaClient } from "./lib/supa";
import "./App.css";

const MODES = [
  { value: "textual_analysis", label: "Analytic essay" },
  { value: "peel_paragraph", label: "Mini-essay paragraph" },
  { value: "reader_response", label: "Reader response" },
  { value: "argumentation", label: "Argumentation" }
];

const DEFAULT_ZOOM = "1.1";
const API_URL = "https://vysti-rules.onrender.com/mark";

function App() {
  const buildId = import.meta.env.VITE_APP_BUILD_ID || "dev";
  const appMode = import.meta.env.MODE;
  const [supa, setSupa] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState("textual_analysis");
  const [assignmentName, setAssignmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [markedBlob, setMarkedBlob] = useState(null);
  const [techniquesHeader, setTechniquesHeader] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [authError, setAuthError] = useState("");

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    console.info("[Vysti Student React] build", buildId);
    console.info("[Vysti Student React] mode", appMode);
  }, [buildId, appMode]);

  useEffect(() => {
    const client = getSupaClient();
    setSupa(client);

    if (!client) {
      setAuthError("Supabase client not available.");
      setAuthReady(true);
      return;
    }

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!data?.session) {
          window.location.replace("/signin.html");
          return;
        }

        localStorage.setItem("vysti_role", "student");
        setAuthReady(true);
      })
      .catch((err) => {
        console.error("Failed to read session", err);
        setAuthError("Unable to verify session. Please refresh.");
        setAuthReady(true);
      });
  }, []);

  useEffect(() => {
    const preventFileDrop = (event) => {
      const dt = event?.dataTransfer;
      if (!dt) return;
      const types = Array.from(dt.types || []);
      const hasFiles =
        (dt.items && Array.from(dt.items).some((item) => item.kind === "file")) ||
        (dt.files && dt.files.length > 0) ||
        types.includes("Files") ||
        types.includes("application/x-moz-file") ||
        types.includes("public.file-url");
      if (!hasFiles) return;
      if (event.cancelable) event.preventDefault();
    };

    const options = { capture: true, passive: false };
    ["dragenter", "dragover", "drop"].forEach((eventName) => {
      window.addEventListener(eventName, preventFileDrop, options);
      document.addEventListener(eventName, preventFileDrop, options);
    });

    return () => {
      ["dragenter", "dragover", "drop"].forEach((eventName) => {
        window.removeEventListener(eventName, preventFileDrop, options);
        document.removeEventListener(eventName, preventFileDrop, options);
      });
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const renderPreview = async () => {
      const container = previewRef.current;
      if (!container) return;
      container.innerHTML = "";

      if (!markedBlob) return;

      try {
        const buf = await markedBlob.arrayBuffer();
        if (!isActive) return;

        if (window.docx?.renderAsync) {
          await window.docx.renderAsync(buf, container, null, {
            inWrapper: true
          });
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

      if (isActive) {
        container.style.zoom = zoom;
      }
    };

    renderPreview();

    return () => {
      isActive = false;
    };
  }, [markedBlob, zoom]);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!isDocx(file)) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setMarkedBlob(null);
    setTechniquesHeader(null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (!isDocx(file)) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setMarkedBlob(null);
    setTechniquesHeader(null);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleMark = async () => {
    if (!selectedFile || !supa) return;
    setIsProcessing(true);
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
      const header = response.headers.get("X-Vysti-Techniques");
      setTechniquesHeader(header);
      setMarkedBlob(blob);
      setStatusMessage("");
    } catch (err) {
      console.error("Mark failed", err);
      setStatusMessage("Failed to mark essay. Please try again.");
    } finally {
      setIsProcessing(false);
    }
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

  if (!authReady) {
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
          <span className="build-stamp">Build: {buildId}</span>
          <button className="topbar-btn" type="button" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="page student-page">
        <div className="marker-grid">
          <section className="card form-card">
            <div className="assignment-tracker-title">
              Select the writing type
            </div>
            <label>
              <span className="label-row mode-select-label-row">
                <span className="visually-hidden">Assignment type</span>
              </span>
              <select
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

            <div className="assignment-tracker-block">
              <div className="assignment-tracker-title">
                <span className="label-row">Assignment Tracker</span>
              </div>
              <label className="visually-hidden" htmlFor="assignmentName">
                Assignment name (optional)
              </label>
              <input
                id="assignmentName"
                type="text"
                value={assignmentName}
                onChange={(event) => setAssignmentName(event.target.value)}
                placeholder="Assignment 01"
                aria-label="Assignment name (optional)"
              />
            </div>

            <div
              className={`drop-zone${isDragOver ? " dragover" : ""}`}
              role="button"
              tabIndex={0}
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
              aria-label="Upload .docx file"
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
                accept=".docx"
                hidden
                onChange={handleFileChange}
              />
            </div>

            <ul className="file-list">
              {selectedFile ? <li>{selectedFile.name}</li> : null}
            </ul>

            {statusMessage ? (
              <div className="status-area" role="status">
                {statusMessage}
              </div>
            ) : null}

            <button
              className="primary-btn"
              type="button"
              onClick={handleMark}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? "Processing ▌" : "Mark my essay"}
            </button>
          </section>

          <section className="card upload-card">
            <div className="preview-header">
              <h2 className="preview-title">Preview</h2>
              <div className="preview-tools">
                <label className="preview-zoom">
                  <span>Zoom</span>
                  <select
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
              </div>
            </div>

            <div className="preview-stage">
              <div
                id="markedPreview"
                ref={previewRef}
                className="marked-preview-container"
              >
                {markedBlob ? null : (
                  <p className="preview-empty">
                    Upload and mark an essay to preview it here.
                  </p>
                )}
              </div>
            </div>

            {techniquesHeader ? (
              <div className="status-area">Techniques loaded.</div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
