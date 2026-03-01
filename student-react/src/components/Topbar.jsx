import { useMemo } from "react";
import KeepWorkingMenu from "./KeepWorkingMenu";
import UserMenu from "./UserMenu";

function truncateFileName(name, max = 28) {
  if (!name || name.length <= max) return name || "Untitled";
  return name.slice(0, max - 1) + "\u2026";
}

const MAX_DROPDOWN_DRAFTS = 5;

export default function Topbar({ onRepeatTutorial, onSignOut, pendingSavedDrafts, onKeepWorking, keepWorkingItems }) {
  const drafts = Array.isArray(pendingSavedDrafts) ? pendingSavedDrafts : [];
  const crossApp = Array.isArray(keepWorkingItems) ? keepWorkingItems : [];

  // Combine cross-app items (Mark, Write) with Revise drafts into a single list
  const combinedItems = useMemo(() => {
    const items = [...crossApp];
    const visible = drafts.slice(0, MAX_DROPDOWN_DRAFTS);
    for (const d of visible) {
      items.push({
        mode: "revise",
        label: "Revise",
        sublabel: truncateFileName(d.fileName),
        time: d.savedAt,
        onClick: () => onKeepWorking?.(d),
      });
    }
    return items;
  }, [crossApp, drafts, onKeepWorking]);

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.svg" alt="Vysti" />
      </div>

      <nav>
        <a href="/teacher_react.html" title="Upload and grade student essays">Mark</a>
        <a href="/student_react.html" className="active" title="Upload your essay for feedback">Revise</a>
        <a className="disabled" title="Coming soon..." aria-disabled="true">Write</a>
        <a href="/student_progress.html" title="Track your writing progress">Progress</a>
      </nav>

      <div className="actions">
        <KeepWorkingMenu items={combinedItems} />
        <button
          className="iconbtn"
          type="button"
          aria-label="Repeat tutorial"
          title="Repeat the tutorial"
          onClick={onRepeatTutorial}
        >
          ?
        </button>
        <UserMenu onSignOut={onSignOut} />
      </div>
    </header>
  );
}
