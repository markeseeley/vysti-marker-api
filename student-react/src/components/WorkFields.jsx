import { useCallback, useMemo, useState } from "react";

const EMPTY_WORK = { author: "", title: "", isMinor: true };

const PLACEHOLDER_WORKS = [
  { author: "Toni Morrison", title: "Beloved" },
  { author: "Gabriel García Márquez", title: "One Hundred Years of Solitude" },
  { author: "Sylvia Plath", title: "Lady Lazarus" },
  { author: "William Shakespeare", title: "Hamlet" },
  { author: "Mary Shelley", title: "Frankenstein" },
  { author: "F. Scott Fitzgerald", title: "The Great Gatsby" },
  { author: "Chinua Achebe", title: "Things Fall Apart" },
  { author: "Margaret Atwood", title: "The Handmaid's Tale" },
  { author: "Kazuo Ishiguro", title: "Never Let Me Go" },
  { author: "Emily Dickinson", title: "Because I could not stop for Death" },
];

function pickPlaceholders(count) {
  const shuffled = [...PLACEHOLDER_WORKS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function WorkFields({ works, onUpdate, maxWorks = 5 }) {
  // Pick once per mount so placeholders stay stable while the user interacts
  const placeholders = useMemo(() => pickPlaceholders(maxWorks), [maxWorks]);
  // Track which extra works are collapsed (Work 1 always open)
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapsed = useCallback((index) => {
    setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const updateWork = useCallback((index, field, value) => {
    const next = works.map((w, i) => (i === index ? { ...w, [field]: value } : w));
    onUpdate(next);
  }, [works, onUpdate]);

  const addWork = useCallback(() => {
    if (works.length < maxWorks) {
      onUpdate([...works, { ...EMPTY_WORK }]);
    }
  }, [works, maxWorks, onUpdate]);

  const removeWork = useCallback((index) => {
    onUpdate(works.filter((_, i) => i !== index));
  }, [works, onUpdate]);

  return (
    <div className="work-fields-section">
      {works.map((work, i) => {
        const isExtra = i > 0;
        const isCollapsed = isExtra && !!collapsed[i];
        const summary =
          work.author || work.title
            ? [work.author, work.title].filter(Boolean).join(" — ")
            : null;

        return (
          <div key={i} className={`work-block${isCollapsed ? " work-block--collapsed" : ""}`}>
            <div className="work-block-header">
              {isExtra ? (
                <button
                  type="button"
                  className="work-block-toggle"
                  onClick={() => toggleCollapsed(i)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} work ${i + 1}`}
                >
                  <svg
                    className={`work-block-chevron${isCollapsed ? " work-block-chevron--closed" : ""}`}
                    width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="work-block-title">Work {i + 1}</span>
                  {isCollapsed && summary && (
                    <span className="work-block-summary">{summary}</span>
                  )}
                </button>
              ) : (
                <span className="work-block-title">Work {i + 1}</span>
              )}

              {isExtra && (
                <button
                  type="button"
                  className="work-block-remove"
                  onClick={() => removeWork(i)}
                  aria-label={`Remove work ${i + 1}`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {!isCollapsed && (
              <>
                <label>
                  Author
                  <input
                    type="text"
                    placeholder={`e.g. ${placeholders[i]?.author ?? "Toni Morrison"}`}
                    value={work.author}
                    onChange={(e) => updateWork(i, "author", e.target.value)}
                  />
                </label>

                <label>
                  Title
                  <input
                    type="text"
                    placeholder={`e.g. ${placeholders[i]?.title ?? "Beloved"}`}
                    value={work.title}
                    onChange={(e) => updateWork(i, "title", e.target.value)}
                  />
                </label>

                <div className="title-type-block">
                  <div className="title-type-grid">
                    <label className="type-option tt" data-tip="The title of the text must be in double quotation marks.">
                      <span className="type-head">
                        <input
                          type="radio"
                          name={`titleType${i}`}
                          checked={work.isMinor}
                          onChange={() => updateWork(i, "isMinor", true)}
                        />
                        <span className="type-name">Minor work</span>
                      </span>
                    </label>
                    <label className="type-option tt" data-tip="The title of the text must be in italics.">
                      <span className="type-head">
                        <input
                          type="radio"
                          name={`titleType${i}`}
                          checked={!work.isMinor}
                          onChange={() => updateWork(i, "isMinor", false)}
                        />
                        <span className="type-name">Major work</span>
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {works.length < maxWorks && (
        <button type="button" className="add-work-btn" onClick={addWork}>
          + Add another work
        </button>
      )}
    </div>
  );
}
