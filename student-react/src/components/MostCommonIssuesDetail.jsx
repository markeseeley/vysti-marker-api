import { useEffect, useMemo, useRef, useState } from "react";
import { groupLabelsByMetric, METRICS, shortenLabel } from "../lib/labelToMetric";

const TOP_N = 30;
const BAR_PX = 80;

const buildEntries = (labelCounts) =>
  Object.entries(labelCounts || {})
    .filter(([label, count]) => label && (Number(count) || 0) > 0)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .slice(0, TOP_N)
    .map(([label, count]) => ({ label, count: Number(count) || 0 }));

const firstSentence = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  // Match sentence-ending punctuation followed by whitespace or end,
  // but skip common abbreviations (e.g., i.e., etc., vs.)
  // and single-letter abbreviations (initials like "F.", acronyms like "U.")
  const re = /[.!?](?:\s|$)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const before = raw.substring(0, m.index + 1);
    if (/\b(?:e\.g|i\.e|etc|vs)\.$/.test(before)) continue;
    if (raw[m.index] === "." && /(?:^|[\s.(])[A-Za-z]\.$/.test(before)) continue;
    if (raw[m.index] === "." && /\d\.$/.test(before)) continue;
    return before;
  }
  return raw;
};

const buildExplanations = (labels, issues) => {
  const map = new Map();
  (issues || []).forEach((issue) => {
    const label = String(issue?.label || "").trim();
    if (!label || map.has(label)) return;
    const shortText = issue?.short_explanation
      ? String(issue.short_explanation)
      : firstSentence(issue?.explanation);
    if (shortText) map.set(label, shortText);
  });
  return labels.map((label) => map.get(label) || "");
};

export default function MostCommonIssuesDetail({
  expandedMetric,
  onClose,
  labelCounts,
  issues,
  onSelectLabel,
  markEventId
}) {
  const onSelectLabelRef = useRef(onSelectLabel);
  useEffect(() => {
    onSelectLabelRef.current = onSelectLabel;
  }, [onSelectLabel]);

  // ── Fade transitions: enter / switch / close ──
  const [visibleMetric, setVisibleMetric] = useState(expandedMetric);
  const [fadeClass, setFadeClass] = useState(expandedMetric ? "mci-detail--visible" : "");
  const fadeTimer = useRef(null);

  useEffect(() => {
    clearTimeout(fadeTimer.current);
    if (expandedMetric === visibleMetric) return;

    if (expandedMetric && !visibleMetric) {
      // Opening: mount invisible, let browser paint, then fade in
      setVisibleMetric(expandedMetric);
      setFadeClass("mci-detail--entering");
      fadeTimer.current = setTimeout(() => setFadeClass("mci-detail--visible"), 40);
    } else if (!expandedMetric && visibleMetric) {
      // Closing: fade out then unmount
      setFadeClass("mci-detail--exiting");
      fadeTimer.current = setTimeout(() => {
        setVisibleMetric(null);
        setFadeClass("");
      }, 350);
    } else {
      // Switching metrics: fade out old, swap, fade in new
      setFadeClass("mci-detail--exiting");
      fadeTimer.current = setTimeout(() => {
        setVisibleMetric(expandedMetric);
        setFadeClass("mci-detail--entering");
        fadeTimer.current = setTimeout(() => setFadeClass("mci-detail--visible"), 40);
      }, 300);
    }

    return () => clearTimeout(fadeTimer.current);
  }, [expandedMetric]); // eslint-disable-line react-hooks/exhaustive-deps

  const detailViewportRef = useRef(null);
  const detailInnerRef = useRef(null);
  const detailCanvasRef = useRef(null);
  const detailChartRef = useRef(null);

  const entries = useMemo(() => buildEntries(labelCounts), [labelCounts]);
  const groupedByMetric = useMemo(() => groupLabelsByMetric(entries), [entries]);

  const detailEntries = useMemo(() => {
    if (!visibleMetric) return [];
    return groupedByMetric[visibleMetric] || [];
  }, [visibleMetric, groupedByMetric]);

  const detailLabels = useMemo(() => detailEntries.map((entry) => shortenLabel(entry.label)), [detailEntries]);
  const detailFullLabels = useMemo(() => detailEntries.map((entry) => entry.label), [detailEntries]);
  const detailValues = useMemo(() => detailEntries.map((entry) => entry.count), [detailEntries]);
  const detailExplanations = useMemo(
    () => buildExplanations(detailFullLabels, issues),
    [issues, detailFullLabels]
  );
  const visibleMetricObj = visibleMetric ? METRICS[visibleMetric] : null;

  // Render detail chart
  useEffect(() => {
    if (!visibleMetric || !detailEntries.length) {
      if (detailChartRef.current) {
        detailChartRef.current.destroy();
        detailChartRef.current = null;
      }
      return undefined;
    }

    const canvas = detailCanvasRef.current;
    if (!canvas) return undefined;

    const Chart = window.Chart;
    if (!Chart) return undefined;

    // Update existing chart if bar count matches
    if (detailChartRef.current && detailChartRef.current.data.labels.length === detailEntries.length) {
      const chart = detailChartRef.current;

      chart.data.labels = detailLabels;
      chart.data.datasets[0].data = detailValues;
      chart.data.datasets[0].backgroundColor = "transparent";
      chart.data.datasets[0].borderColor = detailEntries.map(() => "rgba(0,0,0,0.45)");
      chart.data.datasets[0].explanations = detailExplanations;
      chart.data.datasets[0].fullLabels = detailFullLabels;
      chart.update("none");
      return undefined;
    }

    // Destroy and rebuild
    if (detailChartRef.current) {
      detailChartRef.current.destroy();
      detailChartRef.current = null;
    }

    const viewport = detailViewportRef.current;
    const inner = detailInnerRef.current;
    if (viewport && markEventId != null) {
      const markId = String(markEventId);
      if (viewport.dataset.markEventId !== markId) {
        delete viewport.dataset.hasScrolled;
        viewport.dataset.markEventId = markId;
      }
    }
    const viewportWidth = viewport ? viewport.clientWidth : 800;
    const canvasWidth = Math.max(viewportWidth, detailEntries.length * BAR_PX);
    canvas.width = canvasWidth;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = "280px";
    if (inner) inner.style.width = `${canvasWidth}px`;

    const shouldResetScroll = viewport && !viewport.dataset.hasScrolled;
    if (viewport && shouldResetScroll) viewport.scrollLeft = 0;
    if (viewport) {
      viewport.addEventListener(
        "scroll",
        () => {
          viewport.dataset.hasScrolled = "1";
        },
        { once: true }
      );
    }

    const ctx = canvas.getContext("2d");

    const backgroundColors = "transparent";
    const borderColors = detailEntries.map(() => "rgba(0,0,0,0.45)");

    // Keep bars the same width as a 4-bar chart when there are fewer entries
    const MIN_BARS = 4;
    const categoryPct = detailEntries.length >= MIN_BARS
      ? 0.8
      : (detailEntries.length / MIN_BARS) * 0.8;

    detailChartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: detailLabels,
        datasets: [
          {
            data: detailValues.map(() => 0),
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            categoryPercentage: categoryPct,
            barPercentage: 0.9,
            explanations: detailExplanations,
            fullLabels: detailFullLabels
          }
        ]
      },
      plugins: [],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            padding: { top: 8, bottom: 12, left: 10, right: 10 },
            callbacks: {
              title: (items) => {
                const item = items?.[0];
                if (!item) return "";
                const idx = item.dataIndex;
                const fullLabel = detailFullLabels[idx] || item.label || "";
                if (fullLabel.length <= 45) return fullLabel;
                const words = fullLabel.split(/\s+/);
                const rows = [];
                let cur = "";
                for (const w of words) {
                  const test = cur ? `${cur} ${w}` : w;
                  if (test.length > 45 && cur) { rows.push(cur); cur = w; }
                  else cur = test;
                }
                if (cur) rows.push(cur);
                return rows;
              },
              label: (items) => {
                const idx = items?.dataIndex;
                if (idx == null) return [];
                const explanation = detailExplanations[idx];
                if (!explanation) return [];

                const words = String(explanation).trim().split(/\s+/);
                const lines = [""];
                let currentLine = "";

                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length > 55 && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                  if (lines.length >= 6) break;
                }
                if (currentLine && lines.length < 6) {
                  lines.push(currentLine);
                }

                if (words.length > lines.join(" ").split(/\s+/).length) {
                  lines[lines.length - 1] = lines[lines.length - 1].replace(/[.\u2026]?$/, "\u2026");
                }

                return lines;
              },
              afterBody: () => ["", "Click to revise"]
            }
          }
        },
        onHover: (event, elements, chart) => {
          if (!chart?.canvas) return;
          chart.canvas.style.cursor = elements?.length ? "pointer" : "default";
        },
        onClick: (event, elements, chart) => {
          if (!chart) return;
          const hits = chart.getElementsAtEventForMode(
            event,
            "nearest",
            { intersect: true },
            true
          );
          if (!hits.length) return;
          const idx = hits[0].index;
          const fullLabel = chart.data.datasets[0].fullLabels?.[idx] || "";
          if (fullLabel) onSelectLabelRef.current?.(fullLabel);
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          },
          x: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 12, weight: "600" },
              callback: (_value, idx) => {
                const label = detailFullLabels[idx] || "";

                if (label.length <= 35) return label;

                const words = label.split(/\s+/);
                const lines = [];
                let currentLine = "";

                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
                  if (testLine.length > 35 && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                  if (lines.length >= 3) break;
                }
                if (currentLine) lines.push(currentLine);

                return lines;
              }
            }
          }
        }
      }
    });

    // ── Stepped "fill" animation: bars count up one notch at a time ──
    const targets = [...detailValues];
    const current = targets.map(() => 0);
    const NOTCH_MS = 130;
    let cancelled = false;

    const stepUp = () => {
      if (cancelled || !detailChartRef.current) return;
      let allDone = true;
      for (let i = 0; i < current.length; i++) {
        if (current[i] < targets[i]) {
          current[i]++;
          allDone = false;
        }
      }
      detailChartRef.current.data.datasets[0].data = [...current];
      detailChartRef.current.update("none");
      if (!allDone) setTimeout(stepUp, NOTCH_MS);
    };
    setTimeout(stepUp, NOTCH_MS);

    return () => {
      cancelled = true;
      if (detailChartRef.current) {
        detailChartRef.current.destroy();
        detailChartRef.current = null;
      }
    };
  }, [visibleMetric, detailEntries, detailExplanations, detailLabels, detailFullLabels, detailValues, markEventId]);

  if (!visibleMetric || !detailEntries.length) return null;

  return (
    <section className={`card mci-detail ${fadeClass}`} style={{ padding: "20px", gridColumn: "1 / -1" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px"
      }}>
        <h3 style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: "700",
          color: "#2c3e50"
        }}>
          {visibleMetricObj?.name} Issues
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "24px",
            color: "#6c757d",
            cursor: "pointer",
            padding: "0 8px",
            lineHeight: "1"
          }}
          title="Close detail view"
        >
          &times;
        </button>
      </div>
      <p style={{
        fontSize: "13px",
        color: "#6c757d",
        marginBottom: "4px"
      }}>
        {visibleMetricObj?.description}
      </p>
      <p style={{
        fontSize: "12px",
        color: "#6c757d",
        margin: "0 0 12px 0",
        fontStyle: "italic"
      }}>
        Click a bar to revise
      </p>
      <div id="detailScrollViewport" className="mci-scroll-viewport" ref={detailViewportRef}>
        <div id="detailScrollInner" className="mci-scroll-inner" ref={detailInnerRef}>
          <canvas id="detailChart" ref={detailCanvasRef}></canvas>
        </div>
      </div>
    </section>
  );
}
