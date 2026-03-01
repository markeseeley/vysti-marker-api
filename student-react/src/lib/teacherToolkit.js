/**
 * Teacher Toolkit Registry
 *
 * Defines all available marking tools for the teacher preview toolbar
 * and SelectionPopover. Teachers can toggle tools on/off; preferences
 * persist in localStorage.
 *
 * Formatting tools (Tab, Italic, Center, Undo) and action tools
 * (Refocus, Recheck, Save, Download) are always visible and not
 * part of this customizable registry.
 */

export const MARKING_TOOLS = [
  { id: "aqua",      label: "Aqua highlight",     category: "highlight", swatch: "#00D2FF" },
  { id: "gray",      label: "Gray highlight",      category: "highlight", swatch: "#9CA3AF" },
  { id: "green",     label: "Green highlight",     category: "positive",  swatch: "#22C55E" },
  { id: "strike",    label: "Strikethrough",       category: "highlight", swatch: "#EF4444", strike: true },
  { id: "underline", label: "Underline (solid)",   category: "mark",      icon: "U\u0332" },
  { id: "sp",        label: "Spelling (sp)",       category: "mark",      icon: "sp" },
  { id: "wc",        label: "Word choice (wc)",    category: "mark",      icon: "wc" },
  { id: "squiggly",  label: "Squiggly underline",  category: "mark",      icon: "\u3030" },
  { id: "confusion", label: "Confusion (???)",     category: "mark",      icon: "???" },
  { id: "smile",     label: "Nice work (\u263A)",  category: "positive",  icon: "\u263A" },
  { id: "frown",     label: "Needs work (\u2639)", category: "negative",  icon: "\u2639" },
  { id: "customSup", label: "Custom label",        category: "mark",      icon: "A\u02E3" },
  { id: "taggedHighlight", label: "Highlight + label", category: "highlight", swatch: "#FBBF24", icon: "T" },
  { id: "comment",   label: "Comment",             category: "comment",   icon: "\u270E" },
  { id: "stamps",    label: "Quick stamps",        category: "comment",   icon: "\u2605" },
  { id: "inlineStamps", label: "Inline stamps",    category: "comment",   icon: "\u25B6" },
  { id: "arrow",     label: "Arrow (\u2192)",       category: "mark",      icon: "\u2192" },
  { id: "remove",    label: "Remove mark",         category: "utility",   icon: "\u2715" },
];

export const DEFAULT_ENABLED = [
  "aqua", "gray", "green", "strike", "underline", "sp", "wc", "squiggly", "confusion",
  "customSup", "smile", "frown", "taggedHighlight", "comment", "stamps", "inlineStamps", "arrow", "remove",
];

const TOOLKIT_KEY = "vysti:teacher-toolkit";

function makeKey(userId) {
  return `${TOOLKIT_KEY}:${userId || "anon"}`;
}

export function saveToolkitPrefs(userId, enabledTools) {
  try {
    // Store enabled tools + all known tool IDs at save time.
    // This lets us detect genuinely new tools on load vs deliberately unchecked.
    const allIds = MARKING_TOOLS.map((t) => t.id);
    localStorage.setItem(makeKey(userId), JSON.stringify({ enabled: enabledTools, knownIds: allIds }));
  } catch {}
}

export function loadToolkitPrefs(userId) {
  try {
    const raw = localStorage.getItem(makeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Legacy format: plain array (no knownIds)
    if (Array.isArray(parsed)) {
      // Migrate: treat all current MARKING_TOOLS not in the array as new
      const savedSet = new Set(parsed);
      const newTools = DEFAULT_ENABLED.filter((id) => !savedSet.has(id));
      return [...parsed, ...newTools];
    }

    // Current format: { enabled, knownIds }
    if (!parsed?.enabled) return null;
    const enabled = parsed.enabled;
    const knownAtSave = new Set(parsed.knownIds || []);

    // Auto-enable tools that are in DEFAULT_ENABLED but weren't known at save time
    const newTools = DEFAULT_ENABLED.filter((id) => !knownAtSave.has(id));
    if (newTools.length > 0) {
      return [...enabled, ...newTools];
    }

    return enabled;
  } catch {
    return null;
  }
}
