import { useEffect, useMemo, useRef, useState } from "react";
import { extractPreviewTextFromContainer } from "../lib/previewText";
import { getConfig } from "../config";
import {
  fetchIssueExamples,
  fetchIssueExamplesIndex,
  fetchLatestMarkEvent
} from "../services/revisionPractice";
import DismissIssueModal from "./DismissIssueModal";
import StatsPanel from "./StatsPanel";
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
import { checkRevision } from "../services/revisionCheck";
import {
  clearRevisionPracticeState,
  loadRevisionPracticeState,
  saveRevisionPracticeState
} from "../lib/revisionPracticeStorage";

const getWordCount = (text) => {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : null;
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
  techniques,
  dismissedIssues: dismissedIssuesProp,
  onDismissedIssuesChange,
  selectedLabelOverride,
  onSelectedLabelChange,
  onOpenDiagnostics,
  onNavigateToExample,
  onHighlightExamples,
  onClearHighlights,
  mode,
  onPreviewEdited,
  onOpenPowerVerbs
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
  const [wordCount, setWordCount] = useState(null);
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
  const wordCountTimerRef = useRef(0);
  const lastExtractedRef = useRef("");
  const lastMarkEventRef = useRef(null);
  const textareaRefs = useRef({});
  const [exampleNavIndex, setExampleNavIndex] = useState(0);
  const exampleRefs = useRef([]);

  const debugEnabled = Boolean(getConfig()?.featureFlags?.debugRevisionPractice);
  const dismissedIssues = dismissedIssuesProp ?? localDismissedIssues;
  const updateDismissedIssues = (next) => {
    if (typeof onDismissedIssuesChange === "function") {
      onDismissedIssuesChange(next);
    } else {
      setLocalDismissedIssues(next);
    }
  };

  const totalIssues = useMemo(() => {
    return Object.values(labelCounts || {}).reduce(
      (sum, count) => sum + (Number(count) || 0),
      0
    );
  }, [labelCounts]);

  const topIssue = topLabels.length
    ? `${topLabels[0].label} (${topLabels[0].count})`
    : "";

  const showPowerVerbsHelper = useMemo(() => {
    const normalized = normalizeLabelTrim(selectedLabel);
    return (
      normalized === normalizeLabelTrim(POWER_VERBS_LABEL) ||
      normalized.includes("power verbs")
    );
  }, [selectedLabel]);

  const approvedList = useMemo(() => {
    return Object.entries(approvedByKey).map(([key, entry]) => ({
      key,
      ...entry
    }));
  }, [approvedByKey]);

  const applyStateSnapshot = (snapshot) => {
    if (!snapshot) return;
    setDraftByKey(snapshot.drafts || {});
    setApprovedByKey(snapshot.approved || {});
    setAppliedKeys(snapshot.applied || {});
    setApprovedPanelOpen(Boolean(snapshot.approvedPanelOpen));
    if (snapshot.selectedLabel) {
      setSelectedLabel(snapshot.selectedLabel);
    }
  };

  useEffect(() => {
    if (!userId || !selectedFile?.name) return;
    const snapshot = loadRevisionPracticeState({
      userId,
      fileName: selectedFile.name
    });
    applyStateSnapshot(snapshot);
  }, [userId, selectedFile?.name]);

  useEffect(() => {
    if (!userId || !selectedFile?.name) return;
    saveRevisionPracticeState({
      userId,
      fileName: selectedFile.name,
      state: {
        drafts: draftByKey,
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
    draftByKey,
    selectedFile,
    selectedLabel,
    lastMarkEventId,
    userId
  ]);

  useEffect(() => {
    if (!enabled) return undefined;
    const container = previewRef?.current;
    if (!container) return undefined;

    const update = () => {
      window.clearTimeout(wordCountTimerRef.current);
      wordCountTimerRef.current = window.setTimeout(() => {
        const text = extractPreviewTextFromContainer(container);
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

        if (debugEnabled) {
          console.log("[revision-practice] mark event", {
            hasEvent: Boolean(markEvent),
            labelCountKeys: Object.keys(labelCountsFiltered || {}).length,
            issueCount: issuesFiltered.length
          });
        }

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
    if (topLabels.some((entry) => entry.label === selectedLabelOverride)) {
      setSelectedLabel(selectedLabelOverride);
    }
  }, [selectedLabelOverride, topLabels]);

  useEffect(() => {
    setExamplesEmptyMessage("");
  }, [selectedLabel]);

  useEffect(() => {
    setExampleNavIndex(0);
    exampleRefs.current = [];
  }, [selectedLabel, examples.length]);

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

        if (debugEnabled) {
          console.log("[revision-practice] examples", {
            label: selectedLabel,
            count: exampleRows.length
          });
        }

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
      if (prev && entries.some((entry) => entry.label === prev)) return prev;
      return entries[0]?.label || "";
    });
  }, [labelCounts]);

  const approvedKeysInView = useMemo(() => {
    return new Set(examples.map((ex) => getExampleKey(selectedLabel, ex)));
  }, [examples, selectedLabel]);

  const approvedOtherExamples = useMemo(() => {
    return approvedList.filter((entry) => !approvedKeysInView.has(entry.key));
  }, [approvedKeysInView, approvedList]);

  const selectedIssueExplanation = useMemo(() => {
    if (!selectedLabel) return "";
    const issue = issues.find((item) => item?.label === selectedLabel);
    const short = String(issue?.short_explanation || "").trim();
    if (short) return short;
    const full = String(issue?.explanation || "").trim();
    if (!full) return "";
    const firstSentence = full.split(".")[0]?.trim();
    return firstSentence ? `${firstSentence}.` : full;
  }, [issues, selectedLabel]);

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

  const handleNextExample = () => {
    if (!examples.length) return;
    const nextIndex = (exampleNavIndex + 1) % examples.length;
    setExampleNavIndex(nextIndex);
    const el = exampleRefs.current[nextIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const updateDraft = (key, value) => {
    setDraftByKey((prev) => ({ ...prev, [key]: value }));
  };

  const updateExampleStatus = (key, patch) => {
    setExampleStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...patch }
    }));
  };

  const clearApproved = (key) => {
    setApprovedByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCheckRewrite = async (label, example) => {
    const key = getExampleKey(label, example);
    const rewrite = String(draftByKey[key] || "").trim();
    const original = String(example?.sentence || "").trim();
    if (!previewRef?.current) {
      updateExampleStatus(key, { error: "Preview not loaded yet." });
      return;
    }
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
    const contextText = extractPreviewTextFromContainer(previewRef.current);
    if (!contextText) {
      updateExampleStatus(key, { error: "Preview text is not available yet." });
      return;
    }
    if (!supa) {
      updateExampleStatus(key, { error: "Supabase is not available." });
      return;
    }
    updateExampleStatus(key, { loading: true, error: "", approved: false });

    try {
      const result = await checkRevision({
        supa,
        label,
        labelTrimmed: normalizeLabelTrim(label),
        rewrite,
        mode,
        contextText,
        originalSentence: original,
        paragraphIndex: example?.paragraph_index ?? 0
      });
      if (result?.approved) {
        updateExampleStatus(key, { approved: true, message: "Approved!" });
        setApprovedByKey((prev) => ({
          ...prev,
          [key]: {
            label,
            sentence: original,
            paragraph_index: example?.paragraph_index ?? 0,
            rewrite
          }
        }));
      } else {
        updateExampleStatus(key, {
          approved: false,
          error: result?.message || "Rewrite not approved yet."
        });
        clearApproved(key);
      }
    } catch (err) {
      updateExampleStatus(key, { error: err?.message || "Check failed." });
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
          "No remaining examples (they may have been dismissed). Choose a different issue."
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
      const draft = String(draftByKey[key] || "").trim();
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

  if (!enabled) return null;

  const showAllApproved =
    !examplesLoading && selectedLabel && !examples.length && approvedList.length > 0;
  const showExamplesEmpty =
    !examplesLoading && selectedLabel && !examples.length && !showAllApproved;

  return (
    <section className="card revision-practice-card" id="revisionPracticeCard">
      <h2 className="revision-practice-title">Revision examples</h2>
      {onOpenDiagnostics ? (
        <button type="button" className="diagnostics-link" onClick={onOpenDiagnostics}>
          Diagnostics
        </button>
      ) : null}

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
          <div className="practice-grid">
            <StatsPanel
              wordCount={wordCount}
              totalIssues={totalIssues}
              topIssue={topIssue}
              techniques={techniques}
            />
          </div>

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

          {selectedIssueExplanation ? (
            <div id="issueExplanationBlock">
              <div className="issue-explanation-header">Explanation of the Issue</div>
              <div id="issueExplanation" className="issue-explanation">
                {selectedIssueExplanation}
              </div>
            </div>
          ) : null}

          {showAllApproved ? (
            <div id="allApprovedBanner" className="examples-empty-state">
              All examples for this issue are approved. Apply them to the Preview to
              update your progress, then click another bar to revise a different issue.
            </div>
          ) : null}

          {showExamplesEmpty ? (
            <div id="examplesEmptyState" className="examples-empty-state">
              {examplesEmptyMessage || "No examples saved for this issue yet."}
            </div>
          ) : null}

          {examples.length ? (
            <div id="exampleNavRow" className="examples-nav">
              <div id="exampleNavText" className="examples-nav-text">
                Issue {exampleNavIndex + 1} of {examples.length}
              </div>
              <button
                type="button"
                className="secondary-btn next-example-btn"
                id="nextExampleBtn"
                onClick={handleNextExample}
              >
                Next →
              </button>
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
              {examples.map((ex, idx) => {
                const key = getExampleKey(selectedLabel, ex);
                const draft = draftByKey[key] || "";
                const approved = approvedByKey[key];
                const applied = Boolean(appliedKeys[key]);
                const status = exampleStatus[key] || {};
                if (!textareaRefs.current[key]) {
                  textareaRefs.current[key] = { current: null };
                }
                return (
                  <li
                    className="example-item example-row"
                    key={`${key}-${idx}`}
                    ref={(el) => {
                      exampleRefs.current[idx] = el;
                    }}
                  >
                    <div className="example-guidance">
                      <div className="example-guidance-label">Original sentence</div>
                      <div className="example-guidance-text">
                        {renderSentenceText(ex.sentence)}
                      </div>
                    </div>
                    <div className="example-meta">
                      <span>Paragraph {ex.paragraph_index ?? 0}</span>
                      {status.message ? (
                        <span className="example-status success">{status.message}</span>
                      ) : null}
                      {status.error ? (
                        <span className="example-status error">{status.error}</span>
                      ) : null}
                      {approved ? (
                        <span className="example-status approved">Approved!</span>
                      ) : null}
                      {applied ? (
                        <span className="example-status applied">Applied</span>
                      ) : null}
                    </div>
                    {practiceNavEnabled ? (
                      <button
                        type="button"
                        className="example-jump"
                        onClick={() => onNavigateToExample?.(ex.sentence)}
                        title={ex.sentence || ""}
                      >
                        Jump to paragraph
                      </button>
                    ) : null}
                    <textarea
                      className="example-rewrite rewrite-input"
                      rows={3}
                      placeholder="Write a stronger rewrite here…"
                      value={draft}
                      onChange={(event) => updateDraft(key, event.target.value)}
                      ref={(el) => {
                        textareaRefs.current[key].current = el;
                      }}
                    />
                    {showPowerVerbsHelper ? (
                      <PowerVerbsHelper
                        textareaRef={textareaRefs.current[key]}
                        onOpenDictionary={(event) =>
                          onOpenPowerVerbs?.({
                            anchorEl: event?.currentTarget,
                            textareaRef: textareaRefs.current[key]
                          })
                        }
                      />
                    ) : null}
                    <div className="example-actions rewrite-actions">
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => handleCopy(ex.sentence)}
                      >
                        Copy sentence
                      </button>
                      <button
                        className="secondary-btn dismiss-btn"
                        type="button"
                        onClick={() => handleDismissIssue(selectedLabel, ex)}
                        disabled={status.loading}
                      >
                        Dismiss issue
                      </button>
                      <button
                        className={`secondary-btn${
                          status.loading ? " is-loading loading-cursor" : ""
                        }`}
                        type="button"
                        onClick={() => handleCheckRewrite(selectedLabel, ex)}
                        disabled={status.loading}
                      >
                        {status.loading ? "Checking" : "Check rewrite"}
                      </button>
                      <button
                        className="primary-btn"
                        type="button"
                        onClick={() =>
                          handleApplyRewrite({
                            key,
                            label: selectedLabel,
                            sentence: ex.sentence,
                            paragraph_index: ex.paragraph_index,
                            rewrite: approved?.rewrite || ""
                          })
                        }
                        disabled={!approved?.rewrite}
                      >
                        Apply to Preview
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {approvedList.length ? (
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
                  {approvedOtherExamples.length ? (
                    approvedOtherExamples.map((entry) => {
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
                          <div className="example-actions rewrite-actions">
                            <button
                              className="secondary-btn"
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
                                className="secondary-btn"
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
                              className="primary-btn"
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
      />
    </section>
  );
}
