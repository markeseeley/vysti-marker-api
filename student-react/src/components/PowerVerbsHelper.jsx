import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  conjugateVerb,
  copyToClipboard,
  detectVerbForm,
  loadPowerVerbs,
  replaceSelectionInTextarea,
  shuffleList,
  toBaseForm
} from "../lib/powerVerbs";
import { BookOpen, Shuffle } from "./Icons";

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
  const savedSelectionRef = useRef(null);
  const [selectedWord, setSelectedWord] = useState("");

  // Track textarea selection so we can restore it after focus loss
  const handleTextareaSelect = useCallback(() => {
    const el = textareaRef?.current;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    if (s !== e) {
      savedSelectionRef.current = { start: s, end: e };
      const word = (el.value || "").slice(s, e).trim();
      // Only treat single-word selections as a verb form hint
      if (word && !/\s/.test(word)) {
        setSelectedWord(word);
      }
    } else {
      setSelectedWord("");
    }
  }, [textareaRef]);

  useEffect(() => {
    const el = textareaRef?.current;
    if (!el) return;
    el.addEventListener("select", handleTextareaSelect);
    el.addEventListener("mouseup", handleTextareaSelect);
    el.addEventListener("keyup", handleTextareaSelect);
    return () => {
      el.removeEventListener("select", handleTextareaSelect);
      el.removeEventListener("mouseup", handleTextareaSelect);
      el.removeEventListener("keyup", handleTextareaSelect);
    };
  }, [textareaRef, handleTextareaSelect]);

  useEffect(() => {
    let isActive = true;
    loadPowerVerbs().then(({ list }) => {
      if (!isActive) return;
      setVerbs(list);
      if (!list.length) {
        setError("Power verbs list failed to load.");
      }
    }).catch(() => { if (isActive) setError("Power verbs list failed to load."); });
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

  // Conjugate suggestion pills to match the double-clicked word's form
  const verbForm = useMemo(() => detectVerbForm(selectedWord), [selectedWord]);

  const conjugateDisplay = useCallback((rawVerb) => {
    if (!selectedWord || verbForm === "base") return rawVerb;
    const base = toBaseForm(rawVerb);
    const conjugated = conjugateVerb(base, verbForm);
    // Match case of the selected word
    const w = selectedWord;
    if (w === w.toUpperCase() && w.length > 1) return conjugated.toUpperCase();
    if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) {
      return conjugated[0].toUpperCase() + conjugated.slice(1);
    }
    return conjugated;
  }, [selectedWord, verbForm]);

  const handleVerbClick = async (verb) => {
    if (!verb) return;
    const display = conjugateDisplay(verb);
    const textarea = textareaRef?.current;
    let applied = false;
    if (textarea) {
      applied = replaceSelectionInTextarea(textarea, display, savedSelectionRef.current);
    }
    if (applied) {
      setFeedback("Replaced!");
      savedSelectionRef.current = null;
      setSelectedWord("");
      onVerbApplied?.(display);
    } else {
      await copyToClipboard(display);
      setFeedback("Copied.");
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
            onClick={(event) => onOpenDictionary?.(event, { selectedWord })}
          >
            <BookOpen size={14} />
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleVerbClick(entry.verb)}
            >
              {conjugateDisplay(entry.verb)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="power-verbs-shuffle-btn"
          aria-label="Shuffle suggestions"
          onClick={reshuffle}
        >
          <Shuffle size={14} />
        </button>
      </div>
    </div>
  );
}
