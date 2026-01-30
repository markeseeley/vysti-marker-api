function normalizeLabelForCompare(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalLabel(label) {
  return normalizeLabelForCompare(label);
}

export function isSuppressedStudentModeLabel(label) {
  const t = normalizeLabelForCompare(label);
  return t.includes("first sentence") && t.includes("author") && t.includes("full name");
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

export async function fetchLatestMarkEvent({ supa, userId, fileName }) {
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
  const labelCountsFiltered = filterLabelCounts(markEvent?.label_counts || {});
  const issuesFiltered = filterIssues(markEvent?.issues || []);

  return { markEvent, labelCountsFiltered, issuesFiltered };
}

const buildExamplesQuery = ({ supa, userId, fileName, label }) =>
  supa
    .from("issue_examples")
    .select("sentence, paragraph_index, created_at, label, mark_event_id")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .eq("label", label)
    .order("created_at", { ascending: false })
    .order("paragraph_index", { ascending: true })
    .limit(50);

export async function fetchIssueExamples({
  supa,
  userId,
  fileName,
  label,
  markEventId
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
    deduped.push({
      sentence,
      paragraph_index: para,
      created_at: row?.created_at,
      label: row?.label || label
    });
  });

  return deduped.slice(0, 10);
}
