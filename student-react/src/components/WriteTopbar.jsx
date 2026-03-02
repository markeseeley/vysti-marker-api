import KeepWorkingMenu from "./KeepWorkingMenu";
import UserMenu from "./UserMenu";

export default function WriteTopbar({ onRepeatTutorial, onSignOut, onDownload, canDownload, onSave, saveState, canSave, keepWorkingItems, products }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.svg" alt="Vysti" />
      </div>

      <nav>
        {products?.has_mark
          ? <a href="/teacher_react.html" title="Upload and grade student essays">Mark</a>
          : <a className="disabled upgrade" title="Upgrade to unlock Mark" onClick={() => window.location.assign("/profile_react.html?upgrade=mark")}>Mark</a>}
        {products?.has_revise
          ? <a href="/student_react.html" title="Upload your essay for feedback">Revise</a>
          : <a className="disabled upgrade" title="Upgrade to unlock Revise" onClick={() => window.location.assign("/profile_react.html?upgrade=revise")}>Revise</a>}
        <a href="/write_react.html" className="active" title="Draft an essay with guidance">Write</a>
        <a href="/student_progress.html" title="Track your writing progress">Progress</a>
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
            className="topbar-btn"
            type="button"
            title="Download your essay as a Word document"
            onClick={onDownload}
            disabled={!canDownload}
          >
            Download .docx
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
