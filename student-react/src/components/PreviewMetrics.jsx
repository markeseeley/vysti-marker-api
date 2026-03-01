import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Zap, Shapes, Link, Target } from "./Icons";
import {
  CONCISION_LABELS,
  CLARITY_LABELS,
  METRIC_INFO,
  CONVENTIONS_LABELS,
  DEVELOPMENT_LABELS,
  PARAGRAPH_LABELS,
  TRANSITION_LABELS,
  looksLikeTitle
} from "../lib/studentMetrics";
import { METRICS } from "../lib/labelToMetric";

const METRIC_ICONS = { power: Zap, variety: Shapes, cohesion: Link, precision: Target };

const renderScore = (score) => {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return `${score}/100`;
};

/**
 * Unified meter dots: always 3 circles, color-matched to the metric meter.
 * - issueCount <= 3: circles fill right-to-left as issues decrease (0 = all filled)
 * - issueCount > 3:  3 empty circles + "-N" overflow badge
 */
const renderMetricDots = (issueCount, meterKey, animationKey = 0, baseIndex = 0) => {
  const n = Math.max(0, Number(issueCount) || 0);
  const filled = Math.max(0, 3 - n);
  const badgeDelay = 0.4 + (baseIndex + 3) * 0.03;
  return (
    <>
      {n > 3 ? (
        <span
          className={`quest-count-badge meter-overflow meter-${meterKey}${animationKey > 0 ? " vysti-dot-pop-in" : ""}`}
          style={animationKey > 0 ? { animationDelay: `calc(var(--card-base, 0s) + ${badgeDelay}s)` } : undefined}
        >
          &minus;{n}
        </span>
      ) : null}
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className={`quest-dot ${i < filled ? "meter-filled" : "meter-empty"} meter-${meterKey}${animationKey > 0 ? " vysti-dot-pop-in" : ""}`}
          style={animationKey > 0 ? { animationDelay: `calc(var(--card-base, 0s) + ${0.4 + (baseIndex + i) * 0.03}s)` } : undefined}
        />
      ))}
    </>
  );
};
const NUM_WORDS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten"
];
const boldNum = (n) => <strong>{n >= 1 && n <= 10 ? NUM_WORDS[n] : String(n)}</strong>;

const normalizeLabel = (value) =>
  String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\s+/g, " ")
    .trim();

const PRECISION_LABELS = {
  concision: CONCISION_LABELS,
  clarity: CLARITY_LABELS,
  conventions: CONVENTIONS_LABELS,
  paragraph: PARAGRAPH_LABELS,
  development: DEVELOPMENT_LABELS,
  transition: TRANSITION_LABELS
};

const getPrecisionHits = (category, issues) => {
  const labels = PRECISION_LABELS[category] || [];
  const labelSet = new Set(labels.map((label) => normalizeLabel(label)));
  const list = Array.isArray(issues) ? issues : [];
  const out = [];

  const toParagraphIndex = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  for (const iss of list) {
    const issueLabelNorm = normalizeLabel(iss?.label);
    if (!issueLabelNorm || !labelSet.has(issueLabelNorm)) continue;

    // Support both shapes:
    // 1) flat issues: { label, sentence_text, paragraph_index, ... }
    // 2) grouped issues: { label, hits: [{ sentence, paragraph_index, ... }, ...] }
    if (Array.isArray(iss?.hits) && iss.hits.length) {
      for (const hit of iss.hits) {
        const sentence = String(
          hit?.sentence || hit?.sentence_text || hit?.text || hit?.evidence || ""
        ).trim();
        // Skip if no sentence or if sentence is too short (likely invalid)
        if (!sentence || sentence.length < 5) continue;
        const entry = {
          sentence,
          paragraph_index: toParagraphIndex(hit?.paragraph_index ?? iss?.paragraph_index),
          label: iss?.label
        };
        if (hit?.found_value || iss?.found_value) entry.found_value = hit.found_value || iss.found_value;
        if (hit?.suggestions || iss?.suggestions) entry.suggestions = hit.suggestions || iss.suggestions;
        out.push(entry);
      }
      continue;
    }

    const sentence = String(
      iss?.sentence_text || iss?.sentence || iss?.evidence || iss?.text || ""
    ).trim();
    // Skip if no sentence or if sentence is too short (likely invalid)
    if (!sentence || sentence.length < 5) continue;
    const entry = {
      sentence,
      paragraph_index: toParagraphIndex(iss?.paragraph_index),
      label: iss?.label
    };
    if (iss?.found_value) entry.found_value = iss.found_value;
    if (iss?.suggestions) entry.suggestions = iss.suggestions;
    out.push(entry);
  }

  return out;
};


const firstSentence = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(.+?[.!?])(\s|$)/);
  return match ? match[1] : raw;
};

export default function PreviewMetrics({
  metrics,
  labelCounts,
  issues,
  collapsed,
  onToggleDetails,
  onOpenInfo,
  onOpenPowerVerbs,
  onUpdatePowerVerbTarget,
  onNavigateToExample,
  onNavigateToPreviewSentence,
  onJumpPowerVerb,
  onToggleRepetition,
  onHighlightVarietyParagraph,
  onHighlightTechniquesParagraph,
  onOpenRevisionFromLabel,
  onScrollToPreview,
  onLogPreviewHighlights,
  onShowPillHint,
  onScanAllTechniques,
  mode,
  highlightResetKey
}) {
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const [repetitionActive, setRepetitionActive] = useState(false);
  const [repetitionDotOverride, setRepetitionDotOverride] = useState(null);
  useEffect(() => { setRepetitionActive(false); setRepetitionDotOverride(null); activatePill(null); thesisDevicesRef.current = []; }, [metrics]);
  useEffect(() => { setRepetitionActive(false); activatePill(null); }, [highlightResetKey]);
  const hideCohesion = mode === "peel_paragraph";
  const cohesionScore = hideCohesion ? null : metrics?.cohesion?.score;
  const cohesionJumpRef = useRef({ paragraph: 0, sentence: 0, weak: 0, transitionLabel: 0 });
  const precisionIdxRef = useRef({ imprecise: 0, unnecessary: 0, wordy: 0, conventions: 0 });
  const powerVerbJumpRef = useRef(0);
  const varietyJumpRef = useRef({ techniques: 0, evidence: 0, structure: 0, development: 0 });
  const thesisDevicesRef = useRef([]);

  // Track the currently-active pill so it gets a colored border
  const activePillRef = useRef(null);
  const METER_COLORS = {
    power: "rgba(220, 53, 69, 0.85)",
    variety: "rgba(13, 110, 253, 0.85)",
    cohesion: "rgba(25, 135, 84, 0.85)",
    precision: "rgba(212, 160, 0, 0.85)"
  };
  const activatePill = (btnEl, meterKey) => {
    if (activePillRef.current && activePillRef.current !== btnEl) {
      activePillRef.current.classList.remove("quest-pill-active");
      activePillRef.current.style.removeProperty("--pill-meter-color");
    }
    if (btnEl) {
      btnEl.classList.add("quest-pill-active");
      btnEl.style.setProperty("--pill-meter-color", METER_COLORS[meterKey] || "rgba(139,0,32,0.6)");
    }
    activePillRef.current = btnEl;
  };

  // ── Pill info popover (Techniques summary / Repetition summary) ──
  const [pillPopover, setPillPopover] = useState(null); // { type, rect, data }
  const popoverRef = useRef(null);
  useEffect(() => { setPillPopover(null); }, [metrics]); // close on new metrics

  // Close popover on click-outside
  useEffect(() => {
    if (!pillPopover) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPillPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pillPopover]);

  // Close popover on Escape
  useEffect(() => {
    if (!pillPopover) return;
    const handler = (e) => { if (e.key === "Escape") setPillPopover(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pillPopover]);

  // Track metrics updates to trigger fill animation
  const [animationKey, setAnimationKey] = useState(0);
  const [hasSeenRealMetrics, setHasSeenRealMetrics] = useState(false);
  const previousHashRef = useRef(null);
  const initialAnimTimeRef = useRef(null);
  const SETTLE_MS = 2000; // ignore score changes within 2s of initial animation

  // Create stable hash of metric scores to detect actual changes
  const metricsHash = useMemo(() => {
    if (!metrics) return "null";
    const scores = [
      metrics?.power?.score ?? "null",
      metrics?.variety?.score ?? "null",
      metrics?.cohesion?.score ?? "null",
      metrics?.precision?.score ?? "null"
    ];
    return scores.join("-");
  }, [metrics]);

  // Check if metrics have real values (not null, not 0)
  const hasRealMetrics = useMemo(() => {
    if (!metrics) return false;
    const scores = [
      metrics?.power?.score,
      metrics?.variety?.score,
      metrics?.cohesion?.score,
      metrics?.precision?.score
    ];
    return scores.some(score => score != null && score > 0);
  }, [metrics]);

  useEffect(() => {
    // Reset state when metrics go back to null (new essay being processed)
    if (!hasRealMetrics && hasSeenRealMetrics) {
      setHasSeenRealMetrics(false);
      previousHashRef.current = null;
      initialAnimTimeRef.current = null;
      return;
    }

    // If this is the first time seeing real metrics, animate them in
    if (!hasSeenRealMetrics && hasRealMetrics) {
      setHasSeenRealMetrics(true);
      setAnimationKey(prev => prev + 1);
      previousHashRef.current = metricsHash;
      initialAnimTimeRef.current = Date.now();
      return;
    }

    // Skip animation if hash hasn't changed
    if (previousHashRef.current === metricsHash) {
      return;
    }

    // During the settle window after initial animation, silently absorb
    // score changes (caused by label counts arriving from Supabase)
    // without re-triggering the fill-up animation.
    const elapsed = Date.now() - (initialAnimTimeRef.current || 0);
    if (hasSeenRealMetrics && previousHashRef.current !== null && elapsed > SETTLE_MS) {
      setAnimationKey(prev => prev + 1);
    }

    previousHashRef.current = metricsHash;
  }, [metricsHash, hasRealMetrics, hasSeenRealMetrics]);
  const logPreviewHighlights = () => {
    onLogPreviewHighlights?.();
  };

  const weakVerbIssues = useMemo(() => {
    const list = Array.isArray(issues) ? issues : [];
    const target = normalizeLabel("Avoid weak verbs");

    return list
      .filter((issue) => normalizeLabel(issue?.label) === target)
      .map((issue) => ({
        ...issue,
        sentence: issue?.sentence_text || issue?.sentence || "",
        paragraph_index: issue?.paragraph_index
      }))
      .filter((issue) => issue.sentence && issue.sentence.trim().length > 0);
  }, [issues]);

  const jumpPowerVerbNeeded = (delta = 1) => {
    if (!weakVerbIssues.length) return false;

    const len = weakVerbIssues.length;
    let idx = powerVerbJumpRef.current % len;
    if (idx < 0) idx += len;
    if (delta === -1) {
      idx = (idx - 1 + len) % len;
      powerVerbJumpRef.current = idx;
    } else {
      powerVerbJumpRef.current = (idx + 1) % len;
    }

    const pick = weakVerbIssues[idx];

    onScrollToPreview?.();
    const ok = onNavigateToPreviewSentence?.(pick) ?? false;
    if (ok) logPreviewHighlights();
    return ok;
  };

  const precisionTargets = useMemo(
    () => {
      const concision = getPrecisionHits("concision", issues);
      const clarity = getPrecisionHits("clarity", issues);
      const conventions = getPrecisionHits("conventions", issues);

      return { concision, clarity, conventions };
    },
    [issues]
  );

  const paragraphLabelHits = useMemo(() => {
    return getPrecisionHits("paragraph", issues);
  }, [issues]);

  const transitionLabelHits = useMemo(() => {
    return getPrecisionHits("transition", issues);
  }, [issues]);

  const jumpPrecision = (kind, delta = 1) => {
    const list = precisionTargets?.[kind] || [];
    if (!list.length) return null;
    if (precisionIdxRef.current[kind] === undefined) {
      precisionIdxRef.current[kind] = 0;
    }
    const len = list.length;
    let i;
    if (delta === -1) {
      i = ((precisionIdxRef.current[kind] - 2 + len * 100) % len);
      precisionIdxRef.current[kind] = (i + 1) % len;
    } else {
      i = precisionIdxRef.current[kind] % len;
      precisionIdxRef.current[kind] = (i + 1) % len;
    }
    onScrollToPreview?.();
    const pick = list[i];
    const exObj = {
      sentence: pick?.sentence,
      paragraph_index: pick?.paragraph_index,
      label: pick?.label
    };
    if (kind === "conventions") exObj.highlightClass = "vysti-conventions-hit";
    const ok =
      onNavigateToExample?.(exObj) ??
      onNavigateToPreviewSentence?.(pick) ??
      false;
    if (ok) logPreviewHighlights();
    return { ok, count: len, item: pick };
  };

  // ── Pre-compute cumulative pill indices for cascade animation ──
  // Each pill across all cards gets a sequential global index.
  // animation-delay = globalIndex * PILL_DELAY_S.
  const PILL_DELAY_S = 0.2;
  const pillStarts = {};
  let _pills = 0;
  for (const k of ["power", "variety", "cohesion", "precision"]) {
    if (k === "cohesion" && hideCohesion) continue;
    pillStarts[k] = _pills;
    const m = metrics?.[k];
    if (k === "power" && m?.details) _pills += 3;
    else if (k === "variety" && m?.details) _pills += 3;
    else if (k === "cohesion" && m?.details) {
      _pills += (Number.isFinite(m.details.paragraphBoundaryHits) && Number.isFinite(m.details.paragraphBoundaryDenom)) ? 3 : 2;
    }
    else if (k === "precision" && m?.details?.hasCounts) _pills += 3;
  }
  const pillEnterCls = animationKey > 0 ? " quest-row-enter" : "";
  const pillStyle = (globalIdx) =>
    animationKey > 0 ? { animationDelay: `${globalIdx * PILL_DELAY_S}s` } : undefined;

  return (
    <div className="preview-metrics-wrap" id="previewMetricsWrap">
      <div className="metrics-details-toggle">
        <button
          type="button"
          className="metrics-toggle-btn"
          id="metricsDetailsToggle"
          aria-expanded={!collapsed}
          onClick={onToggleDetails}
        >
          {collapsed ? "Show details" : "Hide details"}
        </button>
      </div>
      <div
        className={`student-metrics-grid metrics-inline${collapsed ? " details-collapsed" : ""}`}
        id="metricsGrid"
        onClick={(e) => {
          const pill = e.target.closest(".quest-pill-btn");
          if (!pill) return;
          const card = pill.closest(".metric-card");
          if (!card) return;
          const meterKey = (card.id || "").replace("metric-", "");
          activatePill(pill, meterKey);
          // Dismiss popover when a different pill is clicked (Techniques/Repetition handlers set their own)
          const pillText = (pill.textContent || "").trim();
          if (pillText !== "Techniques" && pillText !== "Repetition") {
            setPillPopover(null);
          }
        }}
      >
        {["power", "variety", "cohesion", "precision"].map((key, idx) => {
          if (key === "cohesion" && hideCohesion) return null;
          const metric = metrics?.[key];
          const score = key === "cohesion" ? cohesionScore : metric?.score;
          const title = METRIC_INFO[key]?.title || key;
          return (
            <div
              className="metric-card"
              key={key}
              id={`metric-${key}`}
              style={{ '--card-base': `${((pillStarts[key] ?? 0) * PILL_DELAY_S)}s` }}
            >
              <div className="metric-head">
                <div className="metric-title">
                  {METRIC_ICONS[key] ? (() => { const Icon = METRIC_ICONS[key]; return <Icon size={15} className="metric-icon" />; })() : null}
                  {title}
                  <button
                    className="metric-info metric-info-btn"
                    type="button"
                    data-metric={key}
                    aria-label={`${title} info`}
                    onClick={onOpenInfo}
                  >
                    i
                  </button>
                </div>
                <div className={`metric-score${score === 100 ? " perfect" : ""}`}>
                  {renderScore(score)}
                </div>
              </div>
              <div className="metric-meter">
                <div
                  key={`${key}-${animationKey}`}
                  className={`metric-meter-fill${score === 100 ? " perfect" : ""}${animationKey > 0 ? " animate" : ""}`}
                  style={{
                    width: animationKey > 0 && score ? `${score}%` : "0%",
                    ...(score !== 100 && METRICS[key] ? {
                      background: `linear-gradient(180deg, rgba(255,255,255,.3) 0%, transparent 50%, rgba(0,0,0,.1) 100%), linear-gradient(90deg, ${METRICS[key].gradientStart}, ${METRICS[key].gradientEnd})`
                    } : {})
                  }}
                />
              </div>
              <div className="metric-sub">
                {key === "power" && metric?.details
                  ? (() => {
                      const weakCount = Number(metric.details.weakCount) || 0;
                      const powerCount = Number(metric.details.powerCount) || 0;
                      const powerTarget = Number(metric.details.powerTarget) || 0;
                      const powerDeficit = Math.max(0, powerTarget - powerCount);
                      const repeatedNouns = (metric.details.repeatedNouns || [])
                        .filter((n) => (n.activeCount || n.count || 0) >= 3)
                        .sort((a, b) => (b.activeCount || b.count || 0) - (a.activeCount || a.count || 0));
                      // For dots: first 2 repeated nouns are normal for any essay
                      const repetitionDotCount = Math.max(0, repeatedNouns.length - 2);
                      return (
                        <>
                          {score === 100 ? (
                            <div className="metric-success">
                              <span className="star">★</span>
                              <span>Power goals achieved.</span>
                            </div>
                          ) : null}
                          <div className="power-quests">
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.power ?? 0) + 0)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title="Click to cycle through verbs and strengthen them with power verbs"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  if (!onJumpPowerVerb) return;

                                  const result = onJumpPowerVerb(1, { mode: "weak" });
                                  if (!result.ok && result.total === 0) {
                                    const RECHECK = " Recheck to update your document.";
                                    const POWER_VERB_SUCCESS = [
                                      "No weak verbs found — your writing is strong!" + RECHECK,
                                      "Your verbs are powerful and precise. Nice work!" + RECHECK,
                                      "No weak verbs to replace. Keep up the strong writing!" + RECHECK,
                                      "Every verb pulls its weight here. Well done!" + RECHECK,
                                      "Your verb choices are sharp and effective!" + RECHECK,
                                    ];
                                    onShowPillHint?.({
                                      title: "Power verbs",
                                      body: POWER_VERB_SUCCESS[Math.floor(Math.random() * POWER_VERB_SUCCESS.length)],
                                      subheader: "",
                                      nav: null
                                    });
                                    return;
                                  }

                                  const mkSub = (r) => {
                                    const word = r.word ? ` "${r.word}"` : "";
                                    return `${r.idx + 1} / ${r.total}${word}`;
                                  };

                                  onShowPillHint?.({
                                    title: "Replace weak verbs",
                                    body: "Select from the Power Verbs list to strengthen the highlighted verbs.",
                                    subheader: mkSub(result),
                                    nav: {
                                      count: result.total,
                                      onPrev: () => {
                                        const r = onJumpPowerVerb(-1, { mode: "weak" });
                                        onShowPillHint?.((prev) => ({
                                          ...prev,
                                          subheader: mkSub(r)
                                        }));
                                        onUpdatePowerVerbTarget?.(r.word);
                                      },
                                      onNext: () => {
                                        const r = onJumpPowerVerb(1, { mode: "weak" });
                                        onShowPillHint?.((prev) => ({
                                          ...prev,
                                          subheader: mkSub(r)
                                        }));
                                        onUpdatePowerVerbTarget?.(r.word);
                                      }
                                    }
                                  });

                                  // Auto-open the Power Verbs dictionary with the highlighted word
                                  onOpenPowerVerbs?.(event, { word: result.word });
                                }}
                              >
                                Power verbs
                              </button>
                              <div className="quest-dots">{renderMetricDots(weakCount, "power", animationKey, 0)}</div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.power ?? 0) + 1)}>
                              <button
                                type="button"
                                className={`quest-pill quest-pill-btn${repetitionActive ? " quest-pill-active" : ""}`}
                                title={repetitionActive ? "Click to hide repeated noun highlights" : "Click to highlight all repeated nouns"}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);


                                  const result = onToggleRepetition?.();
                                  if (!result) return;

                                  setRepetitionActive(result.active);

                                  if (!result.active) {
                                    onShowPillHint?.(null);
                                    setPillPopover(null);
                                    return;
                                  }

                                  if (result.total === 0) {
                                    setRepetitionActive(false);
                                    setRepetitionDotOverride(0);
                                    const REPETITION_SUCCESS = [
                                      "No repeated nouns detected. Great vocabulary variety! Recheck to update your document.",
                                      "Your vocabulary is diverse — no repetition issues! Recheck to update your document.",
                                      "No overused nouns found. Strong word choices! Recheck to update your document.",
                                      "Clean variety — no nouns repeated excessively. Recheck to update your document.",
                                      "Your noun usage is well varied throughout. Nice work! Recheck to update your document."
                                    ];
                                    onShowPillHint?.({
                                      title: "Repetition",
                                      body: REPETITION_SUCCESS[Math.floor(Math.random() * REPETITION_SUCCESS.length)],
                                      subheader: ""
                                    });
                                    return;
                                  }

                                  onShowPillHint?.({
                                    title: "Repeated nouns",
                                    body: repeatedNouns.length
                                      ? <>Repeats: {repeatedNouns.map((n, i) => (
                                          <span key={n.lemma}>{i > 0 ? ", " : ""}<strong>{n.lemma}</strong> {"\u00d7"}{n.activeCount || n.count || 0}</span>
                                        ))}. Vary your vocabulary by using synonyms or rephrasing.</>
                                      : "Looks like you repeated the same words quite a few times. Vary your vocabulary by using synonyms or rephrasing.",
                                    subheader: ""
                                  });

                                  // Show pill info popover
                                  if (repeatedNouns.length > 0) {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    setPillPopover((prev) =>
                                      prev?.type === "repetition" ? null : { type: "repetition", rect, data: repeatedNouns }
                                    );
                                  }
                                }}
                              >
                                Repetition
                              </button>
                              <div className="quest-dots">{renderMetricDots(repetitionDotOverride ?? repetitionDotCount, "power", animationKey, 3)}</div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.power ?? 0) + 2)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title="Click to open the Power Verbs dictionary and find strong alternatives"
                                onClick={(e) => {
                                  activatePill(e.currentTarget, key);

                                  onOpenPowerVerbs?.(e);
                                }}
                              >
                                <BookOpen size={16} style={{ verticalAlign: -3 }} />
                              </button>
                              <div className="quest-dots">{renderMetricDots(powerDeficit, "power", animationKey, 6)}</div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  : null}
                {key === "variety" && metric?.details
                  ? (() => {
                      const techniqueOkCount = Number(metric.details.techniqueOkCount) || 0;
                      const evidenceDevOkCount = Number(metric.details.evidenceDevOkCount) || 0;
                      const structureOkCount = Number(metric.details.structureOkCount) || 0;
                      const bodyParagraphCount = Number(metric.details.bodyParagraphCount) || 0;
                      const techniqueFailures = Array.isArray(metric.details.techniqueFailures)
                        ? metric.details.techniqueFailures
                        : [];
                      const evidenceDevFailures = Array.isArray(metric.details.evidenceDevFailures)
                        ? metric.details.evidenceDevFailures
                        : [];
                      const structureFailures = Array.isArray(metric.details.structureFailures)
                        ? metric.details.structureFailures
                        : [];
                      const weakStartSentences = Array.isArray(metric.details.weakStartSentences)
                        ? metric.details.weakStartSentences
                        : [];
                      const sentenceTypesMap = metric.details.sentenceTypes || {};
                      const developmentLabelCount = Number(metric.details.developmentCount) || 0;
                      const paragraphs = Array.isArray(metric.details.paragraphsFiltered)
                        ? metric.details.paragraphsFiltered
                        : [];
                      const previewParagraphs = Array.isArray(metric.details.paragraphsOriginal)
                        ? metric.details.paragraphsOriginal
                        : [];
                      const previewParagraphCount =
                        Number(metric.details.totalOriginalParagraphs) || previewParagraphs.length || 0;
                      const bodyParagraphIndices = Array.isArray(metric.details.bodyParagraphIndices)
                        ? metric.details.bodyParagraphIndices
                        : [];
                      const bodyParagraphPreviewIndices = Array.isArray(
                        metric.details.bodyParagraphPreviewIndices
                      )
                        ? metric.details.bodyParagraphPreviewIndices
                        : [];

                      // Detect when the backend's "intro" is actually a title.
                      // If introPreviewIndex points to a short fragment without
                      // sentence-ending punctuation, the real intro is the first
                      // entry in bodyParagraphPreviewIndices — exclude it.
                      let trueIntroIdx = metric.details.introPreviewIndex ?? 0;
                      let trueBodyPreviewIndices = [...bodyParagraphPreviewIndices];
                      const introCheckText = (previewParagraphs[trueIntroIdx] || "").trim();
                      if (looksLikeTitle(introCheckText) && trueBodyPreviewIndices.length > 0) {
                        trueIntroIdx = trueBodyPreviewIndices[0];
                        trueBodyPreviewIndices = trueBodyPreviewIndices.slice(1);
                      }
                      trueBodyPreviewIndices = trueBodyPreviewIndices.filter(i => i !== trueIntroIdx);

                      // Debug: expose Development state for console inspection
                      window.__devDebug = {
                        bodyParagraphCount,
                        evidenceDevOkCount,
                        developmentLabelCount,
                        dotValue: Math.max(bodyParagraphCount - evidenceDevOkCount, developmentLabelCount),
                        introIsTitle: looksLikeTitle(introCheckText),
                        introCheckText: introCheckText.slice(0, 80),
                        filteredParagraphs: paragraphs.map((p, i) => `[${i}] (${p.split(/\s+/).length}w) ${p.slice(0, 60)}...`),
                        trueBodyPreviewIndices: [...trueBodyPreviewIndices]
                      };

                      // Hard floor for navigation — never jump to blocks before the first TRUE body paragraph
                      const minBodyBlock = trueBodyPreviewIndices.length > 0
                        ? Math.min(...trueBodyPreviewIndices)
                        : 0;
                      const failingTechniquesParagraphPreviewIndices = Array.isArray(
                        metric.details.failingTechniquesParagraphPreviewIndices
                      )
                        ? metric.details.failingTechniquesParagraphPreviewIndices
                        : [];
                      const failingEvidenceDevParagraphPreviewIndices = Array.isArray(
                        metric.details.failingEvidenceDevParagraphPreviewIndices
                      )
                        ? metric.details.failingEvidenceDevParagraphPreviewIndices
                        : [];
                      const VARIETY_TIPS = {
                        techniques:
                          <>Vysti recommends that body paragraphs reference at least {boldNum(3)} unique literary or rhetorical techniques.</>,
                        evidenceDev:
                          <>Each body paragraph needs at least {boldNum(2)} properly integrated quotations and at least {boldNum(4)} sentences of analysis. Cite evidence and explain its significance.</>,
                        structure:
                          "Vary your sentence structure by mixing simple, compound, and complex sentences. Avoid beginning too many sentences with unclarified pronouns."
                      };
                      const jumpToVarietyBlock = (failureIndex) => {
                        const absParaIndex = failureIndex;
                        // failureIndex is an original (raw) paragraph index; use previewParagraphs for text
                        const paraText = previewParagraphs[absParaIndex] || paragraphs[absParaIndex] || "";
                        const example = { sentence: paraText, paragraph_index: absParaIndex, minBlockIndex: minBodyBlock };
                        const ok =
                          onHighlightVarietyParagraph?.(example) ||
                          onNavigateToExample?.(example);
                        if (ok) logPreviewHighlights();
                        if (!ok) onScrollToPreview?.({ clear: true });
                        return ok;
                      };
                      return (
                        <>
                          {score === 100 ? (
                            <div className="metric-success">
                              <span className="star">★</span>
                              <span>Analysis goals achieved.</span>
                            </div>
                          ) : null}
                          <div className="power-quests">
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.variety ?? 0) + 0)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title="Click to browse techniques by paragraph"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);


                                  // Use shared trueBodyPreviewIndices (title-corrected body indices)
                                  const jumpList = trueBodyPreviewIndices;
                                  if (!jumpList.length) return;

                                  // Cycling: advance to next paragraph
                                  const idx = varietyJumpRef.current.techniques % jumpList.length;
                                  varietyJumpRef.current.techniques = (idx + 1) % jumpList.length;
                                  const targetPreviewIndex = jumpList[idx];
                                  const isThesis = false;

                                  // Helper to jump + highlight a paragraph and return detected devices
                                  const doJump = (previewIdx) => {
                                    const paraText = previewParagraphs[previewIdx] || "";
                                    const examp = {
                                      sentence: paraText,
                                      paragraph_index: previewIdx,
                                      minBlockIndex: minBodyBlock
                                    };
                                    const result =
                                      onHighlightTechniquesParagraph?.(examp, paraText) ||
                                      { ok: false, devices: [] };
                                    const ok = result.ok ?? result;
                                    if (ok) logPreviewHighlights();
                                    if (!ok) onScrollToPreview?.({ clear: true });
                                    return result;
                                  };

                                  const result = doJump(targetPreviewIndex);
                                  const devices = result.devices || [];
                                  if (isThesis) thesisDevicesRef.current = devices;

                                  // Helper: format a list with "and"
                                  const formatList = (arr) =>
                                    arr.length === 1 ? arr[0]
                                    : arr.length === 2 ? `${arr[0]} and ${arr[1]}`
                                    : `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;

                                  // Generate contextual guidance text
                                  const getBodyText = (forThesis, devicesFound) => {
                                    const td = thesisDevicesRef.current;
                                    if (forThesis) {
                                      if (devicesFound.length === 1) {
                                        return `The topic of your thesis is ${devicesFound[0]}. We expect to see this topic discussed in your body paragraphs.`;
                                      }
                                      if (devicesFound.length > 1) {
                                        return `The topics of your thesis are ${formatList(devicesFound)}. We expect to see these presented in order in your body paragraphs.`;
                                      }
                                      return "No techniques detected in your thesis. Consider naming the literary or rhetorical techniques you'll analyze.";
                                    }
                                    // Body paragraph — compare with thesis techniques
                                    if (devicesFound.length > 0 && td.length > 0) {
                                      const bodyLower = new Set(devicesFound.map(d => d.toLowerCase()));
                                      const matching = td.filter(t => bodyLower.has(t.toLowerCase()));
                                      if (matching.length > 0) {
                                        const remaining = 3 - devicesFound.length;
                                        if (remaining > 0) {
                                          return <>This paragraph analyzes {formatList(matching)}, following your thesis. Look for {boldNum(remaining)} more unique {remaining === 1 ? "technique" : "techniques"} to reach {boldNum(3)} per body paragraph.</>;
                                        }
                                        return <>This paragraph analyzes {formatList(devicesFound)}, meeting the goal of {boldNum(3)} unique techniques per body paragraph.</>;
                                      }
                                    }
                                    if (devicesFound.length === 0 && td.length > 0) {
                                      return <>No techniques detected in this paragraph. Your thesis references {formatList(td)} — make sure each body paragraph discusses at least one.</>;
                                    }
                                    if (devicesFound.length > 0) {
                                      const remaining = 3 - devicesFound.length;
                                      if (remaining > 0) {
                                        return <>This paragraph uses {formatList(devicesFound)}. Look for {boldNum(remaining)} more unique {remaining === 1 ? "technique" : "techniques"} to reach {boldNum(3)} per body paragraph.</>;
                                      }
                                      return <>This paragraph uses {formatList(devicesFound)}, meeting the goal of {boldNum(3)} unique techniques.</>;
                                    }
                                    return VARIETY_TIPS.techniques;
                                  };

                                  const getSubheader = (forThesis, d) => {
                                    const loc = forThesis ? "Thesis" : "Body paragraph";
                                    return d.length
                                      ? `${loc} techniques: ${d.join(", ")}`
                                      : `${loc} techniques: (none detected)`;
                                  };

                                  // Helper to build nav handlers that update the hint
                                  const makeNavHandlers = () => ({
                                    count: jumpList.length,
                                    onPrev: () => {
                                      varietyJumpRef.current.techniques =
                                        ((varietyJumpRef.current.techniques - 2 + jumpList.length * 100) % jumpList.length);
                                      const pi = varietyJumpRef.current.techniques % jumpList.length;
                                      varietyJumpRef.current.techniques = (pi + 1) % jumpList.length;
                                      const r = doJump(jumpList[pi]);
                                      const d = r.devices || [];
                                      const isT = pi === 0;
                                      if (isT) thesisDevicesRef.current = d;
                                      onShowPillHint?.({
                                        title: "Techniques",
                                        body: getBodyText(isT, d),
                                        subheader: getSubheader(isT, d),
                                        nav: makeNavHandlers()
                                      });
                                    },
                                    onNext: () => {
                                      const ni = varietyJumpRef.current.techniques % jumpList.length;
                                      varietyJumpRef.current.techniques = (ni + 1) % jumpList.length;
                                      const r = doJump(jumpList[ni]);
                                      const d = r.devices || [];
                                      const isT = ni === 0;
                                      if (isT) thesisDevicesRef.current = d;
                                      onShowPillHint?.({
                                        title: "Techniques",
                                        body: getBodyText(isT, d),
                                        subheader: getSubheader(isT, d),
                                        nav: makeNavHandlers()
                                      });
                                    }
                                  });

                                  // Show the popover with Prev/Next navigation
                                  onShowPillHint?.({
                                    title: "Techniques",
                                    body: getBodyText(isThesis, devices),
                                    subheader: getSubheader(isThesis, devices),
                                    nav: makeNavHandlers()
                                  });

                                  // Show pill info popover with ALL techniques across body paragraphs
                                  const allDevices = onScanAllTechniques?.() || [];
                                  if (allDevices.length > 0) {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    setPillPopover((prev) =>
                                      prev?.type === "techniques" ? null : { type: "techniques", rect, data: allDevices }
                                    );
                                  } else {
                                    setPillPopover(null);
                                  }
                                }}
                              >
                                Techniques
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(bodyParagraphCount - techniqueOkCount, "variety", animationKey, 0)}
                              </div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.variety ?? 0) + 1)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={
                                  developmentLabelCount > 0
                                    ? "Click to jump to the next issue"
                                    : evidenceDevFailures.length > 0
                                    ? "Click to jump to the next paragraph"
                                    : "Click to browse paragraphs"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);


                                  // Collect all development issues from the issues array and sort by paragraph
                                  const developmentIssues = getPrecisionHits("development", issues)
                                    .filter((iss) => {
                                      const pi = Number(iss.paragraph_index);
                                      return Number.isFinite(pi);
                                    });

                                  // Sort by paragraph_index to ensure chronological navigation
                                  developmentIssues.sort((a, b) => {
                                    const paraA = Number(a.paragraph_index) || 0;
                                    const paraB = Number(b.paragraph_index) || 0;
                                    return paraA - paraB;
                                  });

                                  // Helper to generate contextual Development guidance based on current label
                                  const getDevelopmentGuidance = (currentLabel) => {
                                    if (!currentLabel) {
                                      return VARIETY_TIPS.evidenceDev;
                                    }

                                    // Provide specific guidance based on the current label
                                    if (currentLabel === "Shorten, modify, and integrate quotations") {
                                      return <>It looks like your quotations are too long. Consider breaking them up into chunks of {boldNum(5)} words or less.</>;
                                    }
                                    if (currentLabel === "Floating quotation") {
                                      return "It looks like you have floating quotations. Introduce each quotation with context before presenting it.";
                                    }
                                    if (currentLabel === "No quotations in the final sentence of a body paragraph") {
                                      return "It looks like you're ending body paragraphs with quotations. Always follow quotations with analysis—explain what the evidence shows and why it matters.";
                                    }
                                    if (currentLabel === "Follow the process for inserting evidence") {
                                      return "It looks like your evidence needs better integration. Follow the process: introduce, cite, and explain your quotations.";
                                    }
                                    if (currentLabel === "Explain the significance of evidence") {
                                      return "It looks like you need to explain the significance of your evidence. After each quotation, analyze what it shows and why it matters.";
                                    }
                                    if (currentLabel === "Undeveloped paragraph") {
                                      return "This paragraph needs more development. Add a few more sentences of analysis after your evidence\u2014explain what the quotation reveals and connect it back to your thesis.";
                                    }
                                    if (currentLabel === "Every paragraph needs evidence") {
                                      return "This paragraph is missing textual evidence. Include at least one quotation from the source text to support your argument.";
                                    }
                                    if (currentLabel === "Only cite a quotation once") {
                                      return "It looks like you\u2019ve cited the same quotation more than once. Each piece of evidence should appear only once\u2014find a new quotation to support this point.";
                                    }
                                    if (currentLabel === "No quotations in thesis statements") {
                                      return "Your thesis statement should be in your own words. Remove the quotation and state your argument directly.";
                                    }
                                    if (currentLabel === "No quotations in topic sentences") {
                                      return "Topic sentences should be in your own words. Move the quotation into the body of the paragraph and lead with your own claim.";
                                    }
                                    if (currentLabel === "Avoid quotations in the introduction") {
                                      return "Save your textual evidence for your body paragraphs. The introduction should set up your argument in your own words.";
                                    }
                                    if (currentLabel === "Avoid quotations in the conclusion") {
                                      return "The conclusion should synthesize your argument in your own words. Remove the quotation and focus on your final analysis.";
                                    }

                                    // Default: show the label itself as guidance
                                    return currentLabel;
                                  };

                                  // If we have specific development issues, navigate through them
                                  if (developmentIssues.length > 0) {
                                    const len = developmentIssues.length;
                                    const idx = (varietyJumpRef.current.evidence || 0) % len;
                                    varietyJumpRef.current.evidence = (idx + 1) % len;
                                    const currentIssue = developmentIssues[idx];

                                    onScrollToPreview?.();
                                    const ok = onNavigateToPreviewSentence?.({ ...currentIssue, minBlockIndex: minBodyBlock }) ?? false;
                                    if (ok) logPreviewHighlights();

                                    onShowPillHint?.({
                                      title: "Development",
                                      body: getDevelopmentGuidance(currentIssue.label),
                                      subheader: `${idx + 1} / ${len}`,
                                      nav: {
                                        count: len,
                                        onPrev: () => {
                                          const pi = ((varietyJumpRef.current.evidence - 2 + len * 100) % len);
                                          varietyJumpRef.current.evidence = (pi + 1) % len;
                                          const prevIssue = developmentIssues[pi];
                                          onScrollToPreview?.();
                                          const ok = onNavigateToPreviewSentence?.({ ...prevIssue, minBlockIndex: minBodyBlock }) ?? false;
                                          if (ok) logPreviewHighlights();
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getDevelopmentGuidance(prevIssue.label),
                                            subheader: `${pi + 1} / ${len}`
                                          }));
                                        },
                                        onNext: () => {
                                          const ni = (varietyJumpRef.current.evidence || 0) % len;
                                          varietyJumpRef.current.evidence = (ni + 1) % len;
                                          const nextIssue = developmentIssues[ni];
                                          onScrollToPreview?.();
                                          const ok = onNavigateToPreviewSentence?.({ ...nextIssue, minBlockIndex: minBodyBlock }) ?? false;
                                          if (ok) logPreviewHighlights();
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getDevelopmentGuidance(nextIssue.label),
                                            subheader: `${ni + 1} / ${len}`
                                          }));
                                        }
                                      }
                                    });
                                    return;
                                  }

                                  // Fallback: If no specific issues, navigate by paragraph (structural failures only)
                                  const failingList =
                                    failingEvidenceDevParagraphPreviewIndices.filter((idx) =>
                                      trueBodyPreviewIndices.includes(idx)
                                    );
                                  const jumpList = failingList.length
                                    ? failingList
                                    : trueBodyPreviewIndices;
                                  if (!jumpList.length) return;

                                  const failingDevSet = new Set(failingList);
                                  const getDevBodyText = (previewIdx) =>
                                    failingDevSet.has(previewIdx)
                                      ? VARIETY_TIPS.evidenceDev
                                      : "Good evidence integration and development in this paragraph.";

                                  const idx = varietyJumpRef.current.evidence % jumpList.length;
                                  varietyJumpRef.current.evidence = (idx + 1) % jumpList.length;
                                  const targetPreviewIndex = jumpList[idx];

                                  const doJump = (previewIdx) => {
                                    const paraText = previewParagraphs[previewIdx] || "";
                                    const examp = {
                                      sentence: paraText,
                                      paragraph_index: previewIdx,
                                      minBlockIndex: minBodyBlock
                                    };
                                    const ok =
                                      onHighlightVarietyParagraph?.(examp) || false;
                                    if (ok) logPreviewHighlights();
                                    if (!ok) onScrollToPreview?.({ clear: true });
                                    return ok;
                                  };

                                  doJump(targetPreviewIndex);

                                  onShowPillHint?.({
                                    title: "Development",
                                    body: getDevBodyText(targetPreviewIndex),
                                    subheader: "",
                                    nav: {
                                      count: jumpList.length,
                                      onPrev: () => {
                                        varietyJumpRef.current.evidence =
                                          ((varietyJumpRef.current.evidence - 2 + jumpList.length * 100) % jumpList.length);
                                        const pi = varietyJumpRef.current.evidence % jumpList.length;
                                        varietyJumpRef.current.evidence = (pi + 1) % jumpList.length;
                                        doJump(jumpList[pi]);
                                        onShowPillHint?.((prev) => ({
                                          ...prev,
                                          body: getDevBodyText(jumpList[pi])
                                        }));
                                      },
                                      onNext: () => {
                                        const ni = varietyJumpRef.current.evidence % jumpList.length;
                                        varietyJumpRef.current.evidence = (ni + 1) % jumpList.length;
                                        doJump(jumpList[ni]);
                                        onShowPillHint?.((prev) => ({
                                          ...prev,
                                          body: getDevBodyText(jumpList[ni])
                                        }));
                                      }
                                    }
                                  });
                                }}
                              >
                                Development
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(Math.max(bodyParagraphCount - evidenceDevOkCount, developmentLabelCount), "variety", animationKey, 3)}
                              </div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.variety ?? 0) + 2)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={
                                  structureFailures.length > 0
                                    ? "Click to jump to the next paragraph"
                                    : "Click to browse paragraphs"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);


                                  // Randomized confirmations for paragraphs with strong variety
                                  const STRUCTURE_SUCCESS = [
                                    "Good sentence variety!",
                                    "Nice work varying your sentence structures!",
                                    "Strong mix of sentence types here.",
                                    "Great job blending different sentence structures.",
                                    "Impressive sentence variety in this paragraph.",
                                  ];

                                  // Helper to generate contextual Structure guidance per paragraph
                                  const getStructureGuidance = (paragraphIndex) => {
                                    const paraTypes = (sentenceTypesMap[String(paragraphIndex)] || sentenceTypesMap[paragraphIndex] || [])
                                      .map((e) => (typeof e === "string" ? e : e?.type || "simple"));

                                    if (paraTypes.length > 0) {
                                      const allSimple = paraTypes.every((t) => t === "simple");
                                      const uniqueTypes = new Set(paraTypes);

                                      if (allSimple && paraTypes.length >= 3) {
                                        return <>This paragraph has {boldNum(paraTypes.length)} sentences, all simple. Try varying your sentence structure {"\u2014"} use a subordinate clause (because, although, when, while) to create a complex sentence, or join two related ideas with a coordinating conjunction (and, but, so) to create a compound sentence.</>;
                                      }

                                      // Check for compound / complex presence
                                      const hasCompound = uniqueTypes.has("compound") || uniqueTypes.has("compound-complex");
                                      const hasComplex = uniqueTypes.has("complex") || uniqueTypes.has("compound-complex");

                                      // 3+ unique types, or has both compound & complex = good variety
                                      if (uniqueTypes.size >= 3 || (hasCompound && hasComplex)) {
                                        return STRUCTURE_SUCCESS[Math.floor(Math.random() * STRUCTURE_SUCCESS.length)];
                                      }

                                      // Missing types: give specific guidance on what to add
                                      if (!hasComplex && !hasCompound) {
                                        return "Try adding a complex sentence using a subordinate clause (because, although, when, while), or join two related ideas with a coordinating conjunction (and, but, so) to create a compound sentence.";
                                      }
                                      if (!hasComplex) {
                                        return "Try adding a complex sentence \u2014 use a subordinate clause (because, although, when, while) to show the relationship between ideas.";
                                      }
                                      if (!hasCompound) {
                                        return "Try adding a compound sentence \u2014 join two related ideas with a coordinating conjunction (and, but, so, yet).";
                                      }
                                      return STRUCTURE_SUCCESS[Math.floor(Math.random() * STRUCTURE_SUCCESS.length)];
                                    }

                                    // Fallback: no type data
                                    const totalWeakStarters = Number(metric.details.weakStartCount) || 0;
                                    if (totalWeakStarters > 0) {
                                      return "It looks like too many sentences begin with pronouns like \u201Cit,\u201D \u201Cthis,\u201D \u201Cthat,\u201D or \u201Cthey.\u201D Add variety with an introductory phrase or clarify what the pronoun refers to.";
                                    }
                                    return VARIETY_TIPS.structure;
                                  };

                                  // If we have specific weak starter sentences, navigate through them
                                  // Filter to TRUE body paragraphs only — exclude title, intro, and unlocated
                                  const bodySetStruct = new Set(trueBodyPreviewIndices);
                                  const bodyWeakStarters = weakStartSentences.filter((s) => {
                                    const pi = Number(s.paragraph_index);
                                    return Number.isFinite(pi) && bodySetStruct.has(pi);
                                  });
                                  if (bodyWeakStarters.length > 0) {
                                    // Sort by paragraph_index for chronological navigation
                                    const sortedSentences = [...bodyWeakStarters].sort((a, b) => {
                                      const paraA = Number(a.paragraph_index) || 0;
                                      const paraB = Number(b.paragraph_index) || 0;
                                      return paraA - paraB;
                                    });

                                    const len = sortedSentences.length;
                                    const idx = (varietyJumpRef.current.structure || 0) % len;
                                    varietyJumpRef.current.structure = (idx + 1) % len;
                                    const currentSentence = sortedSentences[idx];

                                    onScrollToPreview?.();
                                    const ok = onNavigateToPreviewSentence?.({ ...currentSentence, meter: "ANALYSIS", minBlockIndex: minBodyBlock }) ?? false;
                                    if (ok) logPreviewHighlights();

                                    onShowPillHint?.({
                                      title: "Structure",
                                      body: getStructureGuidance(currentSentence.paragraph_index),
                                      subheader: "",
                                      nav: {
                                        count: len,
                                        onPrev: () => {
                                          const pi = ((varietyJumpRef.current.structure - 2 + len * 100) % len);
                                          varietyJumpRef.current.structure = (pi + 1) % len;
                                          const prevSentence = sortedSentences[pi];
                                          onScrollToPreview?.();
                                          const ok = onNavigateToPreviewSentence?.({ ...prevSentence, meter: "ANALYSIS", minBlockIndex: minBodyBlock }) ?? false;
                                          if (ok) logPreviewHighlights();
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getStructureGuidance(prevSentence.paragraph_index)
                                          }));
                                        },
                                        onNext: () => {
                                          const ni = (varietyJumpRef.current.structure || 0) % len;
                                          varietyJumpRef.current.structure = (ni + 1) % len;
                                          const nextSentence = sortedSentences[ni];
                                          onScrollToPreview?.();
                                          const ok = onNavigateToPreviewSentence?.({ ...nextSentence, meter: "ANALYSIS", minBlockIndex: minBodyBlock }) ?? false;
                                          if (ok) logPreviewHighlights();
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getStructureGuidance(nextSentence.paragraph_index)
                                          }));
                                        }
                                      }
                                    });
                                    return;
                                  }

                                  // Fallback: navigate by paragraph if there are structure failures
                                  if (structureFailures.length > 0) {
                                    const jumpList = structureFailures.filter((idx) =>
                                      trueBodyPreviewIndices.includes(idx)
                                    );
                                    if (!jumpList.length) return;

                                    const idx = (varietyJumpRef.current.structure || 0) % jumpList.length;
                                    varietyJumpRef.current.structure = (idx + 1) % jumpList.length;
                                    jumpToVarietyBlock(jumpList[idx]);

                                    onShowPillHint?.({
                                      title: "Structure",
                                      body: getStructureGuidance(jumpList[idx]),
                                      subheader: "",
                                      nav: {
                                        count: jumpList.length,
                                        onPrev: () => {
                                          varietyJumpRef.current.structure =
                                            (((varietyJumpRef.current.structure || 0) - 2 + jumpList.length * 100) % jumpList.length);
                                          const pi = (varietyJumpRef.current.structure || 0) % jumpList.length;
                                          varietyJumpRef.current.structure = (pi + 1) % jumpList.length;
                                          jumpToVarietyBlock(jumpList[pi]);
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getStructureGuidance(jumpList[pi])
                                          }));
                                        },
                                        onNext: () => {
                                          const ni = (varietyJumpRef.current.structure || 0) % jumpList.length;
                                          varietyJumpRef.current.structure = (ni + 1) % jumpList.length;
                                          jumpToVarietyBlock(jumpList[ni]);
                                          onShowPillHint?.((prev) => ({
                                            ...prev,
                                            body: getStructureGuidance(jumpList[ni])
                                          }));
                                      }
                                    }
                                  });
                                  } else {
                                    const STRUCTURE_DONE = [
                                      "No structure issues detected — nice sentence variety!",
                                      "Good mix of sentence types throughout your essay.",
                                      "Your sentence structures are well varied. Keep it up!",
                                      "No weak sentence starters found. Strong variety!",
                                      "Impressive sentence variety across your essay."
                                    ];
                                    onShowPillHint?.({
                                      title: "Structure",
                                      body: STRUCTURE_DONE[Math.floor(Math.random() * STRUCTURE_DONE.length)],
                                      subheader: "",
                                      nav: null
                                    });
                                  }
                                }}
                              >
                                Structure
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(bodyParagraphCount - structureOkCount, "variety", animationKey, 6)}
                              </div>
                            </div>
                            {!bodyParagraphCount && (
                              <div className="metric-note">No body paragraphs detected.</div>
                            )}
                          </div>
                        </>
                      );
                    })()
                  : null}
                {key === "cohesion" && metric?.details
                  ? (() => {
                      const paragraphHits = metric.details.paragraphBoundaryHits;
                      const paragraphDenom = metric.details.paragraphBoundaryDenom;
                      const sentenceHits = metric.details.sentenceBoundaryHits;
                      const sentenceDenom = metric.details.sentenceBoundaryDenom;
                      // Cohesion misses already skip the intro paragraph, so 0 is safe
                      const minBodyBlock = 0;
                      const weakTransitionsCount =
                        Number(metric.details.weakTransitionsCount) ||
                        (Array.isArray(metric.details.issues?.weakTransitions)
                          ? metric.details.issues.weakTransitions.length
                          : 0) ||
                        0;
                      const paragraphLabelCount = Number(metric.details.paragraphLabelCount) || 0;
                      const transitionLabelCount = Number(metric.details.transitionLabelCount) || 0;
                      const combinedTransitionCount = weakTransitionsCount + transitionLabelCount;
                      const paragraphMisses = Array.isArray(
                        metric.details?.issues?.paragraphBoundaryMisses
                      )
                        ? metric.details.issues.paragraphBoundaryMisses
                        : [];
                      const sentenceMisses = Array.isArray(
                        metric.details?.issues?.sentenceBoundaryMisses
                      )
                        ? metric.details.issues.sentenceBoundaryMisses
                        : [];
                      const weakTransitions = Array.isArray(metric.details?.issues?.weakTransitions)
                        ? metric.details.issues.weakTransitions
                        : [];
                      const getCohesionParagraphGuidance = () => {
                        const misses = paragraphMisses.length;
                        const structuralIssues = paragraphLabelCount;
                        if (structuralIssues > 0 && misses === 0) {
                          // Structural labels but no boundary failures
                          return "Check this paragraph for structural issues related to paragraph organization.";
                        }
                        if (misses > 0) {
                          return `It looks like ${misses === 1 ? "this topic sentence doesn't" : "these topic sentences don't"} connect to the preceding paragraph. Repeat a key term from the end of the previous paragraph to create a smooth transition.`;
                        }
                        return "Repeat a key term from the end of the preceding paragraph to smoothly transition into this topic sentence.";
                      };

                      const getCohesionSentenceGuidance = () => {
                        const misses = sentenceMisses.length;
                        if (misses > 0) {
                          return <>It looks like {boldNum(misses)} {misses === 1 ? "sentence doesn't" : "sentences don't"} connect to the previous sentence. Repeat a key content word to help sentences flow together.</>;
                        }
                        return "Repeat a key term from the previous sentence to help it connect with this sentence.";
                      };

                      const getCohesionTransitionGuidance = () => {
                        const weakCount = weakTransitionsCount;
                        if (weakCount > 0) {
                          return "It looks like you're repeating transition words or starting paragraphs with transitional phrases. Delete transitional openers and vary your connectors.";
                        }
                        return "Avoid beginning a paragraph with a transitional phrase. Delete the transitional opener.";
                      };

                      const COHESION_TIPS = {
                        paragraph: getCohesionParagraphGuidance(),
                        sentence: getCohesionSentenceGuidance(),
                        weak: getCohesionTransitionGuidance()
                      };
                      const goCohesion = (kind, delta = +1) => {
                        const issues = metric.details?.issues || {};
                        const list =
                          kind === "paragraph"
                            ? paragraphMisses
                            : kind === "sentence"
                              ? sentenceMisses
                              : weakTransitions;

                        if (!list.length) return null;

                        const len = list.length;
                        let idx = cohesionJumpRef.current[kind] || 0;
                        if (delta === -1) idx = (idx - 1 + len) % len;
                        else idx = idx % len;

                        cohesionJumpRef.current[kind] = (idx + 1) % len;

                        const issue = list[idx];
                        const sentence = String(issue?.sentence || "").trim();
                        if (sentence) {
                          const ok = onNavigateToPreviewSentence?.({
                            sentence,
                            paragraph_index:
                              issue?.paragraph_index ?? issue?.paragraphIndex ?? issue?.paragraph ?? undefined,
                            highlightClass: kind === "sentence" ? "vysti-sentence-hint" : undefined,
                            meter: "COHESION",
                            minBlockIndex: minBodyBlock
                          });
                          if (ok) logPreviewHighlights();
                        }

                        return {
                          title:
                            kind === "weak"
                              ? "Transitions"
                              : kind === "paragraph"
                                ? "Paragraphs"
                                : "Sentences",
                          body: COHESION_TIPS[kind],
                          subheader: "",
                          count: len
                        };
                      };
                      return (
                        <>
                          {score === 100 ? (
                            <div className="metric-success">
                              <span className="star">★</span>
                              <span>Cohesion goals achieved.</span>
                            </div>
                          ) : null}
                          <div className="power-quests">
                            {Number.isFinite(paragraphHits) && Number.isFinite(paragraphDenom) ? (
                              <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.cohesion ?? 0) + 0)}>
                                <button
                                  type="button"
                                  className="quest-pill quest-pill-btn"
                                  title="Click to jump to the next paragraph"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    activatePill(event.currentTarget, key);
  

                                    // If no boundary failures but there are structural labels, navigate to them
                                    if (!paragraphMisses.length) {
                                      if (paragraphLabelHits.length > 0) {
                                        // Navigate to paragraph structural labels
                                        const jumpLabels = (delta = 1) => {
                                          if (!paragraphLabelHits.length) return null;
                                          const len = paragraphLabelHits.length;
                                          let i;
                                          if (delta === -1) {
                                            i = ((cohesionJumpRef.current.paragraph - 2 + len * 100) % len);
                                            cohesionJumpRef.current.paragraph = (i + 1) % len;
                                          } else {
                                            i = cohesionJumpRef.current.paragraph % len;
                                            cohesionJumpRef.current.paragraph = (i + 1) % len;
                                          }
                                          onScrollToPreview?.();
                                          const pick = paragraphLabelHits[i];
                                          const ok = onNavigateToPreviewSentence?.(pick) ?? false;
                                          if (ok) logPreviewHighlights();
                                          return { ok, count: len, label: pick.label };
                                        };

                                        const first = jumpLabels(+1);
                                        if (!first) return;

                                        onShowPillHint?.({
                                          title: "Paragraphs",
                                          body: first.label || "Check this paragraph for structural issues.",
                                          subheader: `${paragraphHits}/${paragraphDenom} boundaries successful`,
                                          nav: {
                                            count: first.count,
                                            onPrev: () => {
                                              const r = jumpLabels(-1);
                                              if (r) {
                                                onShowPillHint?.((prev) => ({
                                                  ...prev,
                                                  body: r.label || prev.body
                                                }));
                                              }
                                            },
                                            onNext: () => {
                                              const r = jumpLabels(+1);
                                              if (r) {
                                                onShowPillHint?.((prev) => ({
                                                  ...prev,
                                                  body: r.label || prev.body
                                                }));
                                              }
                                            }
                                          }
                                        });
                                        return;
                                      }

                                      // No boundary failures and no labels - show success message
                                      const PARAGRAPH_SUCCESS = [
                                        "All paragraph boundaries show strong cohesion. Each topic sentence connects smoothly to the previous paragraph. Recheck to update your document.",
                                        "Your paragraphs flow naturally from one to the next. Well structured! Recheck to update your document.",
                                        "Strong paragraph transitions throughout — each topic sentence links back. Recheck to update your document.",
                                        "No cohesion gaps between paragraphs. Smooth organization! Recheck to update your document.",
                                        "Every topic sentence connects to the preceding paragraph. Nice work! Recheck to update your document."
                                      ];
                                      onShowPillHint?.({
                                        title: "Paragraphs",
                                        body: PARAGRAPH_SUCCESS[Math.floor(Math.random() * PARAGRAPH_SUCCESS.length)],
                                        subheader: `${paragraphHits}/${paragraphDenom} boundaries successful`,
                                        nav: null
                                      });
                                      return;
                                    }

                                    onScrollToPreview?.();
                                    const first = goCohesion("paragraph", +1);
                                    if (!first) return;
                                    onShowPillHint?.({
                                      title: first.title,
                                      body: first.body,
                                      subheader: first.subheader,
                                      nav: {
                                        count: first.count,
                                        onPrev: () => {
                                          onScrollToPreview?.();
                                          goCohesion("paragraph", -1);
                                        },
                                        onNext: () => {
                                          onScrollToPreview?.();
                                          goCohesion("paragraph", +1);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  Paragraphs
                                </button>
                                <div className="quest-dots">
                                  {renderMetricDots((paragraphDenom - paragraphHits) + paragraphLabelCount, "cohesion", animationKey, 0)}
                                </div>
                              </div>
                            ) : null}
                            {Number.isFinite(sentenceHits) && Number.isFinite(sentenceDenom) && sentenceDenom > 0 ? (
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.cohesion ?? 0) + (Number.isFinite(paragraphHits) && Number.isFinite(paragraphDenom) ? 1 : 0))}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={sentenceMisses.length > 0 ? "Click to jump to the next sentence" : "No sentence issues found"}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  onScrollToPreview?.();
                                  const first = goCohesion("sentence", +1);
                                  if (!first) {
                                    const SENTENCE_SUCCESS = [
                                      "Sentences flow smoothly \u2014 no cohesion gaps found! Recheck to update your document.",
                                      "Strong sentence-to-sentence connections throughout. Recheck to update your document.",
                                      "No sentence boundary issues detected. Well linked! Recheck to update your document.",
                                      "Your sentences connect naturally. Nice work! Recheck to update your document.",
                                      "Smooth transitions between sentences. Keep it up! Recheck to update your document."
                                    ];
                                    onShowPillHint?.({
                                      title: "Sentences",
                                      body: SENTENCE_SUCCESS[Math.floor(Math.random() * SENTENCE_SUCCESS.length)],
                                      subheader: `${sentenceHits}/${sentenceDenom} boundaries successful`,
                                      nav: null
                                    });
                                    return;
                                  }
                                  onShowPillHint?.({
                                    title: first.title,
                                    body: first.body,
                                    subheader: first.subheader,
                                    nav: {
                                      count: first.count,
                                      onPrev: () => {
                                        onScrollToPreview?.();
                                        goCohesion("sentence", -1);
                                      },
                                      onNext: () => {
                                        onScrollToPreview?.();
                                        goCohesion("sentence", +1);
                                      }
                                    }
                                  });
                                }}
                              >
                                Sentences
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(sentenceDenom - sentenceHits, "cohesion", animationKey, 3)}
                              </div>
                            </div>
                            ) : null}
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.cohesion ?? 0) + (Number.isFinite(paragraphHits) && Number.isFinite(paragraphDenom) ? 1 : 0) + (Number.isFinite(sentenceHits) && Number.isFinite(sentenceDenom) && sentenceDenom > 0 ? 1 : 0))}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={combinedTransitionCount > 0 ? "Click to jump to the next paragraph" : "No issues found"}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  if (combinedTransitionCount === 0) {
                                    const TRANSITION_SUCCESS = [
                                      "No transition issues found — smooth connectors! Recheck to update your document.",
                                      "Your transitions are clean and varied. Recheck to update your document.",
                                      "No weak or repetitive transitions detected! Recheck to update your document.",
                                      "Paragraph openings look good. Nice work! Recheck to update your document.",
                                      "No transitional phrase issues found. Well done! Recheck to update your document."
                                    ];
                                    onShowPillHint?.({
                                      title: "Transitions",
                                      body: TRANSITION_SUCCESS[Math.floor(Math.random() * TRANSITION_SUCCESS.length)],
                                      subheader: "",
                                      nav: null
                                    });
                                    return;
                                  }
                                  onScrollToPreview?.();
                                  const first = goCohesion("weak", +1);
                                  if (!first) {
                                    // No navigable weakTransitions — try transition label hits
                                    if (transitionLabelHits.length > 0) {
                                      const jumpTransLabels = (delta = 1) => {
                                        if (!transitionLabelHits.length) return null;
                                        const len = transitionLabelHits.length;
                                        let i;
                                        if (delta === -1) {
                                          i = ((cohesionJumpRef.current.transitionLabel - 2 + len * 100) % len);
                                          cohesionJumpRef.current.transitionLabel = (i + 1) % len;
                                        } else {
                                          i = cohesionJumpRef.current.transitionLabel % len;
                                          cohesionJumpRef.current.transitionLabel = (i + 1) % len;
                                        }
                                        onScrollToPreview?.();
                                        const pick = transitionLabelHits[i];
                                        const ok = onNavigateToPreviewSentence?.(pick) ?? false;
                                        if (ok) logPreviewHighlights();
                                        return { ok, count: len, label: pick.label };
                                      };

                                      const firstLabel = jumpTransLabels(+1);
                                      if (!firstLabel) return;

                                      onShowPillHint?.({
                                        title: "Transitions",
                                        body: firstLabel.label || COHESION_TIPS.weak,
                                        subheader: "",
                                        nav: {
                                          count: firstLabel.count,
                                          onPrev: () => {
                                            const r = jumpTransLabels(-1);
                                            if (r) {
                                              onShowPillHint?.((prev) => ({
                                                ...prev,
                                                body: r.label || prev.body
                                              }));
                                            }
                                          },
                                          onNext: () => {
                                            const r = jumpTransLabels(+1);
                                            if (r) {
                                              onShowPillHint?.((prev) => ({
                                                ...prev,
                                                body: r.label || prev.body
                                              }));
                                            }
                                          }
                                        }
                                      });
                                      return;
                                    }
                                    // No label hits either — show guidance without nav
                                    onShowPillHint?.({
                                      title: "Transitions",
                                      body: COHESION_TIPS.weak,
                                      subheader: "",
                                      nav: null
                                    });
                                    return;
                                  }
                                  onShowPillHint?.({
                                    title: first.title,
                                    body: first.body,
                                    subheader: first.subheader,
                                    nav: {
                                      count: first.count,
                                      onPrev: () => {
                                        onScrollToPreview?.();
                                        goCohesion("weak", -1);
                                      },
                                      onNext: () => {
                                        onScrollToPreview?.();
                                        goCohesion("weak", +1);
                                      }
                                    }
                                  });
                                }}
                              >
                                Transitions
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(combinedTransitionCount, "cohesion", animationKey, 6)}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  : null}
                {key === "precision" && metric?.details?.hasCounts
                  ? (() => {
                      const concisionCount = Number(metric.details.concisionCount) || 0;
                      const clarityCount = Number(metric.details.clarityCount) || 0;
                      const conventionsCount = Number(metric.details.conventionsCount) || 0;
                      const getPrecisionGuidance = (kind) => {
                        const getTopLabels = (labelList) => {
                          const topLabels = labelList
                            .map(label => ({ label, count: Number(labelCounts?.[label]) || 0 }))
                            .filter(item => item.count > 0)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 2);
                          return topLabels;
                        };

                        if (kind === "concision") {
                          const topIssues = getTopLabels([
                            "No 'I', 'we', 'us', 'our' or 'you' in academic writing",
                            "No contractions in academic writing",
                            "Avoid the word 'which'",
                            "Avoid using the word 'and' more than twice in a sentence",
                            "Avoid the words 'therefore', 'thereby', 'hence', and 'thus'",
                            "Use the author's name instead of 'the author'",
                            "Avoid referring to the reader or audience unless necessary"
                          ]);
                          if (topIssues.length > 0) {
                            const issues = topIssues.map(item => item.label.charAt(0).toLowerCase() + item.label.slice(1)).join(" and ");
                            return `It looks like you have concision issues: ${issues}. Review these to make your prose more concise.`;
                          }
                          return "Cut unnecessary words and tighten wordy constructions to make every word earn its place.";
                        }

                        if (kind === "clarity") {
                          const topIssues = getTopLabels([
                            "Avoid the vague term 'society'",
                            "Avoid the vague term 'universe'",
                            "Avoid the vague term 'reality'",
                            "Avoid the vague term 'life'",
                            "Avoid the vague term 'truth'",
                            "Clarify pronouns and antecedents",
                            "Do not refer to the text as a text; refer to context instead",
                            "Avoid absolute language like 'always' or 'never'",
                            "Avoid the word 'ethos'",
                            "Avoid the word 'pathos'",
                            "Avoid the word 'logos'",
                            "Avoid the word 'very'",
                            "Avoid the phrase 'a lot'",
                            "Avoid the vague term 'human'",
                            "Avoid the vague term 'people'",
                            "Avoid the vague term 'everyone'",
                            "Avoid the vague term 'individual'",
                            "Avoid the word 'fact'",
                            "Avoid the word 'proof'",
                            "Avoid the word 'prove'"
                          ]);
                          if (topIssues.length > 0) {
                            const issues = topIssues.map(item => {
                              if (item.label.includes("pronouns")) return "unclear pronouns";
                              if (item.label.includes("text as a text")) return "meta-textual references";
                              if (item.label.includes("absolute")) return "absolute language";
                              return item.label.charAt(0).toLowerCase() + item.label.slice(1);
                            }).join(" and ");
                            return `It looks like you have clarity issues: ${issues}. Replace vague language with specific, concrete terms.`;
                          }
                          return "Replace vague or imprecise language with specific, concrete words.";
                        }

                        if (kind === "conventions") {
                          const topIssues = getTopLabels([
                            "Spelling error",
                            "Check subject-verb agreement",
                            "Commonly confused word",
                            "Comma after introductory word",
                            "Possessive apostrophe",
                            "The title of major works should be italicized",
                            "The title of minor works should be inside double quotation marks",
                            "Write out the numbers one through ten"
                          ]);
                          if (topIssues.length > 0) {
                            const issues = topIssues.map(item => {
                              if (item.label.includes("Spelling")) return "spelling errors";
                              if (item.label.includes("subject-verb")) return "subject-verb agreement";
                              if (item.label.includes("confused")) return "commonly confused words";
                              if (item.label.includes("Comma")) return "missing commas after introductory words";
                              if (item.label.includes("apostrophe")) return "possessive apostrophes";
                              if (item.label.includes("major works")) return "title formatting (major works)";
                              if (item.label.includes("minor works")) return "title formatting (minor works)";
                              return item.label.charAt(0).toLowerCase() + item.label.slice(1);
                            }).join(" and ");
                            return `It looks like you have: ${issues}. Review these conventions carefully.`;
                          }
                          return "Fix grammar, spelling, or punctuation errors.";
                        }

                        return "";
                      };

                      const PRECISION_TIPS = {
                        concision: getPrecisionGuidance("concision"),
                        clarity: getPrecisionGuidance("clarity"),
                        conventions: getPrecisionGuidance("conventions")
                      };
                      const PRECISION_SUCCESS = {
                        concision: [
                          "Your writing is tight — no concision issues found!",
                          "Every word earns its place. Nice work!",
                          "No wordiness detected. Clean and concise!",
                          "Lean prose — no concision flags here.",
                          "No unnecessary words found. Well done!"
                        ],
                        clarity: [
                          "Your language is clear and precise!",
                          "No clarity issues detected — great word choices!",
                          "Specific and concrete throughout. Nice work!",
                          "No vague language found. Sharp writing!",
                          "Crystal clear — no clarity flags here."
                        ],
                        conventions: [
                          "Grammar and spelling look good!",
                          "No convention errors detected — nice work!",
                          "Your grammar and punctuation are on point.",
                          "Clean writing — no conventions issues found.",
                          "Solid mechanics. Keep it up!"
                        ]
                      };
                      const getConventionsBody = (item, fallback) => {
                        const suggestions = item?.suggestions;
                        const misspelled = item?.found_value;
                        if (!suggestions?.length || !misspelled) return fallback;
                        const joined = suggestions.length === 1
                          ? <strong>{suggestions[0]}</strong>
                          : suggestions.length === 2
                            ? <><strong>{suggestions[0]}</strong> or <strong>{suggestions[1]}</strong></>
                            : <><strong>{suggestions[0]}</strong>, <strong>{suggestions[1]}</strong>, or <strong>{suggestions[2]}</strong></>;
                        return <><em>{misspelled}</em> — Did you mean {joined}?</>;
                      };
                      // Per-issue guidance: show the specific label for the
                      // currently highlighted issue so users know exactly what
                      // to fix. Falls back to the combined guidance string.
                      const getPrecisionItemBody = (kind, item, fallback) => {
                        if (kind === "conventions") return getConventionsBody(item, fallback);
                        const label = item?.label;
                        if (!label) return fallback;
                        return <><strong>{label}</strong> — review the highlighted sentence.</>;
                      };
                      const doPrecisionPill = (kind, count) => {
                        if (count === 0) {
                          const msgs = PRECISION_SUCCESS[kind];
                          if (msgs) {
                            const title = kind.charAt(0).toUpperCase() + kind.slice(1);
                            onShowPillHint?.({
                              title,
                              body: msgs[Math.floor(Math.random() * msgs.length)],
                              subheader: "",
                              nav: null
                            });
                          }
                          return;
                        }
                        const first = jumpPrecision(kind, +1);
                        if (!first) return;
                        const title = kind.charAt(0).toUpperCase() + kind.slice(1);
                        const body = getPrecisionItemBody(kind, first.item, PRECISION_TIPS[kind]);
                        onShowPillHint?.({
                          title,
                          body,
                          subheader: "",
                          nav: {
                            count: first.count,
                            onPrev: () => {
                              const r = jumpPrecision(kind, -1);
                              if (r?.item) {
                                onShowPillHint?.((prev) => ({
                                  ...prev,
                                  body: getPrecisionItemBody(kind, r.item, PRECISION_TIPS[kind])
                                }));
                              }
                            },
                            onNext: () => {
                              const r = jumpPrecision(kind, +1);
                              if (r?.item) {
                                onShowPillHint?.((prev) => ({
                                  ...prev,
                                  body: getPrecisionItemBody(kind, r.item, PRECISION_TIPS[kind])
                                }));
                              }
                            }
                          }
                        });
                      };
                      return (
                        <>
                          {score === 100 ? (
                            <div className="metric-success">
                              <span className="star">★</span>
                              <span>Precision goals achieved.</span>
                            </div>
                          ) : null}
                          <div className="power-quests">
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.precision ?? 0) + 0)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={
                                  concisionCount > 0
                                    ? "Click to jump to the next issue"
                                    : "No issues found"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  doPrecisionPill("concision", concisionCount);
                                }}
                              >
                                Concision
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(concisionCount, "precision", animationKey, 0)}
                              </div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.precision ?? 0) + 1)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={
                                  clarityCount > 0
                                    ? "Click to jump to the next issue"
                                    : "No issues found"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  doPrecisionPill("clarity", clarityCount);
                                }}
                              >
                                Clarity
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(clarityCount, "precision", animationKey, 3)}
                              </div>
                            </div>
                            <div className={`quest-row${pillEnterCls}`} style={pillStyle((pillStarts.precision ?? 0) + 2)}>
                              <button
                                type="button"
                                className="quest-pill quest-pill-btn"
                                title={
                                  conventionsCount > 0
                                    ? "Click to jump to the next issue"
                                    : "No issues found"
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  activatePill(event.currentTarget, key);

                                  doPrecisionPill("conventions", conventionsCount);
                                }}
                              >
                                Conventions
                              </button>
                              <div className="quest-dots">
                                {renderMetricDots(conventionsCount, "precision", animationKey, 6)}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="metrics-disclaimer">
        Vysti makes mistakes. Check your work.
      </div>
      {pillPopover && (
        <div
          ref={popoverRef}
          className="pill-info-popover"
          style={{
            position: "fixed",
            top: pillPopover.rect.bottom + 8,
            left: Math.max(8, pillPopover.rect.left - 40),
          }}
        >
          {pillPopover.type === "techniques" && (
            <>
              <div className="pill-popover-title">Techniques found</div>
              <ul className="pill-popover-list">
                {pillPopover.data.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {pillPopover.type === "repetition" && (
            <>
              <div className="pill-popover-title">Repeated nouns</div>
              <ul className="pill-popover-list">
                {pillPopover.data.map((n) => (
                  <li key={n.lemma}>
                    {n.lemma} <span className="pill-popover-count">{"\u00d7"}{n.activeCount || n.count || 0}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
