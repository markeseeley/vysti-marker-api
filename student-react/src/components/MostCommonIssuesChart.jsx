import { useEffect, useMemo, useRef } from "react";
import { groupLabelsByMetric, METRICS } from "../lib/labelToMetric";

const TOP_N = 30;
const Y_AXIS_CAP = 10;

const buildEntries = (labelCounts) =>
  Object.entries(labelCounts || {})
    .filter(([label, count]) => label && (Number(count) || 0) > 0)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .slice(0, TOP_N)
    .map(([label, count]) => ({ label, count: Number(count) || 0 }));


export default function MostCommonIssuesChart({
  labelCounts,
  expandedMetric,
  onExpandedMetricChange,
  markEventId,
  cohesionDetails
}) {
  const wrapRef = useRef(null);
  const summaryCanvasRef = useRef(null);
  const summaryChartRef = useRef(null);

  const entries = useMemo(() => buildEntries(labelCounts), [labelCounts]);

  // Group entries by metric for summary
  const groupedByMetric = useMemo(() => groupLabelsByMetric(entries), [entries]);

  // Structural cohesion issues (sentence/paragraph boundary misses) aren't
  // discrete labels — they come from the text-analysis cohesion details.
  // Include them so the Cohesion bar reflects the actual weakness.
  const structuralCohesionCount = useMemo(() => {
    if (!cohesionDetails) return 0;
    const sentMisses = Math.max(0,
      (cohesionDetails.sentenceBoundaryDenom || 0) - (cohesionDetails.sentenceBoundaryHits || 0));
    const paraMisses = Math.max(0,
      (cohesionDetails.paragraphBoundaryDenom || 0) - (cohesionDetails.paragraphBoundaryHits || 0));
    return sentMisses + paraMisses;
  }, [cohesionDetails]);

  // Calculate metric totals for summary chart — always include all 4 metrics
  const metricTotals = useMemo(() => {
    const metricOrder = ["power", "variety", "cohesion", "precision"];
    return metricOrder.map((metricId) => {
      const labelTotal = groupedByMetric[metricId]?.reduce((sum, entry) => sum + entry.count, 0) || 0;
      // Add structural cohesion issues to the cohesion bar
      const extra = metricId === "cohesion" ? structuralCohesionCount : 0;
      return {
        metricId,
        metric: METRICS[metricId],
        count: labelTotal + extra
      };
    });
  }, [groupedByMetric, structuralCohesionCount]);

  // Only show the chart when at least one metric has labels
  const hasAnyLabels = useMemo(
    () => metricTotals.some((item) => item.count > 0),
    [metricTotals]
  );

  // Capped data for display — bars capped at Y_AXIS_CAP, overflow shown as labels
  const cappedData = useMemo(() => {
    return metricTotals.map((item) => ({
      display: Math.min(item.count, Y_AXIS_CAP),
      actual: item.count,
      overflow: item.count > Y_AXIS_CAP ? item.count - Y_AXIS_CAP : 0
    }));
  }, [metricTotals]);

  // Render summary chart (4 metric bars)
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = summaryCanvasRef.current;
    if (!wrap || !canvas) return undefined;

    if (!hasAnyLabels) {
      wrap.dataset.hasData = "false";
      wrap.style.display = "none";
      if (summaryChartRef.current) {
        summaryChartRef.current.destroy();
        summaryChartRef.current = null;
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

    const maxVal = Math.max(...cappedData.map((d) => d.display));
    const yMax = Math.min(Math.max(maxVal + 1, 4), Y_AXIS_CAP);

    // Update existing chart if bar count matches
    if (summaryChartRef.current && summaryChartRef.current.data.labels.length === metricTotals.length) {
      const chart = summaryChartRef.current;
      const ctx = canvas.getContext("2d");
      const chartArea = chart.chartArea;
      const chartHeight = chartArea ? chartArea.bottom - chartArea.top : 160;

      const gradients = metricTotals.map((item) => {
        const gradient = ctx.createLinearGradient(0, chartArea?.bottom || chartHeight, 0, chartArea?.top || 0);
        gradient.addColorStop(0, item.metric.gradientStart);
        gradient.addColorStop(1, item.metric.gradientEnd);
        return gradient;
      });

      chart.data.labels = metricTotals.map((item) => item.metric.name);
      chart.data.datasets[0].data = cappedData.map((d) => d.display);
      chart.data.datasets[0].backgroundColor = gradients;
      chart.data.datasets[0].borderColor = metricTotals.map((item) => item.metric.color);
      chart.data.datasets[0].actualCounts = cappedData.map((d) => d.actual);
      chart.options.scales.y.max = yMax;
      chart.update("none");
      return undefined;
    }

    // Destroy and rebuild
    if (summaryChartRef.current) {
      summaryChartRef.current.destroy();
      summaryChartRef.current = null;
    }

    const ctx = canvas.getContext("2d");

    // Chart.js datalabels-style plugin to show "+N" on capped bars
    const overflowLabelPlugin = {
      id: "overflowLabels",
      afterDatasetsDraw(chart) {
        const ds = chart.data.datasets[0];
        const actuals = ds?.actualCounts;
        if (!actuals) return;
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.font = "bold 12px sans-serif";
        c.textAlign = "center";
        c.textBaseline = "bottom";
        meta.data.forEach((bar, i) => {
          if (actuals[i] > Y_AXIS_CAP) {
            c.fillStyle = metricTotals[i]?.metric.color || "#333";
            c.fillText(`+${actuals[i] - Y_AXIS_CAP}`, bar.x, bar.y - 4);
          }
        });
        c.restore();
      }
    };

    // Subtle highlight + shadow on bars for depth
    const barEmbossPlugin = {
      id: "barEmboss",
      afterDatasetsDraw(ch) {
        const { ctx: c } = ch;
        const meta = ch.getDatasetMeta(0);
        if (!meta.data.length) return;
        c.save();
        meta.data.forEach((bar) => {
          const bTop = Math.min(bar.y, bar.base);
          const bBot = Math.max(bar.y, bar.base);
          const bH = bBot - bTop;
          if (bH < 2) return;
          const bL = bar.x - bar.width / 2;
          const bW = bar.width;
          const hlH = Math.min(bH * 0.3, 10);
          const hl = c.createLinearGradient(0, bTop, 0, bTop + hlH);
          hl.addColorStop(0, "rgba(255,255,255,0.30)");
          hl.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = hl;
          c.fillRect(bL, bTop, bW, hlH);
          const shH = Math.min(bH * 0.15, 5);
          const sh = c.createLinearGradient(0, bBot - shH, 0, bBot);
          sh.addColorStop(0, "rgba(0,0,0,0)");
          sh.addColorStop(1, "rgba(0,0,0,0.14)");
          c.fillStyle = sh;
          c.fillRect(bL, bBot - shH, bW, shH);
        });
        c.restore();
      }
    };

    const backgroundColors = metricTotals.map((item) => {
      const gradient = ctx.createLinearGradient(0, 160, 0, 0);
      gradient.addColorStop(0, item.metric.gradientStart);
      gradient.addColorStop(1, item.metric.gradientEnd);
      return gradient;
    });
    const borderColors = metricTotals.map((item) => item.metric.color);

    summaryChartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: metricTotals.map((item) => item.metric.name),
        datasets: [
          {
            data: cappedData.map(() => 0),
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2,
            actualCounts: cappedData.map(() => 0)
          }
        ]
      },
      plugins: [overflowLabelPlugin, barEmbossPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.2,
        animation: false,
        layout: {
          padding: { top: 20 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            padding: { top: 8, bottom: 12, left: 10, right: 10 },
            callbacks: {
              title: (items) => metricTotals[items?.[0]?.dataIndex]?.metric.name || "",
              label: (item) => {
                const actual = cappedData[item.dataIndex]?.actual ?? item.raw;
                const metric = metricTotals[item.dataIndex]?.metric;
                const desc = metric?.description || "";
                if (actual === 0) {
                  const lines = ["No issues found"];
                  if (desc) {
                    lines.push("");
                    const words = desc.split(" ");
                    let cur = "";
                    for (const w of words) {
                      if (cur && (cur + " " + w).length > 42) { lines.push(cur); cur = w; }
                      else { cur = cur ? cur + " " + w : w; }
                    }
                    if (cur) lines.push(cur);
                  }
                  return lines;
                }
                const lines = [`${actual} issue${actual === 1 ? "" : "s"} found`];
                if (desc) {
                  lines.push("");
                  const words = desc.split(" ");
                  let cur = "";
                  for (const w of words) {
                    if (cur && (cur + " " + w).length > 42) {
                      lines.push(cur);
                      cur = w;
                    } else {
                      cur = cur ? cur + " " + w : w;
                    }
                  }
                  if (cur) lines.push(cur);
                }
                return lines;
              },
              afterBody: (items) => {
                const actual = cappedData[items?.[0]?.dataIndex]?.actual ?? 0;
                return actual > 0 ? ["", "Click to see specific issues"] : [];
              }
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
          const metricId = metricTotals[idx]?.metricId;
          if (metricId && metricTotals[idx]?.count > 0 && onExpandedMetricChange) {
            const willExpand = expandedMetric !== metricId;
            onExpandedMetricChange(willExpand ? metricId : null);
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: yMax,
            ticks: { precision: 0 }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 14, weight: "700" }
            }
          }
        }
      }
    });

    // ── Stepped "fill" animation: bars count up one notch at a time ──
    const targets = cappedData.map((d) => d.display);
    const actuals = cappedData.map((d) => d.actual);
    const current = targets.map(() => 0);
    const NOTCH_MS = 156;
    let cancelled = false;

    const stepUp = () => {
      if (cancelled || !summaryChartRef.current) return;
      let allDone = true;
      for (let i = 0; i < current.length; i++) {
        if (current[i] < targets[i]) {
          current[i]++;
          allDone = false;
        }
      }
      const ds = summaryChartRef.current.data.datasets[0];
      ds.data = [...current];
      // Reveal overflow "+N" label only once bar reaches its capped display value
      ds.actualCounts = current.map((v, i) => (v >= targets[i] ? actuals[i] : v));
      summaryChartRef.current.update("none");
      if (!allDone) setTimeout(stepUp, NOTCH_MS);
    };
    setTimeout(stepUp, NOTCH_MS);

    return () => {
      cancelled = true;
      if (summaryChartRef.current) {
        summaryChartRef.current.destroy();
        summaryChartRef.current = null;
      }
    };
  }, [metricTotals, hasAnyLabels, expandedMetric, cappedData]);

  return (
    <div id="mostCommonIssuesWrap" ref={wrapRef} style={{ marginTop: "12px", padding: "0 12px" }}>
      {/* Title */}
      <div style={{ marginBottom: "8px" }}>
        <h2 className="rules-title" style={{
          margin: "0 0 4px 0",
          fontSize: "var(--fs-h3)",
          fontWeight: "700",
          color: "#2c3e50",
          lineHeight: "1.2"
        }}>
          Your focus areas
        </h2>
        <p style={{
          fontSize: "12px",
          color: "#6c757d",
          margin: 0,
          fontStyle: "italic"
        }}>
          Click a bar to see specific issues
        </p>
      </div>

      {/* Summary Chart - 4 Metric Bars */}
      <div style={{ width: "100%" }}>
        <canvas id="summaryChart" ref={summaryCanvasRef}></canvas>
      </div>

    </div>
  );
}
