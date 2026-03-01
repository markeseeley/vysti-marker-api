/**
 * Parse a .docx filename to extract student name and assignment name.
 *
 * Supported patterns:
 *   "Foundation HW6 Wendi Zhou.docx" → { assignment: "Foundation 06", student: "Wendi Zhou" }
 *   "Homework 2 - Wendi Zhou.docx"   → { assignment: "Homework 02", student: "Wendi Zhou" }
 *   "HW6.docx"                       → { assignment: "Homework 06", student: "" }
 */

export function parseFilename(filename) {
  let base = filename.replace(/\.docx$/i, "").replace(/_marked$/i, "");
  base = base.replace(/[_-]/g, " ");

  const assignmentPatterns = [
    /((?:[A-Za-z]+\s+)+)(HW|Homework)\s*(\d+)/i,
    /(Foundation|Found)\s*(\d+)/i,
    /(HW|Homework)\s*(\d+)/i,
    /([A-Za-z]+)\s*(\d+)/,
  ];

  let assignmentName = "";
  let studentName = "";

  for (const pattern of assignmentPatterns) {
    const match = base.match(pattern);
    if (match) {
      const num = match[match.length - 1];
      const numPadded = num.padStart(2, "0");

      if (match.length === 4) {
        const prefix = match[1].trim();
        const hwPart = match[2];
        const hwFormatted =
          hwPart.toUpperCase() === hwPart
            ? hwPart
            : hwPart.charAt(0).toUpperCase() + hwPart.slice(1).toLowerCase();
        assignmentName = `${prefix} ${hwFormatted} ${numPadded}`;
      } else if (match.length === 3) {
        const prefix = match[1];
        const prefixFormatted =
          prefix.toUpperCase() === prefix
            ? prefix
            : prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
        assignmentName = prefixFormatted + " " + numPadded;
      }

      const beforeMatch = base.substring(0, match.index).trim();
      const afterMatch = base.substring(match.index + match[0].length).trim();

      let remaining = (beforeMatch + " " + afterMatch).trim();
      remaining = remaining.replace(/^[-–—]\s*|\s*[-–—]$/g, "").trim();
      remaining = remaining.replace(/\s*[-–—]\s*/g, " ");
      remaining = remaining.replace(/\s+/g, " ");

      if (remaining && /[A-Z]/.test(remaining)) {
        studentName = remaining;
      } else if (beforeMatch && /[A-Z]/.test(beforeMatch)) {
        studentName = beforeMatch.replace(/^[-–—]\s*|\s*[-–—]$/g, "").trim();
      } else if (afterMatch && /[A-Z]/.test(afterMatch)) {
        studentName = afterMatch.replace(/^[-–—]\s*|\s*[-–—]$/g, "").trim();
      }

      break;
    }
  }

  const numMatch = base.match(/(\d+)$/);
  if (!assignmentName && numMatch) {
    assignmentName = "Assignment " + numMatch[1].padStart(2, "0");
    const beforeNum = base.substring(0, numMatch.index).trim();
    if (beforeNum) {
      studentName = beforeNum.replace(/^[-–—]\s*|\s*[-–—]$/g, "").trim();
    }
  }

  if (assignmentName) {
    assignmentName = normalizeAssignmentName(assignmentName);
  }

  return { studentName, assignmentName };
}

export function normalizeAssignmentName(name) {
  if (!name || typeof name !== "string") return name;

  let normalized = name.trim();
  if (!normalized) return normalized;

  normalized = normalized.replace(/[_-]/g, " ");

  // "Foundation HW08" -> "Foundation 08"
  normalized = normalized.replace(
    /\b(Foundation|Found)\s+(HW|Homework)\s*(\d+)\b/gi,
    (_, _p, _hw, num) => "Foundation " + num.padStart(2, "0")
  );

  // "High Level HW08" -> "High Level 08"
  normalized = normalized.replace(
    /\b(High\s+Level)\s+(HW|Homework)\s*(\d+)\b/gi,
    (_, _p, _hw, num) => "High Level " + num.padStart(2, "0")
  );

  // "HW8" -> "Homework 08"
  normalized = normalized.replace(
    /\b(HW|Homework)\s*(\d+)\b/gi,
    (_, _hw, num) => "Homework " + num.padStart(2, "0")
  );

  // "Foundation 8" -> "Foundation 08"
  normalized = normalized.replace(
    /\b(Foundation|Found)\s+(\d+)\b/gi,
    (_, _p, num) => "Foundation " + num.padStart(2, "0")
  );

  // "High Level 8" -> "High Level 08"
  normalized = normalized.replace(
    /\b(High\s+Level)\s+(\d+)\b/gi,
    (_, _p, num) => "High Level " + num.padStart(2, "0")
  );

  // Zero-pad any remaining single-digit numbers
  normalized = normalized.replace(
    /\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)\b/g,
    (match, prefix, num) => {
      if (num.length >= 2) return match;
      return prefix + " " + num.padStart(2, "0");
    }
  );

  return normalized.trim();
}

export function hasTrailingNumber(s) {
  return /\d+\s*$/.test((s || "").trim());
}

export function isValidAssignmentName(name) {
  if (!name || typeof name !== "string") return false;
  return hasTrailingNumber(name);
}
