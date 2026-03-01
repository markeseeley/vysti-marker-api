/**
 * Generates a downloadable PDF report from essay marking data.
 * Brand-aligned: Vysti logo top-left, clean typography, proper spacing.
 *
 * Fonts: times bold = section headings / score (Source Serif proxy),
 *        helvetica = all body copy (DM Sans proxy).
 *
 * Pure function — no React dependencies. Receives data, returns a Blob.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  CONCISION_LABELS,
  CLARITY_LABELS,
  CONVENTIONS_LABELS,
  DEVELOPMENT_LABELS,
  PARAGRAPH_LABELS,
  TRANSITION_LABELS
} from "./studentMetrics";

import { getLabelMetric, METRICS } from "./labelToMetric";
import { GILL_SANS_REGULAR, GILL_SANS_BOLD } from "./reportFonts";

// ── Font registration ───────────────────────────────────────────────
// Gill Sans MT (regular + bold) embedded as base64 TTF.
// Registered once per jsPDF instance in generateReportPdf().
const FONT_BODY = "GillSansMT"; // font family name for jsPDF
const FONT_HEADING = "GillSansMT"; // same family, bold weight for headers

// ── Layout constants ────────────────────────────────────────────────
const ML = 20; // left margin
const MR = 20; // right margin
const PAGE_W = 210; // A4 width
const CONTENT_W = PAGE_W - ML - MR; // 170mm usable
const RIGHT_EDGE = PAGE_W - MR; // 190mm
const FOOTER_Y = 284;
const CONTENT_BOTTOM = FOOTER_Y - 8; // safe content zone

// ── Brand constants ─────────────────────────────────────────────────
const MAROON = [169, 13, 34]; // #A90D22
const BLACK = [17, 17, 17]; // #111
const MUTED = [120, 120, 120];
const LIGHT_GRAY = [230, 230, 230];
const DIVIDER = [210, 210, 210];
const WHITE = [255, 255, 255];

const METRIC_COLORS = {
  power: [220, 53, 69],
  variety: [13, 110, 253],
  cohesion: [25, 135, 84],
  precision: [212, 160, 0]
};

const METRIC_ORDER = ["power", "variety", "cohesion", "precision"];

// ── Helpers ─────────────────────────────────────────────────────────

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

function computeOverallScore(metrics, mode, _totalIssues, wordCount) {
  if (!metrics) return null;
  const hideCohesion = mode === "peel_paragraph";
  const scores = [
    metrics.power?.score,
    metrics.variety?.score,
    hideCohesion ? null : metrics.cohesion?.score,
    metrics.precision?.score
  ].filter((s) => s != null);
  if (!scores.length) return null;
  const rawAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
  const words = wordCount || 0;
  const lengthPenalty =
    words > 0 && words < 400 ? Math.round((400 - words) * 0.03) : 0;
  const raw = Math.max(0, rawAverage - lengthPenalty);
  return Math.round(Math.sqrt(raw / 100) * 100);
}

function getMetricSubLine(key, m) {
  const d = m?.details || {};
  switch (key) {
    case "power":
      return `Weak verbs: ${d.weakCount ?? 0}  \u00b7  Power verbs: ${d.powerCount ?? 0}/${d.powerTarget ?? 0}`;
    case "variety": {
      const bpc = d.bodyParagraphCount ?? 0;
      return `Paragraphs: ${bpc}  \u00b7  Techniques: ${d.techniqueOkCount ?? 0}/${bpc}  \u00b7  Evidence: ${d.evidenceDevOkCount ?? 0}/${bpc}`;
    }
    case "cohesion":
      return `Sent. links: ${d.sentenceBoundaryHits ?? 0}/${d.sentenceBoundaryDenom ?? 0}  \u00b7  Para. links: ${d.paragraphBoundaryHits ?? 0}/${d.paragraphBoundaryDenom ?? 0}  \u00b7  Transitions: ${d.transitionsWithinUnique ?? 0}`;
    case "precision":
      return `Concision: ${d.concisionCount ?? 0}  \u00b7  Clarity: ${d.clarityCount ?? 0}  \u00b7  Conventions: ${d.conventionsCount ?? 0}`;
    default:
      return "";
  }
}

/** Ensure enough vertical room; add a page if not. */
function ensureSpace(doc, y, needed, logoDataUrl) {
  if (y + needed > CONTENT_BOTTOM) {
    doc.addPage();
    return addPageHeader(doc, logoDataUrl);
  }
  return y;
}

function roundedRect(doc, x, y, w, h, r) {
  doc.roundedRect(x, y, w, h, r, r, "F");
}

// ── Logo loader (cached) ────────────────────────────────────────────
let _logoCache = null;

async function loadLogo() {
  if (_logoCache) return _logoCache;
  try {
    const res = await fetch("/assets/logo_black.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _logoCache = reader.result;
        resolve(_logoCache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Page top margin (no header logo — logo is in the footer now) ────

function addPageHeader(doc, _logoDataUrl) {
  return 16; // simple top margin for content on new pages
}

// ── Section renderers ───────────────────────────────────────────────

function renderTitleBlock(doc, y, opts) {
  // "Writing Report" — black, large, serif, centered
  doc.setFontSize(24);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text("Writing Report", PAGE_W / 2, y, { align: "center" });
  y += 10;

  // Student info line — single centered line, muted
  doc.setFontSize(9);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...MUTED);

  const infoParts = [];
  if (opts.studentName) infoParts.push(opts.studentName);
  infoParts.push(truncate(opts.fileName, 40));
  if (opts.assignmentName) infoParts.push(opts.assignmentName);
  infoParts.push(opts.modeLabel);
  infoParts.push(opts.date);
  infoParts.push(`${opts.wordCount ?? "\u2014"} words`);

  doc.text(infoParts.join("  \u00b7  "), PAGE_W / 2, y, { align: "center" });
  y += 10;

  return y;
}

function renderScoreAndMetrics(doc, y, opts, logoDataUrl) {
  const hideCohesion = opts.mode === "peel_paragraph";
  const visibleMetrics = METRIC_ORDER.filter(
    (k) => !(k === "cohesion" && hideCohesion)
  );

  // Two-column layout: meters left, score right
  const COL_GAP = 10;
  const LEFT_W = 100; // left column width for meters
  const RIGHT_X = ML + LEFT_W + COL_GAP; // right column start
  const RIGHT_W = CONTENT_W - LEFT_W - COL_GAP; // right column width

  // Estimate total height needed for meters
  const meterBlockH = visibleMetrics.length * 18 + 4;
  y = ensureSpace(doc, y, Math.max(meterBlockH, 50), logoDataUrl);

  const blockTopY = y;

  // ── Left column: metric bars (smaller) ──
  const barH = 3.5;
  const barW = LEFT_W;

  visibleMetrics.forEach((key) => {
    const m = opts.metrics?.[key];
    const score = m?.score ?? 0;
    const [r, g, b] = METRIC_COLORS[key];
    const metricDef = METRICS[key];
    const name = metricDef?.name || key;

    // Metric name + score on same line
    doc.setFontSize(9.5);
    doc.setFont(FONT_BODY, "bold");
    doc.setTextColor(...BLACK);
    doc.text(name, ML, y);

    doc.setFontSize(9.5);
    doc.setFont(FONT_BODY, "bold");
    doc.setTextColor(r, g, b);
    doc.text(`${score}`, ML + LEFT_W, y, { align: "right" });

    y += 3;

    // Bar background
    doc.setFillColor(...LIGHT_GRAY);
    roundedRect(doc, ML, y, barW, barH, 1.5);

    // Filled portion
    if (score > 0) {
      doc.setFillColor(r, g, b);
      roundedRect(doc, ML, y, Math.max(3, barW * (score / 100)), barH, 1.5);
    }

    y += barH + 2;

    // Sub-detail line
    const subLine = getMetricSubLine(key, m);
    if (subLine) {
      doc.setFontSize(6.5);
      doc.setFont(FONT_BODY, "normal");
      doc.setTextColor(...MUTED);
      doc.text(subLine, ML, y);
      y += 2.5;
    }

    y += 4; // breathing room between metrics
  });

  const metersBottomY = y;

  // ── Right column: Score (vertically centered) ──
  const overall = computeOverallScore(
    opts.metrics,
    opts.mode,
    opts.totalIssues,
    opts.wordCount
  );

  const scoreText = overall != null ? `Score ${overall}%` : "Score \u2014";
  const scoreCenterY = blockTopY + (metersBottomY - blockTopY) / 2;
  const scoreMidX = RIGHT_X + RIGHT_W / 2;

  // Large bold score
  doc.setFontSize(32);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text(scoreText, scoreMidX, scoreCenterY - 4, { align: "center" });

  // Issue density subtitle
  const density =
    opts.wordCount > 0
      ? ((opts.totalIssues / opts.wordCount) * 100).toFixed(1)
      : "N/A";
  doc.setFontSize(7.5);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...MUTED);
  doc.text(
    `${opts.totalIssues} issues in ${opts.wordCount ?? 0} words`,
    scoreMidX,
    scoreCenterY + 6,
    { align: "center" }
  );
  doc.text(
    `${density} issues per 100 words`,
    scoreMidX,
    scoreCenterY + 10,
    { align: "center" }
  );

  doc.setTextColor(...BLACK);

  y = metersBottomY + 8;
  return y;
}

// ── Strengths ───────────────────────────────────────────────────────

function gatherStrengths(opts) {
  const strengths = [];
  const hideCohesion = opts.mode === "peel_paragraph";
  const metrics = opts.metrics || {};

  const pd = metrics.power?.details || {};
  if ((pd.weakCount ?? 99) === 0) {
    strengths.push("No weak verbs detected \u2014 strong verb choices throughout.");
  } else if ((pd.powerCount ?? 0) >= (pd.powerTarget ?? 999)) {
    strengths.push(
      `Met the power verb target (${pd.powerCount}/${pd.powerTarget}).`
    );
  }

  const vd = metrics.variety?.details || {};
  const bpc = vd.bodyParagraphCount ?? 0;
  if (bpc > 0 && (vd.techniqueOkCount ?? 0) === bpc) {
    strengths.push("Every body paragraph uses a rhetorical or literary technique.");
  }
  if (bpc > 0 && (vd.evidenceDevOkCount ?? 0) === bpc) {
    strengths.push("Evidence and development present in every body paragraph.");
  }
  if ((vd.weakStartCount ?? 99) === 0) {
    strengths.push("No weak sentence starts \u2014 varied sentence openings.");
  }

  if (!hideCohesion) {
    const cd = metrics.cohesion?.details || {};
    if ((cd.criticalCohesionCount ?? 99) === 0) {
      strengths.push("No critical cohesion issues \u2014 essay organization is solid.");
    }
  }

  const prd = metrics.precision?.details || {};
  if (
    (prd.concisionCount ?? 99) === 0 &&
    (prd.clarityCount ?? 99) === 0 &&
    (prd.conventionsCount ?? 99) === 0
  ) {
    strengths.push("Precision is flawless \u2014 no concision, clarity, or convention issues.");
  }

  METRIC_ORDER.forEach((key) => {
    if (key === "cohesion" && hideCohesion) return;
    const score = metrics[key]?.score ?? 0;
    if (score >= 90 && !strengths.some((s) => s.includes(METRICS[key]?.name))) {
      strengths.push(`${METRICS[key]?.name || key} score of ${score} \u2014 excellent work.`);
    }
  });

  return strengths;
}

function renderStrengths(doc, y, opts, logoDataUrl) {
  const strengths = gatherStrengths(opts);
  if (!strengths.length) return y;

  y = ensureSpace(doc, y, 14 + strengths.length * 5, logoDataUrl);

  doc.setFontSize(13);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text("Strengths", ML, y);
  y += 7;

  doc.setFontSize(8.5);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...BLACK);

  strengths.forEach((s) => {
    y = ensureSpace(doc, y, 6, logoDataUrl);
    doc.text(`\u2713  ${s}`, ML + 2, y);
    y += 5;
  });

  doc.setTextColor(...BLACK);
  y += 4;
  return y;
}

// ── Top Issues ──────────────────────────────────────────────────────

function renderTopIssues(doc, y, opts, logoDataUrl) {
  y = ensureSpace(doc, y, 40, logoDataUrl);

  doc.setFontSize(13);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text("Top Issues", ML, y);
  y += 7;

  const sorted = Object.entries(opts.labelCounts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!sorted.length) {
    doc.setFontSize(9);
    doc.setFont(FONT_BODY, "normal");
    doc.setTextColor(...MUTED);
    doc.text("No issues detected.", ML, y);
    doc.setTextColor(...BLACK);
    return y + 8;
  }

  const tableData = sorted.map(([label, count]) => {
    const metric = getLabelMetric(label);
    const example = (opts.issues || []).find(
      (iss) =>
        (iss?.label || "").trim().toLowerCase() === label.trim().toLowerCase()
    );
    // Use shared (generalized) label for user-facing PDF to protect IP
    const sharedLabel = example?.shared_issue || label;
    const sentence = example?.sentence || "";
    return [sharedLabel, METRICS[metric]?.name || "\u2014", String(count), sentence || "\u2014"];
  });

  autoTable(doc, {
    startY: y,
    head: [["Rule", "Metric", "Issue Count", "Example from essay"]],
    body: tableData,
    theme: "grid",
    styles: { font: FONT_BODY },
    headStyles: {
      fillColor: MAROON,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BLACK,
      cellPadding: 2.5
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: "auto", textColor: MUTED, overflow: "linebreak" }
    },
    margin: { left: ML, right: MR },
    tableWidth: CONTENT_W
  });

  return doc.lastAutoTable.finalY + 10;
}

// ── Next Steps ──────────────────────────────────────────────────────

const NEXT_STEP_TIPS = {
  "weak verb": "Consider using more precise vocabulary to strengthen your analysis.",
  "power verb": "Explore stronger word choices to sharpen your argument.",
  "floating quotation": "Ensure all evidence is properly introduced and integrated.",
  "follow the process for inserting evidence": "Review how evidence is introduced in your paragraphs.",
  "explain the significance of evidence": "Develop your analysis of the evidence you present.",
  technique: "Consider incorporating more analytical techniques in your body paragraphs.",
  "weak start": "Vary how your sentences begin for more dynamic prose.",
  "off-topic": "Review each paragraph to ensure it connects to your central argument.",
  thesis: "Review the clarity and specificity of your thesis statement.",
  "topic sentence": "Ensure each paragraph opens with a clear guiding sentence.",
  transition: "Strengthen connections between your paragraphs.",
  boundary: "Add linking sentences at paragraph transitions.",
  contraction: "Review language formality in your essay.",
  pronoun: "Check that all pronoun references are clear.",
  "i', 'we": "Review the point of view used in your essay.",
  which: "Review sentence structure for clarity.",
  audience: "Review how you address your reader.",
  "parenthetical citation": "Include proper citations after quotations."
};

function getNextSteps(opts) {
  const sorted = Object.entries(opts.labelCounts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const steps = [];
  const usedTips = new Set();

  for (const [label] of sorted) {
    if (steps.length >= 3) break;
    const labelLower = label.toLowerCase();

    for (const [keyword, tip] of Object.entries(NEXT_STEP_TIPS)) {
      if (usedTips.has(keyword)) continue;
      if (labelLower.includes(keyword)) {
        steps.push({ label, tip });
        usedTips.add(keyword);
        break;
      }
    }
  }

  return steps;
}

function renderNextSteps(doc, y, opts, logoDataUrl) {
  const steps = getNextSteps(opts);
  if (!steps.length) return y;

  y = ensureSpace(doc, y, 25 + steps.length * 16, logoDataUrl);

  doc.setFontSize(13);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text("Next Steps", ML, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...MUTED);
  doc.text("Focus on these areas in your next revision:", ML, y + 3);
  y += 10;

  steps.forEach((step, i) => {
    y = ensureSpace(doc, y, 16, logoDataUrl);

    // Number badge
    doc.setFillColor(...MAROON);
    doc.circle(ML + 4, y - 1, 2.5, "F");
    doc.setFontSize(8);
    doc.setFont(FONT_BODY, "bold");
    doc.setTextColor(...WHITE);
    doc.text(String(i + 1), ML + 4, y, { align: "center" });

    // Label
    doc.setFontSize(9);
    doc.setFont(FONT_BODY, "bold");
    doc.setTextColor(...BLACK);
    doc.text(truncate(step.label, 70), ML + 10, y);
    y += 5;

    // Tip text (wrapped)
    doc.setFontSize(8);
    doc.setFont(FONT_BODY, "normal");
    doc.setTextColor(...MUTED);
    const tipLines = doc.splitTextToSize(step.tip, CONTENT_W - 10);
    tipLines.forEach((line) => {
      y = ensureSpace(doc, y, 5, logoDataUrl);
      doc.text(line, ML + 10, y);
      y += 4;
    });
    y += 4;
  });

  doc.setTextColor(...BLACK);
  return y;
}

// ── Rule Checklist ──────────────────────────────────────────────────

function renderRuleChecklist(doc, y, opts, logoDataUrl) {
  y = ensureSpace(doc, y, 30, logoDataUrl);

  doc.setFontSize(13);
  doc.setFont(FONT_HEADING, "bold");
  doc.setTextColor(...BLACK);
  doc.text("Rule Checklist", ML, y);
  y += 8;

  const ALL_KNOWN = [
    ...CONCISION_LABELS,
    ...CLARITY_LABELS,
    ...CONVENTIONS_LABELS,
    ...DEVELOPMENT_LABELS,
    ...PARAGRAPH_LABELS,
    ...TRANSITION_LABELS
  ];
  const allLabels = [
    ...new Set([...ALL_KNOWN, ...Object.keys(opts.labelCounts || {})])
  ];

  const grouped = {
    power: [],
    variety: [],
    cohesion: [],
    precision: [],
    other: []
  };
  allLabels.forEach((label) => {
    const metric = getLabelMetric(label);
    const count = Number(opts.labelCounts?.[label]) || 0;
    // Only include broken rules (count > 0)
    if (count > 0) {
      grouped[metric].push({ label, count });
    }
  });

  const hideCohesion = opts.mode === "peel_paragraph";
  const groupOrder = ["power", "variety", "cohesion", "precision", "other"];

  // Fixed column widths so all tables are identical
  const COL_COUNT = 26;
  const COL_RULE = CONTENT_W - COL_COUNT;

  groupOrder.forEach((metricKey) => {
    if (metricKey === "cohesion" && hideCohesion) return;
    const items = grouped[metricKey];
    if (!items.length) return;

    y = ensureSpace(doc, y, 20, logoDataUrl);

    const [mr, mg, mb] = METRIC_COLORS[metricKey] || [108, 117, 125];
    doc.setFontSize(10);
    doc.setFont(FONT_BODY, "bold");
    doc.setTextColor(mr, mg, mb);
    doc.text(METRICS[metricKey]?.name || metricKey, ML, y);
    doc.setTextColor(...BLACK);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Rule", "Issue Count"]],
      body: items.map((item) => [
        item.shared_issue || item.label,
        String(item.count)
      ]),
      theme: "plain",
      styles: { font: FONT_BODY },
      headStyles: {
        fillColor: MAROON,
        textColor: WHITE,
        fontSize: 7.5,
        fontStyle: "bold",
        cellPadding: 2.5
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: BLACK,
        cellPadding: 2
      },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      columnStyles: {
        0: { cellWidth: COL_RULE },
        1: { cellWidth: COL_COUNT, halign: "center" }
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === "body") {
          const count = parseInt(data.cell.raw, 10);
          if (count > 0) {
            data.cell.styles.textColor = [220, 53, 69];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: ML, right: MR },
      tableWidth: CONTENT_W
    });

    y = doc.lastAutoTable.finalY + 6;
  });

  return y;
}

// ── Footer + header on every page ───────────────────────────────────

function addHeadersAndFooters(doc, logoDataUrl) {
  const totalPages = doc.internal.getNumberOfPages();
  const logoW = 18 * 1.15; // 15% larger
  const logoH = logoW * (2304 / 3456);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer: thin line + logo + page number
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(ML, FOOTER_Y, RIGHT_EDGE, FOOTER_Y);
    doc.setLineWidth(0.2);

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", ML, FOOTER_Y + 0.5, logoW, logoH);
    }

    doc.setFontSize(7.5);
    doc.setFont(FONT_BODY, "normal");
    doc.setTextColor(...MUTED);
    doc.text(`${i} / ${totalPages}`, RIGHT_EDGE, FOOTER_Y + 5, { align: "right" });
    doc.setTextColor(...BLACK);
  }
}

// ── Main export ─────────────────────────────────────────────────────

/**
 * Generate a PDF report from marking data.
 * @param {object} opts
 * @param {object} opts.metrics
 * @param {object} opts.labelCounts
 * @param {Array}  opts.issues
 * @param {number} opts.wordCount
 * @param {number} opts.totalIssues
 * @param {string} opts.mode
 * @param {string} opts.modeLabel
 * @param {string} opts.fileName
 * @param {string} [opts.studentName]
 * @param {string} [opts.assignmentName]
 * @param {string} opts.date
 * @returns {Promise<Blob>}
 */
export async function generateReportPdf(opts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Register Gill Sans MT (regular + bold) from embedded base64 TTF
  doc.addFileToVFS("GillSansMT-Regular.ttf", GILL_SANS_REGULAR);
  doc.addFont("GillSansMT-Regular.ttf", FONT_BODY, "normal");
  doc.addFileToVFS("GillSansMT-Bold.ttf", GILL_SANS_BOLD);
  doc.addFont("GillSansMT-Bold.ttf", FONT_HEADING, "bold");

  const logoDataUrl = await loadLogo();

  // Page 1: header + title + two-column (meters | score)
  let y = addPageHeader(doc, logoDataUrl);
  y = renderTitleBlock(doc, y, opts);
  y = renderScoreAndMetrics(doc, y, opts, logoDataUrl);
  y = renderStrengths(doc, y, opts, logoDataUrl);
  y = renderTopIssues(doc, y, opts, logoDataUrl);
  y = renderNextSteps(doc, y, opts, logoDataUrl);
  y = renderRuleChecklist(doc, y, opts, logoDataUrl);

  addHeadersAndFooters(doc, logoDataUrl);

  return doc.output("blob");
}