import { useState } from "react";

export default function ModeCard({ label, description, details = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mode-card" id="modeCard">
      <div className="mode-card-header">
        <span className="mode-badge" id="modeBadge">
          {label}
        </span>
        <span className="mode-tag" id="modeTag"></span>
      </div>
      <div className="mode-desc" id="modeDesc">
        {description}
      </div>
      <button
        type="button"
        className="mode-more"
        id="modeMoreBtn"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {isExpanded ? "Hide details" : "Want more details?"}
      </button>
      <div className="mode-details" id="modeDetails" hidden={!isExpanded}>
        <ul id="modeDetailsList">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
