import {
  applyDismissalsToLabelCounts,
  canonicalLabel,
  filterDismissedExamples
} from "../lib/dismissIssues";

export { canonicalLabel };

export function isSuppressedStudentModeLabel(/* label */) {
  return false;
}

const coerceObject = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  return null;
};

const coerceArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }
  return [];
};

const filterLabelCounts = (labelCounts) => {
  const obj = coerceObject(labelCounts);
  if (!obj || typeof obj !== "object") return {};
  return Object.entries(obj).reduce((acc, [label, count]) => {
    if (label && !isSuppressedStudentModeLabel(label)) {
      acc[label] = count;
    }
    return acc;
  }, {});
};

const filterIssues = (issues) => {
  const arr = coerceArray(issues);
  return arr.filter((issue) => !isSuppressedStudentModeLabel(issue?.label || ""));
};

export async function fetchLatestMarkEvent({
  supa,
  userId,
  fileName,
  dismissedIssues = []
}) {
  const { data, error } = await supa
    .from("mark_events")
    .select("id, label_counts, issues, created_at, file_name")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const markEvent = data?.[0] || null;
  const labelCountsFilteredRaw = filterLabelCounts(markEvent?.label_counts || {});
  const labelCountsFiltered = applyDismissalsToLabelCounts(
    labelCountsFilteredRaw,
    dismissedIssues,
    fileName
  );
  const issuesFiltered = filterIssues(markEvent?.issues || []);

  // Fetch all examples from issue_examples for pill navigation
  let examples = [];
  if (markEvent) {
    const { data: examplesData, error: examplesError } = await supa
      .from("issue_examples")
      .select("sentence, paragraph_index, label, found_value, topics, thesis, confidence, original_phrase")
      .eq("user_id", userId)
      .eq("file_name", fileName)
      .order("created_at", { ascending: false });

    if (!examplesError && examplesData) {
      examples = examplesData;
    } else if (examplesError) {
      console.error("[fetchLatestMarkEvent] Error fetching examples:", examplesError);
    }
  }

  return { markEvent, labelCountsFiltered, issuesFiltered, examples };
}

const buildExamplesQuery = ({ supa, userId, fileName, label }) =>
  supa
    .from("issue_examples")
    .select("sentence, paragraph_index, created_at, label, mark_event_id, found_value, topics, thesis, confidence, original_phrase")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .eq("label", label)
    .order("created_at", { ascending: false })
    .order("paragraph_index", { ascending: true })
    .limit(50);

const buildIndexQuery = ({ supa, userId, fileName }) =>
  supa
    .from("issue_examples")
    .select("label, paragraph_index, created_at, mark_event_id")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .order("created_at", { ascending: false })
    .limit(500);

export async function fetchIssueExamples({
  supa,
  userId,
  fileName,
  label,
  markEventId,
  dismissedIssues = []
}) {
  let data = [];
  let error = null;

  if (markEventId) {
    const resp = await buildExamplesQuery({ supa, userId, fileName, label }).eq(
      "mark_event_id",
      markEventId
    );
    data = resp.data || [];
    error = resp.error;
  }

  if ((!data || data.length === 0) && !error) {
    const resp = await buildExamplesQuery({ supa, userId, fileName, label });
    data = resp.data || [];
    error = resp.error;
  }

  if (error) {
    throw error;
  }

  const seen = new Set();
  const deduped = [];
  data.forEach((row) => {
    const sentence = String(row?.sentence || "").trim();
    const para = row?.paragraph_index ?? 0;
    const key = `${para}::${sentence}`;
    if (!sentence || seen.has(key)) return;
    seen.add(key);
    const example = {
      sentence,
      paragraph_index: para,
      created_at: row?.created_at,
      label: row?.label || label
    };
    // Preserve context fields for dynamic guidance
    if (row?.found_value) example.found_value = row.found_value;
    if (row?.topics) example.topics = row.topics;
    if (row?.thesis) example.thesis = row.thesis;
    if (row?.confidence) example.confidence = row.confidence;
    if (row?.original_phrase) example.original_phrase = row.original_phrase;
    deduped.push(example);
  });

  const filtered = filterDismissedExamples(deduped, dismissedIssues, fileName, label);
  return filtered.slice(0, 10);
}

export async function fetchIssueExamplesIndex({
  supa,
  userId,
  fileName,
  markEventId
}) {
  let data = [];
  let error = null;

  if (markEventId) {
    const resp = await buildIndexQuery({ supa, userId, fileName }).eq(
      "mark_event_id",
      markEventId
    );
    data = resp.data || [];
    error = resp.error;
  }

  if ((!data || data.length === 0) && !error) {
    const resp = await buildIndexQuery({ supa, userId, fileName });
    data = resp.data || [];
    error = resp.error;
  }

  if (error) {
    throw error;
  }

  return data
    .filter((row) => row?.label && !isSuppressedStudentModeLabel(row.label))
    .map((row) => ({
      label: row.label,
      paragraph_index: row?.paragraph_index ?? 0,
      created_at: row?.created_at,
      mark_event_id: row?.mark_event_id
    }));
}
