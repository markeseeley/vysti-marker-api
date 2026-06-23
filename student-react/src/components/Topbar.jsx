import { useMemo } from "react";
import KeepWorkingMenu from "./KeepWorkingMenu";
import UserMenu from "./UserMenu";

function truncateFileName(name, max = 28) {
  if (!name || name.length <= max) return name || "Untitled";
  return name.slice(0, max - 1) + "\u2026";
}

const MAX_DROPDOWN_DRAFTS = 5;

export default function Topbar({ onRepeatTutorial, onSignOut, pendingSavedDrafts, onKeepWorking, keepWorkingItems, entitlement, onSubscribe }) {
  const isFree = entitlement?.subscription_tier === "free";
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
      <a
        className="brand brand-link"
        href="https://www.vysti.org"
        target="_blank"
        rel="noopener noreferrer"
        title="Open vysti.org in a new tab"
        aria-label="Open vysti.org in a new tab"
      >
        <img src="/assets/logo.svg" alt="Vysti" />
      </a>

      <nav>
        <a href="/mark" title="Upload and grade student essays">Mark</a>
        <a href="/revise" className="active" title="Upload your essay for feedback">Revise</a>
        <a href="/write" title="Draft an essay with guidance">Write</a>
        <a href="/progress" title="Track your writing progress">Progress</a>
      </nav>

      <div className="actions">
        <KeepWorkingMenu items={combinedItems} />
        {isFree && onSubscribe && (
          <button
            className="topbar-btn subscribe-btn"
            type="button"
            onClick={onSubscribe}
          >
            Subscribe
          </button>
        )}
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
