import { useMemo } from "react";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getTechniqueLabel = (item) =>
  String(item?.label || item?.technique || item?.name || "").trim();

const getTechniqueCount = (item) =>
  toNumber(item?.count ?? item?.occurrences ?? item?.total ?? 0);

const buildTechniqueList = (techniques) => {
  if (!techniques || typeof techniques !== "object") return [];
  const items = Array.isArray(techniques.items) ? techniques.items : [];
  if (!items.length) return [];

  if (techniques.type === "strings") {
    const counts = items.reduce((acc, entry) => {
      const label = String(entry || "").trim();
      if (!label) return acc;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 6);
  }

  if (techniques.type === "objects") {
    return items
      .map((item) => ({
        label: getTechniqueLabel(item),
        count: getTechniqueCount(item)
      }))
      .filter((item) => item.label)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 6);
  }

  return [];
};

export default function StatsPanel({ wordCount, totalIssues, topIssue, techniques }) {
  const techniqueList = useMemo(() => buildTechniqueList(techniques), [techniques]);

  return (
    <section className="practice-stat-card">
      <h3>Stats</h3>
      <div className="practice-stat-row">
        <span>Word count</span>
        <strong>{Number.isFinite(wordCount) ? wordCount : "—"}</strong>
      </div>
      <div className="practice-stat-row">
        <span>Total issues</span>
        <strong>{totalIssues ?? 0}</strong>
      </div>
      <div className="practice-stat-row">
        <span>Top issue</span>
        <strong>{topIssue || "—"}</strong>
      </div>

      {techniqueList.length ? (
        <div className="practice-techniques">
          <h4>Top techniques</h4>
          <ul>
            {techniqueList.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
