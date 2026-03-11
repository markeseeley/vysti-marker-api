import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { extractPreviewTextFromContainer } from "../lib/previewText";
import { getConfig } from "../config";
import {
  fetchIssueExamples,
  fetchIssueExamplesIndex,
  fetchLatestMarkEvent
} from "../services/revisionPractice";
import DismissIssueModal from "./DismissIssueModal";
import { normalizeForCompare, normalizeLabelTrim } from "../lib/normalize";
import { applyRewriteToPreview } from "../lib/applyRewriteToPreview";
import {
  applyDismissalsToLabelCounts,
  filterDismissedExamples,
  loadDismissNoAsk,
  loadDismissedIssuesFromStorage,
  saveDismissNoAsk,
  saveDismissedIssuesToStorage
} from "../lib/dismissIssues";
import { removeIssueLabelAndHighlight } from "../lib/previewDismissals";
import PowerVerbsHelper from "./PowerVerbsHelper";
import { POWER_VERBS_LABEL } from "../lib/powerVerbs";
import { isPreviewOnlyLabel } from "../lib/previewOnlyLabels";
import { checkRevision } from "../services/revisionCheck";
import {
  clearRevisionPracticeState,
  loadRevisionPracticeState,
  saveRevisionPracticeState
} from "../lib/revisionPracticeStorage";

/**
 * Resolve dynamic placeholders in student guidance text
 * Supports: {FOUND}, {THESIS}, {TOPIC_1}, {TOPIC_2}, {TOPIC_3}, {ORIGINAL}, {COUNT}
 * @param {string} template - The guidance template with placeholders
 * @param {object} example - The example object containing contextual data
 * @param {string} labelText - The issue label
 * @returns {string} - Resolved guidance text
 */
const resolveStudentGuidance = (template, example = {}, labelText = "") => {
  let resolved = String(template || "");
  if (!resolved) return "";

  // Extract contextual data from example (provided by backend)
  const foundValue = example?.found_value || example?.foundValue;
  const thesis = example?.thesis;
  const topics = example?.topics || [];
  const confidence = example?.confidence || "high";
  const originalPhrase = example?.original_phrase || example?.originalPhrase;


  // Replace {FOUND} with the extracted value
  // Handle both <strong>{FOUND}</strong> and plain {FOUND}
  if (foundValue) {
    resolved = resolved.replace(/<strong>\{FOUND\}<\/strong>/g, `<strong>"${foundValue}"</strong>`);
    resolved = resolved.replace(/\{FOUND\}/g, `"${foundValue}"`);
  } else if (resolved.includes("{FOUND}")) {
    // Fallback if backend didn't provide a value - preserve <strong> tags
    resolved = resolved.replace(/<strong>\{FOUND\}<\/strong>/g, "<strong>that word/phrase</strong>");
    resolved = resolved.replace(/\{FOUND\}/g, "that word/phrase");
  }

  // Replace {THESIS} with the full thesis
  if (thesis) {
    resolved = resolved.replace(/{THESIS}/g, `"${thesis}"`);
  }

  // Replace {TOPIC_1}, {TOPIC_2}, {TOPIC_3} with thesis topics
  topics.forEach((topic, index) => {
    const placeholder = new RegExp(`\\{TOPIC_${index + 1}\\}`, "g");
    resolved = resolved.replace(placeholder, `"${topic}"`);
  });

  // Replace {ORIGINAL} with the flagged word/phrase
  if (originalPhrase) {
    resolved = resolved.replace(/{ORIGINAL}/g, `"${originalPhrase}"`);
  }

  // Replace {COUNT} with the repetition count
  const countValue = example?.count;
  if (countValue) {
    resolved = resolved.replace(/\{COUNT\}/g, String(countValue));
  } else if (resolved.includes("{COUNT}")) {
    resolved = resolved.replace(/\{COUNT\}/g, "several");
  }

  // Adjust phrasing based on confidence level
  if (confidence === "low" || confidence === "medium") {
    resolved = resolved.replace(/\bIt seems that\b/gi, "It's possible that");
  }

  return resolved;
};

const getExampleKey = (label, example) => {
  const sentence = String(example?.sentence || "").trim();
  const para = example?.paragraph_index ?? 0;
  return `${label}::${para}::${sentence}`;
};

const getLabelHints = (label) => {
  const normalized = normalizeLabelTrim(label);
  return {
    isIntro:
      normalized.includes("title") ||
      normalized.includes("introduction") ||
      normalized.includes("thesis") ||
      normalized.includes("first sentence"),
    isConclusion: normalized.includes("conclusion")
  };
};

const getDominantParagraphIndex = (indices) => {
  if (!indices.length) return null;
  const counts = indices.reduce((acc, idx) => {
    const key = Number.isFinite(idx) ? idx : 0;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => Number(key))
    .find((num) => Number.isFinite(num));
};

export default function RevisionPracticePanel({
  enabled,
  requestActive = false,
  practiceNavEnabled = false,
  practiceHighlightEnabled = false,
  externalAttempt = null,
  onClearExternalAttempt,
  supa,
  selectedFile,
  markedBlob,
  previewRef,
  dismissedIssues: dismissedIssuesProp,
  onDismissedIssuesChange,
  selectedLabelOverride,
  onSelectedLabelChange,

  onNavigateToExample,
  onHighlightExamples,
  onClearHighlights,
  mode,
  onPreviewEdited,
  onOpenPowerVerbs,
  onCheckRewriteResult,
  onApplyToPreview
}) {
  const [loading, setLoading] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [error, setError] = useState("");
  const [labelCounts, setLabelCounts] = useState({});
  const [labelCountsRaw, setLabelCountsRaw] = useState({});
  const [topLabels, setTopLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [examples, setExamples] = useState([]);
  const [issues, setIssues] = useState([]);
  const [issueExampleIndex, setIssueExampleIndex] = useState([]);
  const [lastMarkEventId, setLastMarkEventId] = useState(null);
  const [userId, setUserId] = useState("");
  const [noData, setNoData] = useState(false);
  const [draftByKey, setDraftByKey] = useState({});
  const [approvedByKey, setApprovedByKey] = useState({});
  const [appliedKeys, setAppliedKeys] = useState({});
  const [approvedPanelOpen, setApprovedPanelOpen] = useState(false);
  const [exampleStatus, setExampleStatus] = useState({});
  const [editingApprovedKeys, setEditingApprovedKeys] = useState({});
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [pendingDismiss, setPendingDismiss] = useState(null);
  const [dismissMessage, setDismissMessage] = useState("");
  const [examplesEmptyMessage, setExamplesEmptyMessage] = useState("");
  const [localDismissedIssues, setLocalDismissedIssues] = useState([]);
  const lastMarkEventRef = useRef(null);
  const textareaRefs = useRef({});
  const [exampleNavIndex, setExampleNavIndex] = useState(0);

  const debugEnabled = Boolean(getConfig()?.featureFlags?.debugRevisionPractice);
  const dismissedIssues = dismissedIssuesProp ?? localDismissedIssues;
  const updateDismissedIssues = (next) => {
    if (typeof onDismissedIssuesChange === "function") {
      onDismissedIssuesChange(next);
    } else {
      setLocalDismissedIssues(next);
    }
  };

  const showPowerVerbsHelper = useMemo(() => {
    const normalized = normalizeLabelTrim(selectedLabel);
    return (
      normalized === normalizeLabelTrim(POWER_VERBS_LABEL) ||
      normalized.includes("power verbs")
    );
  }, [selectedLabel]);

  const previewOnly = useMemo(() => isPreviewOnlyLabel(selectedLabel), [selectedLabel]);

  // All approved rewrites across all labels (matches student.html behavior)
  const approvedList = useMemo(() => {
    return Object.entries(approvedByKey)
      .map(([key, entry]) => ({ key, ...entry }));
  }, [approvedByKey]);

  const applyStateSnapshot = (snapshot) => {
    if (!snapshot) return;
    // Don't restore drafts - they should start fresh each session
    // setDraftByKey(snapshot.drafts || {});
    setApprovedByKey(snapshot.approved || {});
    setAppliedKeys(snapshot.applied || {});
    setApprovedPanelOpen(Boolean(snapshot.approvedPanelOpen));
    if (snapshot.selectedLabel) {
      setSelectedLabel(snapshot.selectedLabel);
    }
  };

  useEffect(() => {
    if (!userId || !selectedFile?.name || !lastMarkEventId) return;
    const snapshot = loadRevisionPracticeState({
      userId,
      fileName: selectedFile.name
    });

    // Only restore if the stored markEventId matches the current one
    // This prevents restoring stale data from a previous mark of the same file
    if (snapshot && snapshot.markEventId === lastMarkEventId) {
      applyStateSnapshot(snapshot);
    } else if (snapshot && snapshot.markEventId !== lastMarkEventId) {
      clearRevisionPracticeState({ userId, fileName: selectedFile.name });
    }
  }, [userId, selectedFile?.name, lastMarkEventId]);

  useEffect(() => {
    if (!userId || !selectedFile?.name) return;
    saveRevisionPracticeState({
      userId,
      fileName: selectedFile.name,
      state: {
        // Don't persist drafts - they should only exist in current session
        // drafts: draftByKey,
        approved: approvedByKey,
        applied: appliedKeys,
        approvedPanelOpen,
        selectedLabel,
        markEventId: lastMarkEventId
      }
    });
  }, [
    approvedByKey,
    appliedKeys,
    approvedPanelOpen,
    // draftByKey, // Removed from dependencies since we're not saving it
    selectedFile,
    selectedLabel,
    lastMarkEventId,
    userId
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (externalAttempt) {
      const counts = externalAttempt.labelCounts || {};
      const entries = Object.entries(counts)
        .map(([label, count]) => ({ label, count: Number(count) || 0 }))
        .filter((entry) => entry.label && entry.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 10);

      const storedDismissed = loadDismissedIssuesFromStorage({
        markEventId: externalAttempt.id || null,
        fileName: selectedFile?.name || ""
      });
      updateDismissedIssues(storedDismissed);
      setLabelCountsRaw(counts);
      setLabelCounts(
        applyDismissalsToLabelCounts(
          counts,
          storedDismissed,
          selectedFile?.name || ""
        )
      );
      setTopLabels(entries);
      setLastMarkEventId(externalAttempt.id || null);
      setIssues(externalAttempt.issues || []);
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
      setIssues([]);
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

        const { markEvent, labelCountsFiltered, issuesFiltered } =
          await fetchLatestMarkEvent({
            supa,
            userId: currentUserId,
            fileName: selectedFile.name
          });

        if (!isActive) return;

        if (!markEvent) {
          setNoData(true);
          setLabelCounts({});
          setLabelCountsRaw({});
          setTopLabels([]);
          setSelectedLabel("");
          setExamples([]);
          setLastMarkEventId(null);
          setUserId(currentUserId);
          setIssues([]);
          setIssueExampleIndex([]);
          updateDismissedIssues([]);
          return;
        }

        const storedDismissed = loadDismissedIssuesFromStorage({
          markEventId: markEvent.id || null,
          fileName: selectedFile.name
        });
        updateDismissedIssues(storedDismissed);
        setLabelCountsRaw(labelCountsFiltered || {});
        setLabelCounts(
          applyDismissalsToLabelCounts(
            labelCountsFiltered || {},
            storedDismissed,
            selectedFile.name
          )
        );
        setLastMarkEventId(markEvent.id || null);
        setUserId(currentUserId);
        setIssues(issuesFiltered || []);
        setSelectedLabel((prev) => prev || "");
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
    if (!enabled || !supa || !selectedFile || !userId || !lastMarkEventId) return;
    let isActive = true;
    const loadIndex = async () => {
      try {
        const rows = await fetchIssueExamplesIndex({
          supa,
          userId,
          fileName: selectedFile.name,
          markEventId: lastMarkEventId
        });
        if (!isActive) return;
        setIssueExampleIndex(rows);
      } catch (err) {
        if (!isActive) return;
        if (debugEnabled) {
          console.warn("[revision-practice] index fetch failed", err);
        }
        setIssueExampleIndex([]);
      }
    };
    loadIndex();
    return () => {
      isActive = false;
    };
  }, [enabled, supa, selectedFile, userId, lastMarkEventId, debugEnabled]);

  useEffect(() => {
    if (!selectedLabelOverride) return;
    const normalizedOverride = normalizeLabelTrim(selectedLabelOverride);
    if (!normalizedOverride) return;
    const match = Object.keys(labelCounts || {}).find(
      (label) => normalizeLabelTrim(label) === normalizedOverride
    );
    // Always honour the override — use the exact match from labelCounts if
    // available, otherwise fall back to the raw override string so the panel
    // still navigates even when the label isn't in the stored label_counts.
    setSelectedLabel(match || selectedLabelOverride);
  }, [selectedLabelOverride, labelCounts]);

  useEffect(() => {
    setExamplesEmptyMessage("");
  }, [selectedLabel]);

  useEffect(() => {
    if (!selectedFile?.name) return;
    setLabelCounts(
      applyDismissalsToLabelCounts(labelCountsRaw, dismissedIssues, selectedFile.name)
    );
  }, [dismissedIssues, labelCountsRaw, selectedFile?.name]);

  useEffect(() => {
    if (!examples.length) return;
    const filtered = filterDismissedExamples(
      examples,
      dismissedIssues,
      selectedFile?.name || "",
      selectedLabel
    );
    if (filtered.length !== examples.length) {
      setExamples(filtered);
    }
  }, [dismissedIssues, examples, selectedLabel, selectedFile?.name]);

  useEffect(() => {
    if (!dismissMessage) return;
    const timer = window.setTimeout(() => setDismissMessage(""), 2000);
    return () => window.clearTimeout(timer);
  }, [dismissMessage]);

  useEffect(() => {
    if (!dismissModalOpen) return;
    if (requestActive || !enabled || !markedBlob) {
      setDismissModalOpen(false);
      setPendingDismiss(null);
    }
  }, [dismissModalOpen, requestActive, enabled, markedBlob]);

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
          markEventId: lastMarkEventId,
          dismissedIssues
        });

        if (!isActive) return;
        setExamples(exampleRows);
        setExamplesEmptyMessage("");
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
    debugEnabled,
    dismissedIssues
  ]);

  useEffect(() => {
    if (!selectedFile?.name || !userId) return;
    const incoming = lastMarkEventId || null;
    if (!incoming) return;
    if (lastMarkEventRef.current && lastMarkEventRef.current !== incoming) {
      clearRevisionPracticeState({ userId, fileName: selectedFile.name });
      setDraftByKey({});
      setApprovedByKey({});
      setAppliedKeys({});
      setApprovedPanelOpen(false);
      setExampleStatus({});
      setEditingApprovedKeys({});
    }
    lastMarkEventRef.current = incoming;
  }, [lastMarkEventId, selectedFile?.name, userId]);

  const groupedIssues = useMemo(() => {
    const labels = Object.entries(labelCounts || {})
      .map(([label, count]) => ({ label, count: Number(count) || 0 }))
      .filter((entry) => entry.label && entry.count > 0);

    const indexSource = issueExampleIndex.length ? issueExampleIndex : issues;
    const indices = indexSource
      .map((issue) => issue?.paragraph_index)
      .filter(Number.isFinite);
    const introIdx = indices.length ? Math.min(...indices) : null;
    const conclusionIdx = indices.length ? Math.max(...indices) : null;

    const labelIndexMap = labels.reduce((acc, entry) => {
      const matches = indexSource
        .filter((issue) => issue?.label === entry.label)
        .map((issue) => issue?.paragraph_index)
        .filter(Number.isFinite);
      acc[entry.label] = getDominantParagraphIndex(matches);
      return acc;
    }, {});

    const groups = {
      intro: [],
      body: {},
      conclusion: []
    };

    labels.forEach((entry) => {
      const dominant = labelIndexMap[entry.label];
      const hints = getLabelHints(entry.label);
      if ((introIdx !== null && dominant === introIdx) || hints.isIntro) {
        groups.intro.push(entry);
        return;
      }
      if (
        (conclusionIdx !== null && dominant === conclusionIdx) ||
        hints.isConclusion
      ) {
        groups.conclusion.push(entry);
        return;
      }
      const bodyIndex =
        introIdx !== null && dominant !== null ? Math.max(1, dominant - introIdx) : 1;
      if (!groups.body[bodyIndex]) groups.body[bodyIndex] = [];
      groups.body[bodyIndex].push(entry);
    });

    const sortEntries = (list) =>
      list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    groups.intro = sortEntries(groups.intro);
    groups.conclusion = sortEntries(groups.conclusion);
    Object.keys(groups.body).forEach((key) => {
      groups.body[key] = sortEntries(groups.body[key]);
    });

    return { groups, introIdx, conclusionIdx };
  }, [issueExampleIndex, issues, labelCounts]);

  useEffect(() => {
    const entries = Object.entries(labelCounts || {})
      .map(([label, count]) => ({ label, count: Number(count) || 0 }))
      .filter((entry) => entry.label && entry.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 10);
    setTopLabels(entries);
    setSelectedLabel((prev) => {
      if (prev) return prev;
      return entries[0]?.label || "";
    });
  }, [labelCounts]);

  const selectedIssueExplanation = useMemo(() => {
    if (!selectedLabel) return "";
    const issue = issues.find((item) => item?.label === selectedLabel);
    const short = String(issue?.short_explanation || "").trim();
    if (short) return short;
    const full = String(issue?.explanation || "").trim();
    return full;
  }, [issues, selectedLabel]);

  const selectedIssueGuidance = useMemo(() => {
    if (!selectedLabel) return "";
    const issue = issues.find((item) => item?.label === selectedLabel);
    const guidance = String(issue?.student_guidance || "").trim();
    return guidance;
  }, [issues, selectedLabel]);

  const rotationExamples = useMemo(() => {
    return examples.filter((ex) => {
      const key = getExampleKey(selectedLabel, ex);
      if (!key) return false;
      if (appliedKeys[key]) return false;
      return true;
    });
  }, [examples, appliedKeys, selectedLabel]);

  useEffect(() => {
    setExampleNavIndex(0);
  }, [selectedLabel, rotationExamples.length]);

  const handleNextExample = (totalCount) => {
    if (!totalCount) return;
    setExampleNavIndex((prev) => (prev + 1) % totalCount);
  };

  const updateDraft = (key, value) => {
    setDraftByKey((prev) => ({ ...prev, [key]: value }));
  };

  const getDraftValue = (key, example) => {
    if (!key) return String(example?.sentence || "");
    if (draftByKey[key] !== undefined) return draftByKey[key];
    const approved = approvedByKey[key]?.rewrite;
    return approved || String(example?.sentence || "");
  };

  const updateExampleStatus = (key, patch) => {
    setExampleStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...patch }
    }));
  };

  const clearExampleStatus = (key) => {
    setExampleStatus((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearApproved = (key) => {
    setApprovedByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResetExample = (key, example) => {
    const original = String(example?.sentence || "");
    updateDraft(key, original);
    clearApproved(key);
    clearExampleStatus(key);
  };

  const handleCopyRewrite = async (key, example) => {
    const value = String(getDraftValue(key, example) || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  };

  const handleCheckRewrite = async (label, example) => {
    const key = getExampleKey(label, example);
    const rewrite = String(getDraftValue(key, example) || "").trim();
    const original = String(example?.sentence || "").trim();
    if (!rewrite) {
      updateExampleStatus(key, { error: "Enter a rewrite before checking." });
      return;
    }
    const normalizedRewrite = normalizeForCompare(rewrite);
    const normalizedOriginal = normalizeForCompare(original);
    if (normalizedRewrite === normalizedOriginal) {
      updateExampleStatus(key, { error: "Rewrite must be different from the original." });
      clearApproved(key);
      return;
    }
    if (!supa) {
      updateExampleStatus(key, { error: "Supabase is not available." });
      return;
    }

    updateExampleStatus(key, { loading: true });

    try {
      const result = await checkRevision({
        supa,
        label,
        labelTrimmed: normalizeLabelTrim(label),
        rewrite,
        mode,
        originalSentence: original,
        paragraphIndex: example?.paragraph_index ?? 0
      });
      if (result?.approved) {
        updateExampleStatus(key, { approved: true, message: "Approved!", error: "" });
        setApprovedByKey((prev) => ({
          ...prev,
          [key]: {
            label,
            sentence: original,
            paragraph_index: example?.paragraph_index ?? 0,
            rewrite
          }
        }));
        setApprovedPanelOpen(true);
        onCheckRewriteResult?.({ approved: true });
        // Auto-advance to the next example after a brief pause
        const count = rotationExamples.length;
        if (count > 1) {
          setTimeout(() => handleNextExample(count), 2000);
        }
      } else {
        updateExampleStatus(key, {
          approved: false,
          error: result?.message || "Rewrite not approved yet.",
          message: ""
        });
        clearApproved(key);
        onCheckRewriteResult?.({ approved: false });
      }
    } catch (err) {
      console.error("✗ API error:", err);
      updateExampleStatus(key, { error: err?.message || "Check failed.", message: "", approved: false });
      clearApproved(key);
    } finally {
      updateExampleStatus(key, { loading: false });
    }
  };

  const handleApplyRewrite = (entry, { shouldScroll = true } = {}) => {
    const container = previewRef?.current;
    if (!container) {
      updateExampleStatus(entry.key, { error: "Preview not ready." });
      return false;
    }
    const result = applyRewriteToPreview({
      containerEl: container,
      originalSentence: entry.sentence,
      rewrite: entry.rewrite,
      paragraphIndex: entry.paragraph_index ?? undefined,
      shouldScroll
    });
    if (!result.ok) {
      updateExampleStatus(entry.key, { error: result.message });
      return false;
    }
    setAppliedKeys((prev) => ({ ...prev, [entry.key]: true }));
    setApprovedByKey((prev) => {
      const next = { ...prev };
      delete next[entry.key];
      return next;
    });
    setLabelCounts((prev) => {
      const next = { ...prev };
      if (entry.label && Number.isFinite(next[entry.label])) {
        next[entry.label] = Math.max(0, Number(next[entry.label]) - 1);
      }
      return next;
    });
    onPreviewEdited?.();
    onApplyToPreview?.({ label: entry.label });
    updateExampleStatus(entry.key, { message: "Applied to preview." });
    return true;
  };

  const handleApplyAll = () => {
    if (approvedList.length < 2) return;
    let successCount = 0;
    approvedList.forEach((entry, idx) => {
      const ok = handleApplyRewrite(entry, { shouldScroll: idx === approvedList.length - 1 });
      if (ok) successCount += 1;
    });
    if (successCount > 0) {
      setError("");
    }
  };

  const clearExampleState = (key) => {
    setDraftByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setApprovedByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setAppliedKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setExampleStatus((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const performDismiss = async (label, example, result) => {
    if (!selectedFile?.name) return;
    const fileName = selectedFile.name;
    const record = {
      label: label || "",
      sentence: example?.sentence || "",
      paragraph_index: example?.paragraph_index ?? null,
      file_name: fileName,
      created_at: new Date().toISOString(),
      reason: result.reason,
      other_text: result.other_text || null
    };

    const nextDismissed = [...(dismissedIssues || []), record];
    updateDismissedIssues(nextDismissed);
    saveDismissedIssuesToStorage({
      markEventId: lastMarkEventId,
      fileName,
      dismissedIssues: nextDismissed
    });

    if (supa) {
      try {
        const sessionResp = await supa.auth.getSession();
        const uid = sessionResp?.data?.session?.user?.id || userId;
        if (uid) {
          const { error: insertError } = await supa
            .from("dismissed_issue_feedback")
            .insert({
              user_id: uid,
              file_name: fileName,
              mark_event_id: lastMarkEventId || null,
              mode,
              issue_label: label || "",
              paragraph_index: record.paragraph_index,
              sentence: record.sentence,
              reason: result.reason,
              other_text: result.other_text || null
            });
          if (insertError) {
            console.warn("Dismissed issue feedback insert failed:", insertError);
          }
        }
      } catch (err) {
        console.warn("Dismissed issue feedback insert failed:", err);
      }
    }

    const previewResult = removeIssueLabelAndHighlight(label, record, {
      containerEl: previewRef?.current,
      scroll: true,
      allowParagraphFallback: true,
      silent: false
    });
    const key = getExampleKey(label, example);
    if (!previewResult.ok) {
      updateExampleStatus(key, {
        error: previewResult.message || "Preview not available."
      });
      setDismissMessage("");
    } else {
      setDismissMessage(previewResult.message || "Dismissed.");
      onPreviewEdited?.();
    }

    setLabelCounts((prev) => {
      const next = { ...prev };
      const current = Number(next[label] || 0);
      const updated = Math.max(0, current - 1);
      if (updated === 0) delete next[label];
      else next[label] = updated;
      return next;
    });

    updateExampleStatus(key, { message: "Dismissed." });
    setExamples((prev) => {
      const next = prev.filter((ex) => getExampleKey(label, ex) !== key);
      if (!next.length) {
        setExamplesEmptyMessage(
          "No more examples for this issue. Click another bar to practice a different issue."
        );
      }
      return next;
    });
    clearExampleState(key);
  };

  const handleDismissIssue = async (label, example) => {
    const pref = loadDismissNoAsk(label);
    if (pref?.reason) {
      await performDismiss(label, example, {
        reason: pref.reason,
        other_text: pref.other_text || null,
        dontAskAgain: true
      });
      return;
    }
    setPendingDismiss({ label, example });
    setDismissModalOpen(true);
  };

  const handleDownloadNotes = () => {
    if (!selectedLabel) return;
    const rows = examples.map((ex) => {
      const key = getExampleKey(selectedLabel, ex);
      const draft = String(getDraftValue(key, ex) || "").trim();
      const approved = approvedByKey[key]?.rewrite || "";
      const rewriteText = approved || draft || "";
      return {
        original: ex?.sentence || "",
        rewrite: rewriteText
      };
    });
    const lines = [
      `Label: ${selectedLabel}`,
      "",
      ...rows.flatMap((row, idx) => [
        `Example ${idx + 1}:`,
        `Original: ${row.original}`,
        `Rewrite: ${row.rewrite || "(none)"}`,
        ""
      ])
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const filename = `revision_notes_${normalizeLabelTrim(selectedLabel) || "issue"}.txt`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDismissConfirm = async ({ reason, other_text }) => {
    if (!pendingDismiss) return;
    const { label, example } = pendingDismiss;
    setDismissModalOpen(false);
    setPendingDismiss(null);
    await performDismiss(label, example, { reason, other_text, dontAskAgain: false });
  };

  const handleDismissNoAsk = async ({ reason, other_text }) => {
    if (!pendingDismiss) return;
    const { label, example } = pendingDismiss;
    saveDismissNoAsk(label, reason, other_text);
    setDismissModalOpen(false);
    setPendingDismiss(null);
    await performDismiss(label, example, { reason, other_text, dontAskAgain: true });
  };

  const handleDismissAll = async ({ reason, other_text }) => {
    if (!pendingDismiss) return;
    const { label } = pendingDismiss;
    const fileName = selectedFile?.name;
    if (!fileName) return;
    setDismissModalOpen(false);
    setPendingDismiss(null);

    const toDismiss = [...rotationExamples];
    const now = new Date().toISOString();

    // Build all dismiss records at once
    const newRecords = toDismiss.map((ex) => ({
      label: label || "",
      sentence: ex?.sentence || "",
      paragraph_index: ex?.paragraph_index ?? null,
      file_name: fileName,
      created_at: now,
      reason,
      other_text: other_text || null
    }));

    // Update dismissed issues state in one batch
    const nextDismissed = [...(dismissedIssues || []), ...newRecords];
    updateDismissedIssues(nextDismissed);
    saveDismissedIssuesToStorage({
      markEventId: lastMarkEventId,
      fileName,
      dismissedIssues: nextDismissed
    });

    // Remove all labels from preview DOM
    const container = previewRef?.current;
    if (container) {
      for (const record of newRecords) {
        removeIssueLabelAndHighlight(label, record, {
          containerEl: container,
          scroll: false,
          allowParagraphFallback: true,
          silent: true
        });
      }
    }
    onPreviewEdited?.();

    // Decrement label count by total dismissed
    setLabelCounts((prev) => {
      const next = { ...prev };
      const current = Number(next[label] || 0);
      const updated = Math.max(0, current - toDismiss.length);
      if (updated === 0) delete next[label];
      else next[label] = updated;
      return next;
    });

    // Clear all examples
    const dismissedKeys = new Set(toDismiss.map((ex) => getExampleKey(label, ex)));
    for (const key of dismissedKeys) {
      updateExampleStatus(key, { message: "Dismissed." });
      clearExampleState(key);
    }
    setExamples((prev) => {
      const next = prev.filter((ex) => !dismissedKeys.has(getExampleKey(label, ex)));
      if (!next.length) {
        setExamplesEmptyMessage(
          "No more examples for this issue. Click another bar to practice a different issue."
        );
      }
      return next;
    });

    setDismissMessage(`Dismissed all ${toDismiss.length} issues.`);

    // Log to Supabase in background (non-blocking)
    if (supa) {
      try {
        const sessionResp = await supa.auth.getSession();
        const uid = sessionResp?.data?.session?.user?.id || userId;
        if (uid) {
          const rows = newRecords.map((r) => ({
            user_id: uid,
            file_name: fileName,
            mark_event_id: lastMarkEventId || null,
            mode,
            issue_label: label || "",
            paragraph_index: r.paragraph_index,
            sentence: r.sentence,
            reason,
            other_text: other_text || null
          }));
          const { error: insertError } = await supa
            .from("dismissed_issue_feedback")
            .insert(rows);
          if (insertError) {
            console.warn("Batch dismiss feedback insert failed:", insertError);
          }
        }
      } catch (err) {
        console.warn("Batch dismiss feedback insert failed:", err);
      }
    }
  };

  if (!enabled) return null;

  const rotationCount = rotationExamples.length;
  const currentIndex =
    rotationCount > 0 ? ((exampleNavIndex % rotationCount) + rotationCount) % rotationCount : 0;
  const activeExample = rotationCount ? rotationExamples[currentIndex] : null;
  const activeExampleKey = activeExample ? getExampleKey(selectedLabel, activeExample) : "";
  const activeDraft = activeExample ? getDraftValue(activeExampleKey, activeExample) : "";
  const activeStatus = activeExampleKey ? exampleStatus[activeExampleKey] || {} : {};
  const activeIsApproved = activeExampleKey && exampleStatus[activeExampleKey]?.approved;
  const approvedForList = activeExampleKey && !activeIsApproved
    ? approvedList.filter((entry) => entry.key !== activeExampleKey)
    : approvedList;

  const allApprovedForLabel =
    examples.length > 0 &&
    examples.every((ex) => Boolean(approvedByKey[getExampleKey(selectedLabel, ex)]));
  const allAppliedForLabel =
    examples.length > 0 &&
    examples.every((ex) => Boolean(appliedKeys[getExampleKey(selectedLabel, ex)]));

  const showAllApproved =
    !examplesLoading &&
    selectedLabel &&
    allApprovedForLabel &&
    !allAppliedForLabel;
  const showExamplesEmpty =
    !examplesLoading && selectedLabel && rotationCount === 0 && !allApprovedForLabel;

  const emptyStateMessage = examples.length
    ? examplesEmptyMessage ||
      "No more examples for this issue. Click another bar to practice a different issue."
    : "No examples saved for this issue yet.";

  return (
    <section
      className={`card revision-practice-card${
        showAllApproved ? " all-examples-approved" : ""
      }`}
      id="revisionPracticeCard"
    >
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
        <>
          <div className="issue-select-wrapper">
            <div id="issueButtonsWrap" className="issue-buttons-wrap">
              <div className="issue-section-block">
                <div className="issue-section-heading">Title and Introduction</div>
                <div className="issue-button-row">
                  {groupedIssues.groups.intro.length ? (
                    groupedIssues.groups.intro.map((entry) => (
                      <button
                        key={entry.label}
                        type="button"
                        className={`issue-btn${
                          selectedLabel === entry.label ? " active" : ""
                        }`}
                        onClick={() => {
                          setSelectedLabel(entry.label);
                          onSelectedLabelChange?.(entry.label);
                        }}
                      >
                        {entry.label} ({entry.count})
                      </button>
                    ))
                  ) : (
                    <p className="helper-text">No intro issues.</p>
                  )}
                </div>
              </div>

              {Object.keys(groupedIssues.groups.body)
                .sort((a, b) => Number(a) - Number(b))
                .map((key) => (
                  <div className="issue-section-block" key={`body-${key}`}>
                    <div className="issue-section-heading">Body Paragraph {key}</div>
                    <div className="issue-button-row">
                      {groupedIssues.groups.body[key].map((entry) => (
                        <button
                          key={entry.label}
                          type="button"
                          className={`issue-btn${
                            selectedLabel === entry.label ? " active" : ""
                          }`}
                          onClick={() => {
                            setSelectedLabel(entry.label);
                            onSelectedLabelChange?.(entry.label);
                          }}
                        >
                          {entry.label} ({entry.count})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

              <div className="issue-section-block">
                <div className="issue-section-heading">Conclusion</div>
                <div className="issue-button-row">
                  {groupedIssues.groups.conclusion.length ? (
                    groupedIssues.groups.conclusion.map((entry) => (
                      <button
                        key={entry.label}
                        type="button"
                        className={`issue-btn${
                          selectedLabel === entry.label ? " active" : ""
                        }`}
                        onClick={() => {
                          setSelectedLabel(entry.label);
                          onSelectedLabelChange?.(entry.label);
                        }}
                      >
                        {entry.label} ({entry.count})
                      </button>
                    ))
                  ) : (
                    <p className="helper-text">No conclusion issues.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Two-column layout: Left = Explanation + Guidance, Right = Revision workspace */}
          <div className="revision-two-column-layout">
            {/* LEFT COLUMN: Explanation and Student Guidance */}
            <div className="revision-column-left">
              {selectedIssueExplanation ? (
                <div className="revision-pillbox issue-explanation-block">
                  <h3 className="issue-explanation-header">Explanation</h3>
                  <div className="revision-content-inner">
                    <p className="issue-explanation">{selectedIssueExplanation}</p>
                  </div>
                </div>
              ) : null}

              {selectedIssueGuidance ? (
                <div className="revision-pillbox student-guidance-block">
                  <h3 className="student-guidance-header">Guidance</h3>
                  <div className="revision-content-inner">
                    <p
                      className="student-guidance"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          resolveStudentGuidance(
                            selectedIssueGuidance,
                            activeExample,
                            selectedLabel
                          )
                        )
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* RIGHT COLUMN: Revision workspace */}
            <div className="revision-column-right">
              <div className="revision-pillbox revision-working-block">
                <h3 className="revision-working-header">Revision</h3>

          {showAllApproved ? (
            <div id="allApprovedBanner" className="examples-empty-state">
              All examples for this issue are approved. Apply them to the Preview to
              update your progress, then click the bar chart to revise another issue.
            </div>
          ) : null}

          {showExamplesEmpty ? (
            <div id="examplesEmptyState" className="examples-empty-state">
              {emptyStateMessage}
            </div>
          ) : null}

          {dismissMessage ? <p className="helper-text">{dismissMessage}</p> : null}

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
          ) : (
            <ul id="examplesList" className="examples-list">
              {showAllApproved ? null : activeExample && previewOnly ? (
                <li className="example-item" key={activeExampleKey}>
                  <div className="example-meta">
                    Issue {currentIndex + 1} of {rotationCount}
                  </div>
                  <div className="example-rewrite preview-only-sentence">
                    {activeExample.sentence}
                  </div>
                  <p className="helper-text preview-only-hint">
                    This issue requires editing in the Preview. Click &lsquo;Find in Preview&rsquo; to locate it, make your changes, then click &lsquo;Recheck essay&rsquo;.
                  </p>
                  <div className="rewrite-actions">
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => onNavigateToExample?.(activeExample)}
                      disabled={!previewRef?.current}
                    >
                      Find in preview
                    </button>
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => handleDismissIssue(selectedLabel, activeExample)}
                    >
                      Dismiss issue
                    </button>
                  </div>
                  {rotationCount > 1 ? (
                    <div id="exampleNavRow" className="examples-nav">
                      <button
                        type="button"
                        className="secondary-btn next-example-btn"
                        id="nextExampleBtn"
                        onClick={() => handleNextExample(rotationCount)}
                      >
                        Next →
                      </button>
                    </div>
                  ) : null}
                </li>
              ) : activeExample ? (
                <li className="example-item" key={activeExampleKey}>
                  <div className="example-meta">
                    Issue {currentIndex + 1} of {rotationCount}
                  </div>
                  <textarea
                    className="example-rewrite"
                    name="revision-draft"
                    rows={3}
                    placeholder="Edit directly here..."
                    value={activeDraft}
                    onChange={(event) => updateDraft(activeExampleKey, event.target.value)}
                    ref={(el) => {
                      if (!textareaRefs.current[activeExampleKey]) {
                        textareaRefs.current[activeExampleKey] = { current: null };
                      }
                      textareaRefs.current[activeExampleKey].current = el;
                    }}
                  />
                  {showPowerVerbsHelper ? (
                    <PowerVerbsHelper
                      textareaRef={textareaRefs.current[activeExampleKey]}
                      onVerbApplied={() => {
                        const el = textareaRefs.current[activeExampleKey]?.current;
                        if (el) updateDraft(activeExampleKey, el.value);
                      }}
                      onOpenDictionary={(event, { selectedWord } = {}) =>
                        onOpenPowerVerbs?.({
                          anchorEl: event?.currentTarget,
                          textareaRef: textareaRefs.current[activeExampleKey],
                          selectedWord: selectedWord || ""
                        })
                      }
                    />
                  ) : null}
                  <div className="rewrite-actions">
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => handleResetExample(activeExampleKey, activeExample)}
                    >
                      Reset example
                    </button>
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => handleCopyRewrite(activeExampleKey, activeExample)}
                    >
                      Copy your rewrite
                    </button>
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => onNavigateToExample?.(activeExample)}
                      disabled={!previewRef?.current}
                    >
                      Find in preview
                    </button>
                    <button
                      className={`example-btn check-rewrite-btn${
                        activeStatus.loading ? " is-loading loading-cursor" : ""
                      }`}
                      type="button"
                      onClick={() => handleCheckRewrite(selectedLabel, activeExample)}
                      disabled={activeStatus.loading}
                    >
                      {activeStatus.loading ? "Checking" : "Check rewrite"}
                    </button>
                    <button
                      className={`example-btn apply-to-preview-btn ${
                        approvedByKey[activeExampleKey]?.rewrite ? "apply-attention" : ""
                      }`}
                      type="button"
                      onClick={() =>
                        handleApplyRewrite({
                          key: activeExampleKey,
                          label: selectedLabel,
                          sentence: activeExample.sentence,
                          paragraph_index: activeExample.paragraph_index,
                          rewrite: approvedByKey[activeExampleKey]?.rewrite || ""
                        })
                      }
                      disabled={!approvedByKey[activeExampleKey]?.rewrite}
                    >
                      Apply to Preview
                    </button>
                    <button
                      className="example-btn"
                      type="button"
                      onClick={() => handleDismissIssue(selectedLabel, activeExample)}
                      disabled={activeStatus.loading}
                    >
                      Dismiss issue
                    </button>
                  </div>

                  {/* Next button - navigate to next example */}
                  {rotationCount ? (
                    <div id="exampleNavRow" className="examples-nav">
                      <div
                        id="exampleNavText"
                        className="examples-nav-text"
                        style={{ display: "none" }}
                      >
                        Issue {currentIndex + 1} of {rotationCount}
                      </div>
                      <button
                        type="button"
                        className="secondary-btn next-example-btn"
                        id="nextExampleBtn"
                        onClick={() => handleNextExample(rotationCount)}
                        disabled={rotationCount <= 1}
                      >
                        Next →
                      </button>
                    </div>
                  ) : null}

                  <div
                    className={(() => {
                      const displayText = activeStatus.error ||
                        activeStatus.message ||
                        (approvedByKey[activeExampleKey]?.rewrite ? "✓ Approved! Click 'Apply to Preview' below." : "");

                      const hasContent = Boolean(displayText);
                      const stateClass = activeStatus.error ? "status-error" :
                        (activeStatus.approved || approvedByKey[activeExampleKey]?.rewrite) ? "status-approved" :
                        "status-info";

                      return `rewrite-status ${hasContent ? "visible" : ""} ${stateClass}`.trim();
                    })()}
                    aria-live="polite"
                  >
                    {(() => {
                      const displayText = activeStatus.error ||
                        activeStatus.message ||
                        (approvedByKey[activeExampleKey]?.rewrite ? "✓ Approved! Click 'Apply to Preview' below." : "");
                      return displayText;
                    })()}
                  </div>
                </li>
              ) : null}
            </ul>
          )}

              {/* Approved rewrites accordion - now inside right column, under edit box */}
              {approvedForList.length ? (
            <div
              id="approvedRewritesWrap"
              className="approved-rewrites-wrap"
              data-collapsed={approvedPanelOpen ? "false" : "true"}
            >
              <button
                type="button"
                className="secondary-btn apply-all-btn apply-to-preview-btn"
                id="applyAllToPreviewBtn"
                style={{ display: approvedList.length >= 2 ? "inline-flex" : "none" }}
                onClick={handleApplyAll}
                disabled={approvedList.length < 2}
              >
                Apply all rewrites to Preview
              </button>
              <div className="approved-rewrites-header">
                <div className="approved-rewrites-title">Approved rewrites</div>
                <button
                  type="button"
                  className="approved-rewrites-toggle"
                  id="approvedRewritesToggle"
                  aria-expanded={approvedPanelOpen}
                  onClick={() => setApprovedPanelOpen((prev) => !prev)}
                >
                  {approvedPanelOpen ? "Hide" : "Show"} approved rewrites
                </button>
              </div>
              {approvedPanelOpen ? (
                <ul id="approvedRewritesList" className="approved-rewrites-list">
                  {approvedForList.length ? (
                    approvedForList.map((entry) => {
                      const isEditing = Boolean(editingApprovedKeys[entry.key]);
                      const currentDraft = draftByKey[entry.key] ?? entry.rewrite;
                      return (
                        <li className="approved-rewrite-card" key={`approved-${entry.key}`}>
                          <div className="approved-rewrite-label approved-meta">
                            {entry.label}
                          </div>
                          {isEditing ? (
                            <textarea
                              className="example-rewrite rewrite-input"
                              name="approved-rewrite-draft"
                              rows={2}
                              value={currentDraft}
                              onChange={(event) =>
                                updateDraft(entry.key, event.target.value)
                              }
                            />
                          ) : (
                            <p className="approved-rewrite-text approved-text">
                              {entry.rewrite}
                            </p>
                          )}
                          <div className="rewrite-actions">
                            <button
                              className="example-btn"
                              type="button"
                              onClick={() =>
                                setEditingApprovedKeys((prev) => ({
                                  ...prev,
                                  [entry.key]: !prev[entry.key]
                                }))
                              }
                            >
                              {isEditing ? "Cancel" : "Edit"}
                            </button>
                            {isEditing ? (
                              <button
                                className="example-btn"
                                type="button"
                                onClick={() => {
                                  const next = String(currentDraft || "").trim();
                                  if (!next) return;
                                  setApprovedByKey((prev) => ({
                                    ...prev,
                                    [entry.key]: { ...entry, rewrite: next }
                                  }));
                                  setEditingApprovedKeys((prev) => ({
                                    ...prev,
                                    [entry.key]: false
                                  }));
                                }}
                              >
                                Save
                              </button>
                            ) : null}
                            <button
                              className="example-btn apply-to-preview-btn"
                              type="button"
                              onClick={() =>
                                handleApplyRewrite({
                                  key: entry.key,
                                  label: entry.label,
                                  sentence: entry.sentence,
                                  paragraph_index: entry.paragraph_index,
                                  rewrite: approvedByKey[entry.key]?.rewrite || ""
                                })
                              }
                            >
                              Apply to Preview
                            </button>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="approved-rewrite-card">
                      <p className="helper-text">No other approved rewrites yet.</p>
                    </li>
                  )}
                </ul>
              ) : null}
            </div>
              ) : null}
            </div>
            {/* End of revision-pillbox */}
          </div>
          {/* End of right column */}
        </div>
        {/* End of two-column layout */}

          {/* TODO: Re-enable Download revision notes when needed
          {selectedLabel ? (
            <button
              type="button"
              className="secondary-btn"
              id="downloadRevisionNotesBtn"
              style={{ marginTop: 16 }}
              onClick={handleDownloadNotes}
            >
              Download revision notes
            </button>
          ) : null}
          */}
        </>
      ) : null}
      <DismissIssueModal
        isOpen={dismissModalOpen}
        onCancel={() => {
          setDismissModalOpen(false);
          setPendingDismiss(null);
        }}
        onConfirm={handleDismissConfirm}
        onNoAsk={handleDismissNoAsk}
        onDismissAll={handleDismissAll}
        dismissAllCount={rotationExamples.length}
        dismissLabel={pendingDismiss?.label || ""}
      />
    </section>
  );
}
