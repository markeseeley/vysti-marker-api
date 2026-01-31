import { useEffect, useMemo, useRef } from "react";

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
  const match = raw.match(/^(.+?[.!?])(\s|$)/);
  return match ? match[1] : raw;
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

const ensureTooltip = () => {
  let tooltipEl = document.getElementById("mostCommonIssuesTooltip");
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement("div");
  tooltipEl.id = "mostCommonIssuesTooltip";
  tooltipEl.className = "mci-tooltip";
  tooltipEl.innerHTML = `
    <div class="mci-tooltip-header"></div>
    <div class="mci-body"></div>
    <div class="mci-hint">Click the bar chart to revise</div>
  `;
  tooltipEl.style.opacity = "0";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
};

const positionTooltip = (chart, tooltip, tooltipEl) => {
  const rect = chart.canvas.getBoundingClientRect();
  const left = rect.left + window.scrollX + tooltip.caretX;
  const top = rect.top + window.scrollY + tooltip.caretY;
  const pad = 12;
  const tipRect = tooltipEl.getBoundingClientRect();
  const boundedLeft = Math.max(pad, Math.min(left - tipRect.width / 2, window.innerWidth - tipRect.width - pad));
  const boundedTop = Math.max(pad, top - tipRect.height - 12);
  tooltipEl.style.left = `${boundedLeft}px`;
  tooltipEl.style.top = `${boundedTop}px`;
};

export default function MostCommonIssuesChart({
  labelCounts,
  issues,
  onSelectLabel,
  markEventId
}) {
  const wrapRef = useRef(null);
  const viewportRef = useRef(null);
  const innerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const entries = useMemo(() => buildEntries(labelCounts), [labelCounts]);
  const labels = useMemo(() => entries.map((entry) => entry.label), [entries]);
  const values = useMemo(() => entries.map((entry) => entry.count), [entries]);
  const explanations = useMemo(
    () => buildExplanations(labels, issues),
    [issues, labels]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    if (!entries.length) {
      wrap.dataset.hasData = "false";
      wrap.style.display = "none";
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return undefined;
    }

    const Chart = window.Chart;
    if (!Chart) {
      wrap.dataset.hasData = "true";
      wrap.style.display = "block";
      return undefined;
    }

    wrap.dataset.hasData = "true";
    wrap.style.display = "block";

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const viewport = viewportRef.current;
    const inner = innerRef.current;
    if (viewport && markEventId != null) {
      const markId = String(markEventId);
      if (viewport.dataset.markEventId !== markId) {
        delete viewport.dataset.hasScrolled;
        viewport.dataset.markEventId = markId;
      }
    }
    const viewportWidth = viewport ? viewport.clientWidth : wrap.clientWidth;
    const canvasWidth = Math.max(viewportWidth, entries.length * BAR_PX);
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
    const tooltipEl = ensureTooltip();

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: "rgba(11, 98, 214, 0.6)",
            borderColor: "rgba(11, 98, 214, 1)",
            borderWidth: 1,
            explanations
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: ({ chart, tooltip }) => {
              if (!tooltip || !chart) return;
              if (tooltip.opacity === 0) {
                tooltipEl.style.opacity = "0";
                return;
              }
              const label = tooltip.title?.[0] || "";
              const count = tooltip.body?.[0]?.lines?.[0] || "";
              const index = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
              const explanation = explanations[index] || "";
              tooltipEl.querySelector(".mci-tooltip-header").textContent = label;
              tooltipEl.querySelector(".mci-body").textContent =
                `${count}${explanation ? ` — ${explanation}` : ""}`;
              tooltipEl.style.opacity = "1";
              positionTooltip(chart, tooltip, tooltipEl);
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
          const label = chart.data.labels?.[idx] || "";
          if (label) onSelectLabel?.(label);
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          },
          x: {
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 14, weight: "600" },
              callback: (_value, idx) => {
                const label = labels[idx] || "";
                return label.length > 26 ? `${label.slice(0, 25)}…` : label;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [entries, explanations, labels, values, onSelectLabel, markEventId]);

  if (!entries.length) {
    return null;
  }

  return (
    <div id="mostCommonIssuesWrap" ref={wrapRef} style={{ marginTop: "20px" }}>
      <div className="rules-title">Most Common Issues</div>
      <div id="mciScrollViewport" className="mci-scroll-viewport" ref={viewportRef}>
        <div id="mciScrollInner" className="mci-scroll-inner" ref={innerRef}>
          <canvas id="mostCommonIssuesChart" ref={canvasRef}></canvas>
        </div>
      </div>
    </div>
  );
}
