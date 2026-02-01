import { useEffect, useState } from "react";
import {
  copyToClipboard,
  loadPowerVerbs,
  replaceSelectionInTextarea,
  shuffleList
} from "../lib/powerVerbs";

const SUGGESTION_COUNT = 5;

export default function PowerVerbsHelper({
  textareaRef,
  onOpenDictionary,
  onVerbApplied
}) {
  const [verbs, setVerbs] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    let isActive = true;
    loadPowerVerbs().then(({ list }) => {
      if (!isActive) return;
      setVerbs(list);
      if (!list.length) {
        setError("Power verbs list failed to load.");
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!verbs.length) return;
    setSuggestions(shuffleList(verbs).slice(0, SUGGESTION_COUNT));
  }, [verbs]);

  const reshuffle = () => {
    if (!verbs.length) return;
    const next = shuffleList(verbs).slice(0, SUGGESTION_COUNT);
    setSuggestions(next);
    setFeedback("Shuffled.");
    window.setTimeout(() => setFeedback(""), 1000);
  };

  const handleVerbClick = async (verb) => {
    if (!verb) return;
    const textarea = textareaRef?.current;
    let applied = false;
    if (textarea) {
      applied = replaceSelectionInTextarea(textarea, verb);
    }
    if (!applied) {
      await copyToClipboard(verb);
      setFeedback("Copied.");
    } else {
      setFeedback("Applied.");
      onVerbApplied?.(verb);
    }
    window.setTimeout(() => setFeedback(""), 1200);
  };

  return (
    <div className="power-verbs-helper">
      <div className="power-verbs-header">
        <div className="power-verbs-title">Do any of these work?</div>
        <div className="power-verbs-actions">
          <div className="power-verbs-feedback">{feedback || error}</div>
          <button
            type="button"
            className="power-verbs-iconbtn"
            aria-label="Open power verbs dictionary"
            onClick={onOpenDictionary}
          >
            📘
          </button>
        </div>
      </div>
      <div className="power-verbs-suggestions-row">
        <div className="power-verbs-suggestions-list">
          {(suggestions || []).map((entry) => (
            <button
              type="button"
              className="example-btn power-verb-pill"
              key={entry.verb}
              onClick={() => handleVerbClick(entry.verb)}
            >
              {entry.verb}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="power-verbs-shuffle-btn"
          aria-label="Shuffle suggestions"
          onClick={reshuffle}
        >
          ↻
        </button>
      </div>
    </div>
  );
}
