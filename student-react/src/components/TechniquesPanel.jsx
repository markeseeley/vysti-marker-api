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
