import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { getSupaClient } from "../lib/supa";

/**
 * LexisModal - Displays detected lexis terms with definitions and exploration prompts
 *
 * Props:
 *   - isOpen: boolean - whether modal is visible
 *   - onClose: function - callback to close modal
 *   - detectedLexis: array - list of detected terms from API
 */

/* ── Cached A-Z data (survives re-renders, shared across instances) ── */
let _azCache = null;
let _azPromise = null;

async function fetchAllLexis() {
  if (_azCache) return _azCache;
  if (_azPromise) return _azPromise;
  const apiBase = getApiBaseUrl();
  const headers = {};
  const supa = getSupaClient();
  if (supa) {
    const { data } = await supa.auth.getSession();
    if (data?.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  _azPromise = fetch(`${apiBase}/api/lexis`, { headers })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      _azCache = data.terms || [];
      _azPromise = null;
      return _azCache;
    })
    .catch((err) => {
      _azPromise = null;
      throw err;
    });
  return _azPromise;
}

const sectionLabel = {
  fontSize: "0.7rem",
  fontWeight: "700",
  letterSpacing: "0.05em",
  color: "#888",
  marginBottom: "0.35rem",
  textTransform: "uppercase",
};

/** Split exploration text into items following Q+S pattern:
 *  each item starts with a Question (ends with ?) optionally followed
 *  by a Statement (ends with .). A new Question starts a new item.
 *  Handles abbreviations (Jr., C., v., H.D.) that contain periods. */
function splitExploration(text) {
  // Split on sentence boundaries (. or ?) followed by whitespace
  const raw = text.split(/(?<=[.?])\s+/);
  // Re-join fragments split on abbreviations (1-2 letter words before .)
  const sentences = [];
  for (let i = 0; i < raw.length; i++) {
    if (sentences.length > 0 && /\b\w{1,2}\.$/.test(sentences[sentences.length - 1])) {
      sentences[sentences.length - 1] += " " + raw[i];
    } else {
      sentences.push(raw[i]);
    }
  }
  // Group: each Question starts a new item, Statements attach to preceding Question
  const items = [];
  let current = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (trimmed.endsWith("?") && current.length > 0) {
      items.push(current.join(" "));
      current = [trimmed];
    } else {
      current.push(trimmed);
    }
  }
  if (current.length > 0) items.push(current.join(" "));
  return items;
}

/** Renders the detail sections (definition, etymology, etc.) for a term object */
function TermDetail({ term }) {
  return (
    <>
      {/* Definition */}
      {term.definition && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={sectionLabel}>DEFINITION</div>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            {term.definition}
            {term.part_of_speech && (
              <span style={{ color: "#888", marginLeft: "0.5rem" }}>
                {term.part_of_speech}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Etymology */}
      {term.etymology && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={sectionLabel}>ETYMOLOGY</div>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              fontStyle: "italic",
              color: "#555",
              lineHeight: "1.5",
            }}
          >
            {term.etymology}
          </p>
        </div>
      )}

      {/* Application */}
      {term.application && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={sectionLabel}>APPLICATION</div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            {term.application
              .split(/(?<!\b[A-Z])\.\s+(?=[A-Za-z])/)
              .filter((item) => item.trim())
              .map((item, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: "0.4rem",
                    color: "#444",
                    lineHeight: "1.45",
                  }}
                >
                  {item.trim().replace(/\.$/, "").replace(/^./, c => c.toUpperCase())}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Exploration */}
      {term.exploration && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={sectionLabel}>EXPLORATION</div>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            {splitExploration(term.exploration).map((item, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: "0.4rem",
                    color: "#444",
                    lineHeight: "1.45",
                  }}
                >
                  {item}
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* Quote */}
      {term.quote && (
        <div
          style={{
            marginTop: "1rem",
            paddingLeft: "1rem",
            borderLeft: "3px solid #A90D22",
            fontStyle: "italic",
            fontSize: "0.85rem",
            color: "#555",
          }}
        >
          &ldquo;{term.quote}&rdquo;
          {(term.author || term.source_major) && (
            <div style={{ marginTop: "0.25rem", fontStyle: "normal" }}>
              &mdash; {term.author}
              {term.source_major && (
                <span>, <em>{term.source_major}</em></span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** A-Z Dictionary browsing view — letter-grouped, searchable, scrollable */
function AzDictionaryView({
  azTerms, azLoading, azError, azSearch, setAzSearch,
  azExpandedTerm, setAzExpandedTerm, azScrollRef,
  detectedNorms, onRetry,
}) {
  if (azLoading) {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem", color: "#888", fontSize: "0.9rem" }}>
        Loading dictionary&hellip;
      </div>
    );
  }
  if (azError) {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem" }}>
        <p style={{ color: "#888", marginBottom: "1rem" }}>{azError}</p>
        <button
          type="button"
          onClick={() => { _azCache = null; onRetry(); }}
          style={{
            background: "none", border: "1px solid #ccc",
            borderRadius: "6px", padding: "0.4rem 1rem",
            cursor: "pointer", fontSize: "0.85rem", color: "#444",
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!azTerms || azTerms.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
        No terms available.
      </div>
    );
  }

  // Filter by search
  const query = azSearch.trim().toLowerCase();
  const filtered = query
    ? azTerms.filter((t) =>
        t.term.toLowerCase().includes(query) ||
        (t.definition && t.definition.toLowerCase().includes(query))
      )
    : azTerms;

  // Group by first letter
  const groups = {};
  for (const t of filtered) {
    const letter = (t.term[0] || "?").toUpperCase();
    // Normalize accented first letters to their base (Ü→U)
    const base = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const key = /^[A-Z]$/.test(base) ? base : "#";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  const letters = Object.keys(groups).sort();

  const toggleAzExpand = (termNorm) => {
    setAzExpandedTerm(azExpandedTerm === termNorm ? null : termNorm);
  };

  return (
    <>
      {/* Search bar */}
      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          name="lexis-search"
          value={azSearch}
          onChange={(e) => setAzSearch(e.target.value)}
          placeholder="Search"
          style={{
            width: "100%",
            height: "36px",
            padding: "0 12px",
            border: "1px solid rgba(0,0,0,.14)",
            borderRadius: "10px",
            background: "#fff",
            fontSize: "0.85rem",
            outline: "none",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#A90D22";
            e.target.style.boxShadow = "0 0 0 3px rgba(169,13,34,.15)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(0,0,0,.14)";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>

      {/* Count */}
      <p style={{ marginBottom: "10px", color: "#666", fontSize: "0.85rem" }}>
        {query
          ? <><strong>{filtered.length}</strong> of {azTerms.length} terms</>
          : <><strong>{azTerms.length}</strong> terms in the dictionary</>
        }
      </p>

      {/* Letter jump bar */}
      {!query && (
        <div className="lexis-az-jumpbar">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
            <button
              key={l}
              type="button"
              className={`lexis-az-jump${groups[l] ? "" : " lexis-az-jump-disabled"}`}
              disabled={!groups[l]}
              onClick={() => {
                const el = azScrollRef.current?.querySelector(`[data-az-letter="${l}"]`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable A-Z list */}
      <div className="lexis-az-scroll" ref={azScrollRef}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            No terms match &ldquo;{azSearch}&rdquo;
          </p>
        ) : (
          letters.map((letter) => (
            <div key={letter}>
              <div className="pv-az-letter" data-az-letter={letter}>{letter}</div>
              {groups[letter].map((term) => {
                const isExpanded = azExpandedTerm === term.term_norm;
                const isDetected = detectedNorms.has(term.term_norm);
                return (
                  <div
                    key={term.term_norm}
                    style={{
                      marginBottom: "4px",
                      border: "1px solid",
                      borderColor: isDetected ? "rgba(169,13,34,.25)" : "#e0e0e0",
                      borderRadius: "6px",
                      overflow: isExpanded ? "visible" : "hidden",
                      background: isDetected ? "rgba(252,232,235,.15)" : "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAzExpand(term.term_norm)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>
                        <strong style={{ fontSize: "0.88rem" }}>{term.term}</strong>
                        {term.part_of_speech && (
                          <span style={{ color: "#888", marginLeft: "6px", fontSize: "0.75rem" }}>
                            {term.part_of_speech}
                          </span>
                        )}
                        {isDetected && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "0.65rem",
                              fontWeight: "700",
                              color: "#A90D22",
                              background: "rgba(169,13,34,.08)",
                              padding: "1px 6px",
                              borderRadius: "999px",
                            }}
                          >
                            in your essay
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "#999", flexShrink: 0 }}>
                        {isExpanded ? "\u25BC" : "\u25B6"}
                      </span>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#fafafa",
                          borderTop: "1px solid #e0e0e0",
                        }}
                      >
                        <TermDetail term={term} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function LexisModal({ isOpen, onClose, detectedLexis = [], onFindInPreview, initialView = "detected" }) {
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [browsedTerm, setBrowsedTerm] = useState(null); // fetched related-term data
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null); // term name if not found
  const [browseHistory, setBrowseHistory] = useState([]); // stack for back navigation
  const modalBodyRef = useRef(null);
  const panelRef = useRef(null);

  /* ── Drag state — refs to avoid re-renders on every pointer-move ── */
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const positioned = useRef(false);

  /* ── A-Z Dictionary state ── */
  const [viewMode, setViewMode] = useState(initialView); // "detected" | "az"
  const [azTerms, setAzTerms] = useState(null); // null = not loaded, [] = loaded
  const [azLoading, setAzLoading] = useState(false);
  const [azError, setAzError] = useState(null);
  const [azExpandedTerm, setAzExpandedTerm] = useState(null);
  const [azSearch, setAzSearch] = useState("");
  const azScrollRef = useRef(null);

  // Build a set of detected term_norms for quick lookup
  const detectedNorms = new Set(detectedLexis.map((t) => t.term_norm));

  /* ── Position panel on open ── */
  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current || positioned.current) return;
    const panel = panelRef.current;
    panel.style.visibility = "hidden";
    const panelRect = panel.getBoundingClientRect();
    const padding = 12;

    // Try to anchor to right side of .preview-stage, vertically centered
    const stage = document.querySelector(".preview-stage");
    let top, left;
    if (stage) {
      const stageRect = stage.getBoundingClientRect();
      left = stageRect.right - panelRect.width - padding;
      top = stageRect.top + (stageRect.height - panelRect.height) * 0.3;
    } else {
      // Fallback: center of viewport
      left = (window.innerWidth - panelRect.width) / 2;
      top = (window.innerHeight - panelRect.height) * 0.3;
    }

    // Clamp to viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - panelRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - panelRect.height - padding));

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.visibility = "visible";
    positioned.current = true;
  }, [isOpen]);

  /* Reset position flag when closed */
  useEffect(() => {
    if (!isOpen) positioned.current = false;
  }, [isOpen]);

  /* ── Close on click-outside or Escape ── */
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (e) => {
      if (isDragging.current) return;
      if (panelRef.current?.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  /* ── Drag-by-header ── */
  const handlePointerDown = useCallback((e) => {
    // Don't drag if clicking a button in the header
    if (e.target.closest(".modal-close") || e.target.closest(".pv-az-btn")) return;
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const panelRect = panel.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - panelRect.left, y: e.clientY - panelRect.top };
    isDragging.current = true;

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const x = ev.clientX - dragOffset.current.x;
      const y = ev.clientY - dragOffset.current.y;
      panel.style.left = `${Math.round(x)}px`;
      panel.style.top = `${Math.round(y)}px`;
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, []);

  /* Load A-Z data when switching to az mode */
  const loadAzData = useCallback(() => {
    if (azTerms) return; // already loaded
    setAzLoading(true);
    setAzError(null);
    fetchAllLexis()
      .then((terms) => {
        setAzTerms(terms);
        setAzLoading(false);
      })
      .catch(() => {
        setAzError("Could not load dictionary.");
        setAzLoading(false);
      });
  }, [azTerms]);

  // Auto-load A-Z data when opening in az mode
  useEffect(() => {
    if (isOpen && viewMode === "az") loadAzData();
  }, [isOpen, viewMode, loadAzData]);

  const handleAzToggle = () => {
    if (viewMode === "az") {
      setViewMode("detected");
    } else {
      setViewMode("az");
      loadAzData();
    }
    // Clear browsed overlay when switching
    setBrowsedTerm(null);
    setBrowseHistory([]);
    setBrowseError(null);
  };

  if (!isOpen) return null;

  const toggleExpand = (termNorm) => {
    setExpandedTerm(expandedTerm === termNorm ? null : termNorm);
  };

  const jumpToTerm = (termNorm) => {
    // If browsing a related term, close that overlay first
    setBrowsedTerm(null);
    setBrowseHistory([]);
    setExpandedTerm(termNorm);
    requestAnimationFrame(() => {
      const el = modalBodyRef.current?.querySelector(
        `[data-term-norm="${CSS.escape(termNorm)}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const fetchRelatedTerm = async (termNorm) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(
        `${apiBase}/api/lexis/${encodeURIComponent(termNorm)}`
      );
      if (!res.ok) {
        setBrowseLoading(false);
        setBrowseError(termNorm);
        return;
      }
      const data = await res.json();
      // Push current browsed term onto history stack (if any)
      if (browsedTerm) {
        setBrowseHistory((prev) => [...prev, browsedTerm]);
      }
      setBrowsedTerm(data);
    } catch {
      setBrowseError(termNorm);
    }
    setBrowseLoading(false);
  };

  const handleRelatedClick = (relNorm) => {
    if (detectedNorms.has(relNorm)) {
      jumpToTerm(relNorm);
    } else {
      fetchRelatedTerm(relNorm);
    }
  };

  const handleBrowseBack = () => {
    if (browseHistory.length > 0) {
      const prev = browseHistory[browseHistory.length - 1];
      setBrowseHistory((h) => h.slice(0, -1));
      setBrowsedTerm(prev);
    } else {
      setBrowsedTerm(null);
    }
  };

  // Group by focus_type for better organization
  const grouped = {};
  detectedLexis.forEach((term) => {
    const type = term.focus_type || "other";
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(term);
  });

  const typeOrder = ["concept", "device", "event", "person", "other"];
  const typeLabels = {
    concept: "Concepts",
    device: "Techniques",
    event: "Historical Events",
    person: "People & Organizations",
    other: "Other Terms",
  };

  /** Renders the Related Terms chips for a given term */
  const renderRelatedTerms = (term) => {
    const relSource = term.assign_lexis || term.linked_lexis;
    if (!relSource) return null;
    return (
      <div style={{ marginBottom: "1rem", marginTop: "1rem" }}>
        <div style={sectionLabel}>RELATED TERMS</div>
        <div style={{ fontSize: "0.85rem" }}>
          {relSource
            .split(",")
            .filter((rel) => rel.trim())
            .map((rel, i) => {
              const relNorm = rel.trim().toLowerCase();
              const isDetected = detectedNorms.has(relNorm);
              return (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRelatedClick(relNorm)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRelatedClick(relNorm);
                  }}
                  style={{
                    display: "inline-block",
                    background: isDetected ? "#fce8eb" : "#f0f0f0",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "3px",
                    marginRight: "0.5rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    border: isDetected
                      ? "1px solid #A90D22"
                      : "1px solid #ccc",
                  }}
                >
                  {rel.trim()}
                  <span
                    style={{ marginLeft: "0.3rem", fontSize: "0.7rem" }}
                  >
                    {isDetected ? "\u2197" : "\u2192"}
                  </span>
                </span>
              );
            })}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      ref={panelRef}
      className="modal-content lexis-modal"
      style={{
        position: "fixed",
        zIndex: 9999,
        maxWidth: "700px",
        width: "90vw",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        className="modal-header"
        onPointerDown={handlePointerDown}
        style={{ cursor: "grab", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2>Explore</h2>
          <button
            className={`pv-az-btn${viewMode === "az" ? " pv-az-active" : ""}`}
            type="button"
            aria-label="Browse full dictionary A\u2013Z"
            title={viewMode === "az" ? "Back to detected terms" : "Browse A\u2013Z Dictionary"}
            onClick={handleAzToggle}
          >
            A-Z
          </button>
        </div>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <div className="modal-body" ref={modalBodyRef} style={{ position: "relative", flex: "1 1 auto", overflowY: "auto" }}>
        {/* ── A-Z Dictionary View ── */}
        {viewMode === "az" && (
          <AzDictionaryView
            azTerms={azTerms}
            azLoading={azLoading}
            azError={azError}
            azSearch={azSearch}
            setAzSearch={setAzSearch}
            azExpandedTerm={azExpandedTerm}
            setAzExpandedTerm={setAzExpandedTerm}
            azScrollRef={azScrollRef}
            detectedNorms={detectedNorms}
            onRetry={loadAzData}
          />
        )}

        {/* ── Detected Terms View ── */}
        {viewMode === "detected" && <>
        {/* Browsed Related Term Overlay — covers the modal body */}
        {(browsedTerm || browseLoading || browseError) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              background: "#fff",
              overflowY: "auto",
              padding: "1rem",
            }}
          >
            {browseLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#888",
                  fontSize: "0.9rem",
                }}
              >
                Loading term...
              </div>
            ) : browseError ? (
              <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
                <div
                  style={{
                    fontFamily: '"Source Serif 4", Georgia, "Times New Roman", serif',
                    fontSize: "1.3rem",
                    fontWeight: "600",
                    color: "#333",
                    marginBottom: "0.5rem",
                  }}
                >
                  {browseError}
                </div>
                <p
                  style={{
                    fontFamily: '"Source Serif 4", Georgia, "Times New Roman", serif',
                    color: "#888",
                    fontSize: "0.95rem",
                    marginBottom: "1.5rem",
                    fontStyle: "italic",
                  }}
                >
                  Currently unavailable. We&rsquo;re working on it.
                </p>
                <button
                  type="button"
                  onClick={() => { setBrowseError(null); }}
                  style={{
                    background: "none",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "0.4rem 1rem",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    color: "#444",
                  }}
                >
                  &larr; Back
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                    borderBottom: "2px solid #A90D22",
                    paddingBottom: "0.5rem",
                  }}
                >
                  <div>
                    <button
                      type="button"
                      onClick={handleBrowseBack}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "#A90D22",
                        padding: "0",
                        marginRight: "0.5rem",
                      }}
                    >
                      &larr; Back
                    </button>
                    <strong style={{ fontSize: "1.05rem" }}>
                      {browsedTerm.term}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBrowsedTerm(null);
                      setBrowseHistory([]);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.2rem",
                      color: "#888",
                      padding: "0",
                    }}
                    aria-label="Close detail"
                  >
                    &times;
                  </button>
                </div>
                <TermDetail term={browsedTerm} />
                {renderRelatedTerms(browsedTerm)}
              </>
            )}
          </div>
        )}

        {detectedLexis.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#666",
              padding: "2rem",
            }}
          >
            No lexis terms detected in your document.
          </p>
        ) : (
          <>
            <p style={{ marginBottom: "1rem", color: "#666" }}>
              We found <strong>{detectedLexis.length}</strong> sophisticated
              terms in your writing. Click any term to explore deeper.
            </p>

            {typeOrder.map((type) => {
              const terms = grouped[type];
              if (!terms || terms.length === 0) return null;

              return (
                <div key={type} style={{ marginBottom: "1.5rem" }}>
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      marginBottom: "0.5rem",
                      color: "#444",
                      borderBottom: "1px solid #e0e0e0",
                      paddingBottom: "0.25rem",
                    }}
                  >
                    {typeLabels[type]}
                  </h3>

                  {terms.map((term) => {
                    const isExpanded = expandedTerm === term.term_norm;

                    return (
                      <div
                        key={term.term_norm}
                        data-term-norm={term.term_norm}
                        style={{
                          marginBottom: "0.75rem",
                          border: "1px solid #e0e0e0",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Term Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            background: isExpanded ? "#f5f5f5" : "white",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(term.term_norm)}
                            style={{
                              flex: 1,
                              padding: "0.75rem",
                              background: "transparent",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <strong>{term.term}</strong>
                            </div>
                            <span style={{ fontSize: "1.2rem" }}>
                              {isExpanded ? "\u25BC" : "\u25B6"}
                            </span>
                          </button>
                          {onFindInPreview && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onFindInPreview(term.term);
                              }}
                              title="Find in Preview"
                              style={{
                                background: "none",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                padding: "0.3rem 0.5rem",
                                marginRight: "0.75rem",
                                cursor: "pointer",
                                fontSize: "0.7rem",
                                color: "#555",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Find in Preview
                            </button>
                          )}
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "1rem",
                              background: "#fafafa",
                              borderTop: "1px solid #e0e0e0",
                            }}
                          >
                            <TermDetail term={term} />
                            {renderRelatedTerms(term)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
        </>}
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="secondary-btn"
          onClick={onClose}
          style={{ marginLeft: "auto" }}
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
