import { useMemo } from "react";

const buildColumns = (items) => {
  const keys = new Set();
  items.slice(0, 5).forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (keys.size < 6) {
        keys.add(key);
      }
    });
  });
  return Array.from(keys);
};

export default function TechniquesPanel({ isOpen, onToggle, data }) {
  const safeData = data || { type: "none", items: [], raw: "", error: "" };
  const { type, items, raw, error } = safeData;
  const columns = useMemo(() => buildColumns(items || []), [items]);

  return (
    <section className="card rules-card">
      <button
        className="secondary-btn"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        Techniques ({isOpen ? "hide" : "show"})
      </button>

      {isOpen ? (
        <div style={{ marginTop: "12px" }}>
          {type === "strings" ? (
            <ul>
              {items.map((entry, idx) => (
                <li key={`${entry}-${idx}`}>{entry}</li>
              ))}
            </ul>
          ) : null}

          {type === "objects" ? (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={`row-${idx}`}>
                      {columns.map((col) => (
                        <td key={`${idx}-${col}`}>{String(row?.[col] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {type === "invalid" ? (
            <div>
              <div>{error || "Techniques header present but invalid JSON"}</div>
              <pre style={{ whiteSpace: "pre-wrap" }}>{raw}</pre>
            </div>
          ) : null}

          {type === "none" ? <div>No techniques data.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
