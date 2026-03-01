function splitText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function extractPreviewText(containerEl) {
  if (!containerEl) return null;

  const nodes = Array.from(containerEl.querySelectorAll("p, li"));
  const parts = [];

  for (const node of nodes) {
    if (node.closest("table, .docx-table")) continue;
    const text = node.innerText || node.textContent || "";
    const lines = splitText(text);
    if (lines.length === 0) continue;
    parts.push(lines.join("\n"));
  }

  if (parts.length === 0) return null;
  return parts.join("\n\n");
}
