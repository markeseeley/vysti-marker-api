import { useEffect, useMemo, useRef, useState } from "react";
import { extractPreviewText } from "@shared/previewText";
import { getConfig } from "../config";
import {
  fetchIssueExamples,
  fetchLatestMarkEvent
} from "../services/revisionPractice";
import StatsPanel from "./StatsPanel";

const getWordCount = (text) => {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : null;
};

export default function RevisionPracticePanel({
  enabled,
  practiceNavEnabled = false,
  practiceHighlightEnabled = false,
  externalAttempt = null,
  onClearExternalAttempt,
  supa,
  selectedFile,
  markedBlob,
  previewRef,
  techniques,
  onOpenDiagnostics,
  onNavigateToExample,
  onHighlightExamples,
  onClearHighlights
}) {
  const [loading, setLoading] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [error, setError] = useState("");
  const [labelCounts, setLabelCounts] = useState({});
  const [topLabels, setTopLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [examples, setExamples] = useState([]);
  const [lastMarkEventId, setLastMarkEventId] = useState(null);
  const [wordCount, setWordCount] = useState(null);
  const [userId, setUserId] = useState("");
  const [noData, setNoData] = useState(false);
  const wordCountTimerRef = useRef(0);
  const lastExtractedRef = useRef("");

  const debugEnabled = Boolean(getConfig()?.featureFlags?.debugRevisionPractice);

  const totalIssues = useMemo(() => {
    return Object.values(labelCounts || {}).reduce(
      (sum, count) => sum + (Number(count) || 0),
      0
    );
  }, [labelCounts]);

  const topIssue = topLabels.length
    ? `${topLabels[0].label} (${topLabels[0].count})`
    : "";

  useEffect(() => {
    if (!enabled) return undefined;
    const container = previewRef?.current;
    if (!container) return undefined;

    const update = () => {
      window.clearTimeout(wordCountTimerRef.current);
      wordCountTimerRef.current = window.setTimeout(() => {
        const text = extractPreviewText(container);
        if (text === lastExtractedRef.current) return;
        lastExtractedRef.current = text;
        setWordCount(getWordCount(text));
      }, 900);
    };

    update();
    container.addEventListener("input", update);
    container.addEventListener("paste", update);
    return () => {
      container.removeEventListener("input", update);
      container.removeEventListener("paste", update);
      window.clearTimeout(wordCountTimerRef.current);
    };
  }, [enabled, markedBlob, previewRef]);

  useEffect(() => {
    if (!enabled) return;
    if (externalAttempt) {
      const counts = externalAttempt.labelCounts || {};
      const entries = Object.entries(counts)
        .map(([label, count]) => ({ label, count: Number(count) || 0 }))
        .filter((entry) => entry.label && entry.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 10);

      setLabelCounts(counts);
      setTopLabels(entries);
      setLastMarkEventId(externalAttempt.id || null);
      setSelectedLabel((prev) => {
        if (prev && entries.some((entry) => entry.label === prev)) return prev;
        return entries[0]?.label || "";
      });
      setNoData(false);
      setError("");
      setLoading(false);
      return;
    }
    if (!supa || !selectedFile || !markedBlob) {
      setError("");
      setNoData(false);
      setLabelCounts({});
      setTopLabels([]);
      setSelectedLabel("");
      setExamples([]);
      setLastMarkEventId(null);
      return;
    }

    let isActive = true;
    const loadMarkEvent = async () => {
      setLoading(true);
      setError("");
      setNoData(false);
      try {
        const { data, error: sessionError } = await supa.auth.getSession();
        if (sessionError || !data?.session) {
          throw new Error("Session expired. Please sign in again.");
        }

        const currentUserId = data.session.user?.id;
        if (!currentUserId) {
          throw new Error("Missing user session.");
        }

        const { markEvent, labelCountsFiltered } = await fetchLatestMarkEvent({
          supa,
          userId: currentUserId,
          fileName: selectedFile.name
        });

        if (debugEnabled) {
          console.log("[revision-practice] mark event", {
            hasEvent: Boolean(markEvent),
            labelCountKeys: Object.keys(labelCountsFiltered || {}).length
          });
        }

        if (!isActive) return;

        if (!markEvent) {
          setNoData(true);
          setLabelCounts({});
          setTopLabels([]);
          setSelectedLabel("");
          setExamples([]);
          setLastMarkEventId(null);
          setUserId(currentUserId);
          return;
        }

        const entries = Object.entries(labelCountsFiltered || {})
          .map(([label, count]) => ({ label, count: Number(count) || 0 }))
          .filter((entry) => entry.label && entry.count > 0)
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .slice(0, 10);

        setLabelCounts(labelCountsFiltered || {});
        setTopLabels(entries);
        setLastMarkEventId(markEvent.id || null);
        setUserId(currentUserId);
        setSelectedLabel((prev) => {
          if (prev && entries.some((entry) => entry.label === prev)) return prev;
          return entries[0]?.label || "";
        });
      } catch (err) {
        if (!isActive) return;
        setError(err?.message || "Failed to load revision data.");
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadMarkEvent();
    return () => {
      isActive = false;
    };
  }, [enabled, markedBlob, selectedFile, supa, debugEnabled, externalAttempt]);

  useEffect(() => {
    if (!enabled || !selectedLabel || !supa || !selectedFile) {
      setExamples([]);
      return;
    }

    let isActive = true;
    const loadExamples = async () => {
      setExamplesLoading(true);
      setError("");
      try {
        let currentUserId = userId;
        if (!currentUserId) {
          const { data, error: sessionError } = await supa.auth.getSession();
          if (sessionError || !data?.session?.user?.id) {
            throw new Error("Session expired. Please sign in again.");
          }
          if (!isActive) return;
          currentUserId = data.session.user.id;
          setUserId(currentUserId);
        }

        const exampleRows = await fetchIssueExamples({
          supa,
          userId: currentUserId,
          fileName: selectedFile.name,
          label: selectedLabel,
          markEventId: lastMarkEventId
        });

        if (debugEnabled) {
          console.log("[revision-practice] examples", {
            label: selectedLabel,
            count: exampleRows.length
          });
        }

        if (!isActive) return;
        setExamples(exampleRows);
      } catch (err) {
        if (!isActive) return;
        setError(err?.message || "Failed to load examples.");
      } finally {
        if (isActive) setExamplesLoading(false);
      }
    };

    loadExamples();
    return () => {
      isActive = false;
    };
  }, [
    enabled,
    selectedLabel,
    supa,
    selectedFile,
    lastMarkEventId,
    userId,
    debugEnabled
  ]);

  const handleCopy = async (sentence) => {
    if (!sentence) return;
    try {
      await navigator.clipboard.writeText(sentence);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  };

  const renderSentenceText = (sentence) => {
    const raw = String(sentence || "");
    if (raw.length <= 140) return raw;
    return `${raw.slice(0, 140)}…`;
  };

  if (!enabled) return null;

  return (
    <section className="card practice-card">
      <div className="practice-header">
        <h2>Revision practice</h2>
        {onOpenDiagnostics ? (
          <button
            type="button"
            className="diagnostics-link"
            onClick={onOpenDiagnostics}
          >
            Diagnostics
          </button>
        ) : null}
      </div>

      {!selectedFile || !markedBlob ? (
        <p className="helper-text">Mark an essay to unlock revision practice.</p>
      ) : null}

      {error ? <p className="helper-text error-text">{error}</p> : null}

      {loading ? <p className="helper-text">Loading revision data…</p> : null}

      {externalAttempt ? (
        <div className="helper-text practice-note">
          Viewing attempt from{" "}
          {externalAttempt?.createdAt
            ? new Date(externalAttempt.createdAt).toLocaleString()
            : "earlier"}{" "}
          —{" "}
          <button
            type="button"
            className="diagnostics-link"
            onClick={() => onClearExternalAttempt?.()}
          >
            Back to latest
          </button>
        </div>
      ) : null}

      {noData && !loading ? (
        <p className="helper-text">No revision data yet (mark again).</p>
      ) : null}

      {selectedFile && markedBlob && !loading ? (
        <div className="practice-grid">
          <StatsPanel
            wordCount={wordCount}
            totalIssues={totalIssues}
            topIssue={topIssue}
            techniques={techniques}
          />

          <div className="practice-issues">
            <h3>Most common issues</h3>
            <div className="issue-list">
              {topLabels.length ? (
                topLabels.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    className={`issue-chip${
                      selectedLabel === entry.label ? " is-active" : ""
                    }`}
                    onClick={() => setSelectedLabel(entry.label)}
                  >
                    {entry.label} ({entry.count})
                  </button>
                ))
              ) : (
                <p className="helper-text">No issues to show yet.</p>
              )}
            </div>

            <div className="examples-panel">
              <h4>{selectedLabel || "Examples"}</h4>
              {practiceHighlightEnabled && examples.length ? (
                <div className="practice-action-row">
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => onHighlightExamples?.(examples)}
                  >
                    Highlight examples
                  </button>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => onClearHighlights?.()}
                  >
                    Clear highlights
                  </button>
                </div>
              ) : null}
              {examplesLoading ? (
                <p className="helper-text">Loading examples…</p>
              ) : examples.length ? (
                examples.map((ex, idx) => (
                  <div className="example-row" key={`${ex.paragraph_index}-${idx}`}>
                    <div className="example-meta">
                      <span>Paragraph {ex.paragraph_index ?? 0}</span>
                    </div>
                    {practiceNavEnabled ? (
                      <button
                        type="button"
                        className="example-jump"
                        onClick={() => onNavigateToExample?.(ex.sentence)}
                        title={ex.sentence || ""}
                      >
                        {renderSentenceText(ex.sentence)}
                      </button>
                    ) : (
                      <p>{renderSentenceText(ex.sentence)}</p>
                    )}
                    <button
                      className="secondary-btn copy-btn"
                      type="button"
                      onClick={() => handleCopy(ex.sentence)}
                    >
                      Copy sentence
                    </button>
                  </div>
                ))
              ) : (
                <p className="helper-text">No examples saved for this issue yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
