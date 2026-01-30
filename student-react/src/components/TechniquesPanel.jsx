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
import { useMemo, useState } from "react";

const formatKey = (key) => {
  if (!key) return "";
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatItem = (item) => {
  if (item === null || item === undefined) return "";
  if (typeof item === "object") {
    try {
      return JSON.stringify(item);
    } catch (err) {
      return String(item);
    }
  }
  return String(item);
};

export default function TechniquesPanel({ techniques }) {
  const [isOpen, setIsOpen] = useState(true);

  const content = useMemo(() => {
    if (!techniques) return null;
    if (Array.isArray(techniques)) {
      return (
        <ul className="techniques-list">
          {techniques.map((item, index) => (
            <li key={`${formatItem(item)}-${index}`}>{formatItem(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof techniques === "object") {
      return (
        <table className="techniques-table">
          <tbody>
            {Object.entries(techniques).map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{formatKey(key)}</th>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <pre className="techniques-text">{String(techniques)}</pre>;
  }, [techniques]);

  if (!content) return null;

  return (
    <section className="card techniques-panel">
      <button
        type="button"
        className="techniques-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        Techniques {isOpen ? "▾" : "▸"}
      </button>
      <div className="techniques-content" style={{ display: isOpen ? "block" : "none" }}>
        {content}
      </div>
    </section>
  );
}
