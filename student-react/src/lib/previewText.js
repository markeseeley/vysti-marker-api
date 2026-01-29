const SKIP_HEADERS = new Set(["Issue", "Explanation", "Issue Explanation"]);

function removeArtifacts(node) {
  const selectors = [
    ".issue-label",
    ".issue-marker",
    ".issue-popover",
    ".vysti-issue",
    ".vysti-issue-label",
    ".vysti-highlight",
    ".highlight",
    ".strike"
  ];
  selectors.forEach((selector) => {
    node.querySelectorAll(selector).forEach((el) => el.remove());
  });

  node.querySelectorAll("span,a").forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (text.startsWith("→")) {
      el.remove();
    }
  });
}

export function extractCleanTextFromElement(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  removeArtifacts(clone);
  return (clone.innerText || "").replace(/\s+/g, " ").trim();
}

export function extractPreviewText(containerEl) {
  if (!containerEl) return "";
  const candidates = Array.from(containerEl.querySelectorAll("p, li")).filter(
    (el) => !el.closest("table") && !el.closest(".docx-table")
  );

  const paragraphs = candidates
    .map((el) => extractCleanTextFromElement(el))
    .filter((text) => text && !SKIP_HEADERS.has(text));

  if (paragraphs.length) {
    return paragraphs.join("\n\n");
  }

  return (containerEl.innerText || "").replace(/\s+/g, " ").trim();
}
