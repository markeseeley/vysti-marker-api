import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMMENT_BANK, fillTemplate } from "../lib/commentBank";
import { computeIBScores, generateIBComments } from "../lib/ibScoring";
import { computeMeterDeltas } from "../lib/studentContext";
import { groupLabelsByMetric, shortenLabel } from "@student/lib/labelToMetric";

const METER_LABELS = {
  power: "Power",
  variety: "Analysis",
  cohesion: "Cohesion",
  precision: "Precision",
};

const METER_TOOLTIPS = {
  power: "Verb specificity and strength",
  variety: "Analytical depth: techniques, evidence, and structure",
  cohesion: "Idea flow within and across paragraphs",
  precision: "Prose quality: concision, clarity, and conventions",
};

const IB_TOOLTIPS = {
  a: "Understanding and interpretation",
  b: "Analysis and evaluation",
  c: "Focus and organization",
  d: "Language",
};

const METER_ORDER = ["power", "variety", "cohesion", "precision"];

const MAX_COMMENT_CHARS = 2000;

function AutoTextarea({ value, onChange, placeholder, className, maxLength }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref}
        name="teacher-comment"
        className={className || "cn-textarea"}
        value={value}
        onChange={(e) => {
          const v = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
          onChange(v);
        }}
        placeholder={placeholder}
        rows={2}
        maxLength={maxLength}
      />
      {maxLength && value && value.length > maxLength * 0.8 && (
        <span style={{
          position: "absolute", bottom: 4, right: 8,
          fontSize: "10px", color: value.length >= maxLength ? "#dc2626" : "rgba(0,0,0,.35)",
        }}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Student Context Panel ──────────────────────────────────────────
function StudentContextPanel({ doc, studentContext }) {
  const [showPrevComment, setShowPrevComment] = useState(false);

  const prev = studentContext?.previousEssay || null;

  // Meter deltas (must be called unconditionally)
  const meterDeltas = useMemo(
    () => prev ? computeMeterDeltas(doc.labelCounts, prev.labelCounts) : {},
    [doc.labelCounts, prev?.labelCounts]
  );

  if (!prev) return null;

  const currentTotal = doc.totalLabels || 0;
  const prevTotal = prev.totalLabels || 0;
  const delta = currentTotal - prevTotal;
  const prevName = prev.assignmentName || "previous essay";

  return (
    <div className="cn-context">
      <div className="cn-context-summary">
        <span className="cn-context-count">
          Essay {studentContext.essayCount}
        </span>
        <span className="cn-context-sep">&middot;</span>
        {delta < 0 ? (
          <span className="cn-context-trend cn-trend--improved">
            &#x25BC; {Math.abs(delta)} fewer issues
          </span>
        ) : delta > 0 ? (
          <span className="cn-context-trend cn-trend--regressed">
            &#x25B2; {delta} more issues
          </span>
        ) : (
          <span className="cn-context-trend cn-trend--same">
            No change in issues
          </span>
        )}
        <span className="cn-context-sep">&middot;</span>
        <span className="cn-context-vs">vs {prevName}</span>
      </div>

      <div className="cn-context-meters">
        {Object.entries(meterDeltas).map(([meter, d]) => {
          if (d === 0) return null;
          const cls = d < 0 ? "cn-chip--improved" : "cn-chip--regressed";
          const arrow = d < 0 ? "\u2193" : "\u2191";
          return (
            <span key={meter} className={`cn-meter-chip ${cls}`}>
              {METER_LABELS[meter]} {arrow}{Math.abs(d)}
            </span>
          );
        })}
      </div>

      {prev.teacherComment && (
        <div className="cn-prev-comment">
          <button
            type="button"
            className="cn-prev-toggle"
            onClick={() => setShowPrevComment((v) => !v)}
          >
            {showPrevComment ? "Hide" : "Show"} previous comment
          </button>
          {showPrevComment && (
            <blockquote className="cn-prev-quote">
              {prev.teacherComment}
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_SAVED_PER_METRIC = 5;

// ── Main Component ─────────────────────────────────────────────────
export default function TeacherCommentNotebook({
  doc,
  comment,
  onCommentChange,
  onScoreChange,
  onToggleDownload,
  onToggleDetailsDownload,
  onStudentNameChange,
  notes,
  onNotesChange,
  studentContext,
  metrics,
  mode,
  supa,
}) {
  const [editingScore, setEditingScore] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const scoreInputRef = useRef(null);

  // Inline chip editing: { type: "meter"|"ib"|"pctTotal"|"ibTotal", key: string }
  const [editingChip, setEditingChip] = useState(null);
  const [chipInput, setChipInput] = useState("");
  const chipInputRef = useRef(null);

  // Snippet buttons
  const [activeSnippetMeter, setActiveSnippetMeter] = useState(null);

  // ── Saved teacher snippets ──
  const [savedSnippets, setSavedSnippets] = useState({}); // { power: [...], variety: [...], ... }
  const [snippetsLoaded, setSnippetsLoaded] = useState(false);
  const [addingSnippet, setAddingSnippet] = useState(null); // metric key or null
  const [newSnippetText, setNewSnippetText] = useState("");
  const [editingSnippetId, setEditingSnippetId] = useState(null);
  const [editSnippetText, setEditSnippetText] = useState("");
  const newSnippetRef = useRef(null);
  const editSnippetRef = useRef(null);

  // Load saved snippets once
  useEffect(() => {
    if (!supa || snippetsLoaded) return;
    (async () => {
      try {
        const { data: sess } = await supa.auth.getSession();
        if (!sess?.session) return;
        const { data, error } = await supa
          .from("teacher_snippets")
          .select("id, metric, text, sort_order")
          .eq("user_id", sess.session.user.id)
          .order("sort_order");
        if (error) { console.warn("Failed to load snippets:", error); return; }
        const grouped = {};
        for (const m of METER_ORDER) grouped[m] = [];
        (data || []).forEach(s => {
          if (grouped[s.metric]) grouped[s.metric].push(s);
        });
        setSavedSnippets(grouped);
      } finally {
        setSnippetsLoaded(true);
      }
    })();
  }, [supa, snippetsLoaded]);

  // Focus new snippet input
  useEffect(() => {
    if (addingSnippet && newSnippetRef.current) newSnippetRef.current.focus();
  }, [addingSnippet]);

  // Focus edit snippet input
  useEffect(() => {
    if (editingSnippetId && editSnippetRef.current) editSnippetRef.current.focus();
  }, [editingSnippetId]);

  const saveNewSnippet = useCallback(async (metric) => {
    const text = newSnippetText.trim();
    if (!text || !supa) { setAddingSnippet(null); setNewSnippetText(""); return; }
    const current = savedSnippets[metric] || [];
    if (current.length >= MAX_SAVED_PER_METRIC) return;
    const { data: sess } = await supa.auth.getSession();
    if (!sess?.session) return;
    const { data, error } = await supa
      .from("teacher_snippets")
      .insert({ user_id: sess.session.user.id, metric, text, sort_order: current.length })
      .select("id, metric, text, sort_order")
      .single();
    if (!error && data) {
      setSavedSnippets(prev => ({ ...prev, [metric]: [...(prev[metric] || []), data] }));
    }
    setAddingSnippet(null);
    setNewSnippetText("");
  }, [supa, newSnippetText, savedSnippets]);

  const updateSnippet = useCallback(async (snippetId, metric) => {
    const text = editSnippetText.trim();
    if (!text || !supa) { setEditingSnippetId(null); setEditSnippetText(""); return; }
    const { error } = await supa
      .from("teacher_snippets")
      .update({ text })
      .eq("id", snippetId);
    if (!error) {
      setSavedSnippets(prev => ({
        ...prev,
        [metric]: (prev[metric] || []).map(s => s.id === snippetId ? { ...s, text } : s),
      }));
    }
    setEditingSnippetId(null);
    setEditSnippetText("");
  }, [supa, editSnippetText]);

  const deleteSnippet = useCallback(async (snippetId, metric) => {
    if (!supa) return;
    const { error } = await supa
      .from("teacher_snippets")
      .delete()
      .eq("id", snippetId);
    if (!error) {
      setSavedSnippets(prev => ({
        ...prev,
        [metric]: (prev[metric] || []).filter(s => s.id !== snippetId),
      }));
    }
  }, [supa]);

  // Keep a ref to the latest comment so callbacks never read stale closures
  const commentRef = useRef(comment);
  commentRef.current = comment;


  // Score format toggles (defaults: % on, IB off)
  const scoreFormats = comment?.scoreFormats || { percent: true, ib: false };
  const meterOverrides = comment?.meterOverrides || { power: null, variety: null, cohesion: null, precision: null };
  const ibOverrides = comment?.ibOverrides || { a: null, b: null, c: null, d: null };

  // IB Paper 1 scoring (derived — does not affect meters)
  const ibScores = useMemo(
    () => doc ? computeIBScores(doc.labelCounts, doc.wordCount) : null,
    [doc]
  );
  const ibComments = useMemo(
    () => ibScores ? generateIBComments(ibScores) : [],
    [ibScores]
  );

  // Effective IB values (overrides take precedence)
  const effectiveIB = useMemo(() => {
    if (!ibScores) return null;
    const a = ibOverrides.a ?? ibScores.a;
    const b = ibOverrides.b ?? ibScores.b;
    const c = ibOverrides.c ?? ibScores.c;
    const d = ibOverrides.d ?? ibScores.d;
    return { a, b, c, d, total: a + b + c + d };
  }, [ibScores, ibOverrides]);

  // Effective meter scores (overrides take precedence)
  const effectiveMeters = useMemo(() => {
    const result = {};
    for (const m of METER_ORDER) {
      result[m] = meterOverrides[m] ?? Math.round(metrics?.[m]?.score ?? 0);
    }
    return result;
  }, [metrics, meterOverrides]);

  // Pre-filled snippet templates per meter (for quick-insert buttons).
  // Uses a simple hash of doc.id to pick a stable-but-varied template index
  // so different documents get different snippets without flickering on re-render.
  const snippets = useMemo(() => {
    if (!doc) return {};
    const entries = Object.entries(doc.labelCounts || {})
      .filter(([, count]) => (Number(count) || 0) > 0)
      .map(([label, count]) => ({ label, count: Number(count) || 0 }));
    const grouped = groupLabelsByMetric(entries);

    // Simple hash from doc.id for stable random index
    let hash = 0;
    const seed = doc.id || "";
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
    }

    const result = {};
    for (const m of METER_ORDER) {
      const meterEntries = grouped[m] || [];
      const topEntry = [...meterEntries].sort((a, b) => b.count - a.count)[0];
      const topLabelText = topEntry ? shortenLabel(topEntry.label) : "";
      const vars = { topLabel: topLabelText, count: String(topEntry?.count || 0) };

      const sArr = COMMENT_BANK[m].strength;
      const wArr = COMMENT_BANK[m].weakness;
      const nArr = COMMENT_BANK[m].nextStep;

      result[m] = {
        strength: fillTemplate(sArr[hash % sArr.length], vars),
        weakness: fillTemplate(wArr[(hash >>> 3) % wArr.length], vars),
        nextStep: fillTemplate(nArr[(hash >>> 6) % nArr.length], vars),
      };

      // Shift hash so each meter gets a different pick
      hash = (hash * 17 + 7) & 0x7fffffff;
    }
    return result;
  }, [doc?.id, doc?.labelCounts]);

  // Initialize an empty comment shell so the card renders (no auto-generated text)
  useEffect(() => {
    if (comment || !doc) return;
    onCommentChange({ paragraph: "", score: null, includeInDownload: true });
  }, [doc, comment, onCommentChange]);

  // Focus score input when editing starts
  useEffect(() => {
    if (editingScore && scoreInputRef.current) {
      scoreInputRef.current.focus();
      scoreInputRef.current.select();
    }
  }, [editingScore]);

  // Focus chip input when editing starts
  useEffect(() => {
    if (editingChip && chipInputRef.current) {
      chipInputRef.current.focus();
      chipInputRef.current.select();
    }
  }, [editingChip]);

  const handleParagraphChange = useCallback(
    (value) => {
      const c = commentRef.current;
      if (!c) return;
      onCommentChange({ ...c, paragraph: value });
    },
    [onCommentChange]
  );

  const handleStudentNameChange = useCallback(
    (e) => {
      if (onStudentNameChange) onStudentNameChange(e.target.value);
    },
    [onStudentNameChange]
  );

  const handleScoreClick = useCallback(() => {
    setScoreInput(String(comment?.score ?? ""));
    setEditingScore(true);
  }, [comment]);

  const handleScoreCommit = useCallback(() => {
    setEditingScore(false);
    const parsed = parseInt(scoreInput, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onScoreChange(parsed);
    }
  }, [scoreInput, onScoreChange]);

  const handleScoreKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") handleScoreCommit();
      if (e.key === "Escape") setEditingScore(false);
    },
    [handleScoreCommit]
  );

  // ── Score format toggle ──
  const toggleFormat = useCallback((fmt) => {
    if (!comment) return;
    const next = { ...scoreFormats, [fmt]: !scoreFormats[fmt] };
    onCommentChange({ ...comment, scoreFormats: next });
  }, [comment, scoreFormats, onCommentChange]);

  // ── Chip editing ──
  const startChipEdit = useCallback((type, key, currentValue) => {
    setEditingChip({ type, key });
    setChipInput(String(currentValue));
  }, []);

  // Recompute % score from meter values (same sqrt-curve formula as computeRecommendedScore)
  const recalcScoreFromMeters = useCallback((meters) => {
    const hideCohesion = mode === "peel_paragraph";
    const scores = METER_ORDER
      .filter((m) => !(hideCohesion && m === "cohesion"))
      .map((m) => meters[m]);
    if (!scores.length) return null;
    const rawAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
    const words = doc?.wordCount || 0;
    const lengthPenalty = words > 0 && words < 400
      ? Math.round((400 - words) * 0.03)
      : 0;
    const rawScore = Math.max(0, rawAverage - lengthPenalty);
    return Math.round(Math.sqrt(rawScore / 100) * 100);
  }, [mode, doc?.wordCount]);

  const commitChipEdit = useCallback(() => {
    if (!editingChip || !comment) { setEditingChip(null); return; }
    const parsed = parseInt(chipInput, 10);
    setEditingChip(null);

    if (editingChip.type === "meter") {
      if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
      const nextOverrides = { ...meterOverrides, [editingChip.key]: parsed };
      // Recalculate overall % from updated effective meters
      const nextMeters = {};
      for (const m of METER_ORDER) {
        nextMeters[m] = nextOverrides[m] ?? Math.round(metrics?.[m]?.score ?? 0);
      }
      const newScore = recalcScoreFromMeters(nextMeters);
      onCommentChange({ ...comment, meterOverrides: nextOverrides, score: newScore });
    } else if (editingChip.type === "ib") {
      if (isNaN(parsed) || parsed < 0 || parsed > 5) return;
      const next = { ...ibOverrides, [editingChip.key]: parsed };
      onCommentChange({ ...comment, ibOverrides: next });
    } else if (editingChip.type === "pctTotal") {
      if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
      onScoreChange(parsed);
    }
  }, [editingChip, chipInput, comment, meterOverrides, ibOverrides, metrics, onCommentChange, onScoreChange, recalcScoreFromMeters]);

  const handleChipKeyDown = useCallback((e) => {
    if (e.key === "Enter") commitChipEdit();
    if (e.key === "Escape") setEditingChip(null);
  }, [commitChipEdit]);

  // ── Copy (respects format selections) ──
  const handleCopy = useCallback(() => {
    if (!comment) return;
    const lines = [];
    if (scoreFormats.percent && comment.score != null) {
      lines.push(`Score: ${comment.score}%`);
    }
    if (scoreFormats.ib && effectiveIB) {
      lines.push(`IB Paper 1: ${effectiveIB.total}/20 (A:${effectiveIB.a} B:${effectiveIB.b} C:${effectiveIB.c} D:${effectiveIB.d})`);
    }
    if (lines.length > 0) lines.push("");
    if (comment.paragraph) lines.push(comment.paragraph);
    navigator.clipboard.writeText(lines.join("\n").trim()).then(() => {
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 2000);
    });
  }, [comment, scoreFormats, effectiveIB]);

  // ── Insert snippet into comment paragraph ──
  const handleInsertSnippet = useCallback((text) => {
    const c = commentRef.current;
    if (!c || !text) return;
    const current = c.paragraph || "";
    const separator = current.trim() ? " " : "";
    onCommentChange({ ...c, paragraph: current.trim() + separator + text });
    setActiveSnippetMeter(null);
  }, [onCommentChange]);

  if (!doc || !comment) return null;

  const isEditingPctTotal = editingChip?.type === "pctTotal";

  return (
    <section className="card teacher-comment-notebook">
      <div className="cn-header">
        <h3 className="cn-title">Comment</h3>
      </div>

      {/* Student context (previous essay data) */}
      <StudentContextPanel doc={doc} studentContext={studentContext} />

      {/* Student name + Score row */}
      <div className="cn-top-row">
        <div className="cn-name-field">
          <label className="cn-name-label" htmlFor="cn-student-name">Student</label>
          <input
            id="cn-student-name"
            type="text"
            className="cn-name-input"
            value={doc.studentName || ""}
            onChange={handleStudentNameChange}
            placeholder="Student name"
          />
        </div>

        <div className="cn-score-field">
          {editingScore ? (
            <input
              ref={scoreInputRef}
              type="number"
              name="teacher-score"
              className="cn-score-input"
              min={0}
              max={100}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              onBlur={handleScoreCommit}
              onKeyDown={handleScoreKeyDown}
            />
          ) : (
            <button
              type="button"
              className="cn-score-badge"
              onClick={handleScoreClick}
              title="Click to edit score"
            >
              {comment.score != null ? `${comment.score}%` : "\u2014"}
            </button>
          )}
          <span className="cn-score-label">Score</span>
        </div>
      </div>

      {/* Editable paragraph */}
      <div className="cn-paragraph-wrap">
        <AutoTextarea
          value={comment.paragraph || ""}
          onChange={handleParagraphChange}
          placeholder="Write your comment here..."
          className="cn-textarea cn-paragraph"
          maxLength={MAX_COMMENT_CHARS}
        />
      </div>

      {/* ── Teacher notes (private, not included in download) ── */}
      <div className="cn-notes-section">
        <label className="cn-notes-label" htmlFor="cn-notes">Notes <span className="cn-notes-hint">(private — not included in download)</span></label>
        <textarea
          id="cn-notes"
          className="cn-textarea cn-notes-input"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Private notes about this student or essay..."
          rows={2}
          maxLength={1000}
        />
      </div>

      {/* ── Quick snippet buttons ── */}
      <div className="cn-snippets">
        <span className="cn-snippets-label">Insert snippet</span>
        <div className="cn-snippets-row">
          {METER_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              className={`cn-snippet-btn cn-snippet-btn--${m}${activeSnippetMeter === m ? " cn-snippet-btn--active" : ""}`}
              onClick={() => setActiveSnippetMeter(activeSnippetMeter === m ? null : m)}
            >
              {METER_LABELS[m]}
            </button>
          ))}
        </div>
        {activeSnippetMeter && (
          <div className="cn-snippet-options">
            {/* ── Saved teacher snippets ── */}
            {(savedSnippets[activeSnippetMeter] || []).map((s) => (
              <div key={s.id} className="cn-snippet-option cn-snippet-option--saved">
                {editingSnippetId === s.id ? (
                  <div className="cn-snippet-edit-row">
                    <input
                      ref={editSnippetRef}
                      type="text"
                      className="cn-snippet-edit-input"
                      value={editSnippetText}
                      onChange={(e) => setEditSnippetText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateSnippet(s.id, activeSnippetMeter);
                        if (e.key === "Escape") { setEditingSnippetId(null); setEditSnippetText(""); }
                      }}
                      onBlur={() => updateSnippet(s.id, activeSnippetMeter)}
                      maxLength={300}
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cn-snippet-option-body"
                      onClick={() => handleInsertSnippet(s.text)}
                    >
                      <span className="cn-snippet-type cn-snippet-type--saved">Saved</span>
                      <span className="cn-snippet-text">{s.text}</span>
                    </button>
                    <button
                      type="button"
                      className="cn-snippet-action-btn"
                      title="Edit"
                      onClick={(e) => { e.stopPropagation(); setEditingSnippetId(s.id); setEditSnippetText(s.text); }}
                    >&#9998;</button>
                    <button
                      type="button"
                      className="cn-snippet-action-btn cn-snippet-action-btn--delete"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); deleteSnippet(s.id, activeSnippetMeter); }}
                    >&times;</button>
                  </>
                )}
              </div>
            ))}

            {/* ── Add new snippet ── */}
            {addingSnippet === activeSnippetMeter ? (
              <div className="cn-snippet-add-row">
                <input
                  ref={newSnippetRef}
                  type="text"
                  className="cn-snippet-edit-input"
                  placeholder="Type your snippet..."
                  value={newSnippetText}
                  onChange={(e) => setNewSnippetText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNewSnippet(activeSnippetMeter);
                    if (e.key === "Escape") { setAddingSnippet(null); setNewSnippetText(""); }
                  }}
                  onBlur={() => saveNewSnippet(activeSnippetMeter)}
                  maxLength={300}
                />
              </div>
            ) : (savedSnippets[activeSnippetMeter] || []).length < MAX_SAVED_PER_METRIC && (
              <button
                type="button"
                className="cn-snippet-add-btn"
                onClick={() => { setAddingSnippet(activeSnippetMeter); setNewSnippetText(""); }}
              >
                + Save a snippet
              </button>
            )}

            {/* ── Divider if both saved and built-in exist ── */}
            {(savedSnippets[activeSnippetMeter] || []).length > 0 && snippets[activeSnippetMeter] && (
              <div className="cn-snippet-divider">
                <span>Suggestions</span>
              </div>
            )}

            {/* ── Built-in snippets ── */}
            {snippets[activeSnippetMeter] && (
              <>
                <button
                  type="button"
                  className="cn-snippet-option"
                  onClick={() => handleInsertSnippet(snippets[activeSnippetMeter].strength)}
                >
                  <span className="cn-snippet-type cn-snippet-type--strength">Strength</span>
                  <span className="cn-snippet-text">{snippets[activeSnippetMeter].strength}</span>
                </button>
                <button
                  type="button"
                  className="cn-snippet-option"
                  onClick={() => handleInsertSnippet(snippets[activeSnippetMeter].weakness)}
                >
                  <span className="cn-snippet-type cn-snippet-type--growth">Growth area</span>
                  <span className="cn-snippet-text">{snippets[activeSnippetMeter].weakness}</span>
                </button>
                <button
                  type="button"
                  className="cn-snippet-option"
                  onClick={() => handleInsertSnippet(snippets[activeSnippetMeter].nextStep)}
                >
                  <span className="cn-snippet-type cn-snippet-type--nextstep">Next step</span>
                  <span className="cn-snippet-text">{snippets[activeSnippetMeter].nextStep}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Recommended Scores ── */}
      <div className="cn-scores">
        {/* % Score Card */}
        <div className={`cn-score-card ${scoreFormats.percent ? "cn-score-card--active" : "cn-score-card--inactive"}`}>
          <div className="cn-card-header">
            <span className="cn-card-label">% Score</span>
            <label className="cn-card-toggle" title="Include in download">
              <input
                type="checkbox"
                checked={scoreFormats.percent}
                onChange={() => toggleFormat("percent")}
              />
            </label>
          </div>
          <div
            className="cn-card-score"
            onClick={() => !isEditingPctTotal && startChipEdit("pctTotal", "score", comment.score ?? 0)}
            title="Click to edit"
          >
            {isEditingPctTotal ? (
              <input
                ref={chipInputRef}
                type="number"
                className="cn-chip-input cn-chip-input--lg"
                min={0}
                max={100}
                value={chipInput}
                onChange={(e) => setChipInput(e.target.value)}
                onBlur={commitChipEdit}
                onKeyDown={handleChipKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>{comment.score != null ? `${comment.score}%` : "\u2014"}</>
            )}
          </div>
          <div className="cn-card-chips">
            {METER_ORDER.map((m) => {
              const isEditing = editingChip?.type === "meter" && editingChip?.key === m;
              const val = effectiveMeters[m];
              const isOverridden = meterOverrides[m] != null;
              return isEditing ? (
                <span key={m} className="cn-metric-chip">
                  {METER_LABELS[m]}:
                  <input
                    ref={chipInputRef}
                    type="number"
                    className="cn-chip-input"
                    min={0}
                    max={100}
                    value={chipInput}
                    onChange={(e) => setChipInput(e.target.value)}
                    onBlur={commitChipEdit}
                    onKeyDown={handleChipKeyDown}
                  />
                </span>
              ) : (
                <span
                  key={m}
                  className={`cn-metric-chip${isOverridden ? " cn-metric-chip--edited" : ""}`}
                  onClick={() => startChipEdit("meter", m, val)}
                  title={`${METER_TOOLTIPS[m]} — click to edit`}
                >
                  {METER_LABELS[m]}:{val}
                </span>
              );
            })}
          </div>
        </div>

        {/* IB Paper 1 Card */}
        {effectiveIB && (
          <div className={`cn-score-card ${scoreFormats.ib ? "cn-score-card--active" : "cn-score-card--inactive"}`}>
            <div className="cn-card-header">
              <span className="cn-card-label">IB Paper 1</span>
              <label className="cn-card-toggle" title="Include in download">
                <input
                  type="checkbox"
                  checked={scoreFormats.ib}
                  onChange={() => toggleFormat("ib")}
                />
              </label>
            </div>
            <div className="cn-card-score">
              {effectiveIB.total}<span className="cn-ib-of">/20</span>
            </div>
            <div className="cn-card-chips">
              {["a", "b", "c", "d"].map((key) => {
                const isEditing = editingChip?.type === "ib" && editingChip?.key === key;
                const val = effectiveIB[key];
                const isOverridden = ibOverrides[key] != null;
                const cls = val >= 4 ? "cn-ib-strong" : val >= 2 ? "cn-ib-developing" : "cn-ib-weak";
                return isEditing ? (
                  <span key={key} className={`cn-metric-chip ${cls}`}>
                    {key.toUpperCase()}:
                    <input
                      ref={chipInputRef}
                      type="number"
                      className="cn-chip-input"
                      min={0}
                      max={5}
                      value={chipInput}
                      onChange={(e) => setChipInput(e.target.value)}
                      onBlur={commitChipEdit}
                      onKeyDown={handleChipKeyDown}
                    />
                  </span>
                ) : (
                  <span
                    key={key}
                    className={`cn-metric-chip ${cls}${isOverridden ? " cn-metric-chip--edited" : ""}`}
                    onClick={() => startChipEdit("ib", key, val)}
                    title={`${IB_TOOLTIPS[key]} — click to edit`}
                  >
                    {key.toUpperCase()}:{val}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* IB examiner comments (shown when IB card is active) */}
      {scoreFormats.ib && ibComments.length > 0 && (
        <ul className="cn-ib-notes">
          {ibComments.map((c, i) => (
            <li key={i} className="cn-ib-note">{c.text}</li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="cn-actions">
        <div className="cn-toggles-col">
          <label className="cn-download-toggle">
            <input
              type="checkbox"
              name="include-in-download"
              checked={comment.includeInDownload !== false}
              onChange={onToggleDownload}
            />
            <span>Include in download</span>
          </label>
          <label className="cn-download-toggle">
            <input
              type="checkbox"
              name="include-details-in-download"
              checked={Boolean(comment.includeDetailsInDownload)}
              onChange={onToggleDetailsDownload}
            />
            <span>Include detailed issues list</span>
          </label>
        </div>
        <button
          type="button"
          className="cn-copy-btn"
          onClick={handleCopy}
        >
          {copyFlash ? "Copied" : "Copy comment"}
        </button>
      </div>
    </section>
  );
}
