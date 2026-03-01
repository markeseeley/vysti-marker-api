import { isSuppressedStudentModeLabel } from "./revisionPractice";

const coerceObject = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  return {};
};

const filterLabelCounts = (labelCounts) => {
  const obj = coerceObject(labelCounts);
  return Object.entries(obj).reduce((acc, [label, count]) => {
    if (label && !isSuppressedStudentModeLabel(label)) {
      acc[label] = count;
    }
    return acc;
  }, {});
};

const getTopIssue = (labelCounts) => {
  const entries = Object.entries(labelCounts || {}).map(([label, count]) => ({
    label,
    count: Number(count) || 0
  }));
  if (!entries.length) return "";
  const top = entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0];
  return top?.label ? `${top.label} (${top.count})` : "";
};

const sumCounts = (labelCounts) =>
  Object.values(labelCounts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);

export async function fetchAttemptHistory({ supa, userId, fileName, limit = 10 }) {
  const { data, error } = await supa
    .from("mark_events")
    .select("id, created_at, file_name, label_counts, issues")
    .eq("user_id", userId)
    .eq("file_name", fileName)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => {
    const filteredCounts = filterLabelCounts(row?.label_counts || {});
    return {
      id: row?.id,
      createdAt: row?.created_at,
      totalIssues: sumCounts(filteredCounts),
      topIssue: getTopIssue(filteredCounts),
      labelCounts: filteredCounts,
      issues: row?.issues || []
    };
  });
}
