import KeepWorkingMenu from "./KeepWorkingMenu";
import UserMenu from "./UserMenu";

export default function WriteTopbar({ onRepeatTutorial, onSignOut, onDownload, canDownload, downloadState, downloadError, onSave, saveState, canSave, keepWorkingItems, products }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.svg" alt="Vysti" />
      </div>

      <nav>
        {products?.has_mark
          ? <a href="/mark" title="Upload and grade student essays">Mark</a>
          : <a className="disabled upgrade" title="Upgrade to unlock Mark" onClick={() => window.location.assign("/profile?upgrade=mark")}>Mark</a>}
        {products?.has_revise
          ? <a href="/revise" title="Upload your essay for feedback">Revise</a>
          : <a className="disabled upgrade" title="Upgrade to unlock Revise" onClick={() => window.location.assign("/profile?upgrade=revise")}>Revise</a>}
        <a href="/write" className="active" title="Draft an essay with guidance">Write</a>
        <a href="/progress" title="Track your writing progress">Progress</a>
      </nav>

      <div className="actions">
        <KeepWorkingMenu items={keepWorkingItems} />
        {onSave && (
          <button
            className={`topbar-btn write-save-btn${saveState === "saved" ? " save-success" : ""}`}
            type="button"
            title="Save your draft"
            disabled={!canSave || saveState === "saving"}
            onClick={onSave}
          >
            {saveState === "saving" ? "Saving\u2026" : saveState === "saved" ? "Saved!" : "Save"}
          </button>
        )}
        {onDownload ? (
          <button
            className={`topbar-btn${downloadState === "failed" ? " download-failed" : ""}${downloadState === "downloaded" ? " download-success" : ""}`}
            type="button"
            title={downloadError || (downloadState === "preparing" ? "Preparing your download…" : "Download your essay as a Word document")}
            onClick={onDownload}
            disabled={!canDownload || downloadState === "preparing" || downloadState === "downloaded"}
          >
            {downloadState === "preparing"
              ? "Preparing…"
              : downloadState === "downloaded"
                ? "Downloaded ✓"
                : downloadState === "failed"
                  ? "Download failed"
                  : "Download"}
          </button>
        ) : null}
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
