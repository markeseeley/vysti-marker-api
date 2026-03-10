import KeepWorkingMenu from "./KeepWorkingMenu";
import UserMenu from "./UserMenu";

export default function TeacherTopbar({
  onRepeatTutorial,
  onSignOut,
  pendingRestore,
  onResumeSession,
  onDismissSession,
  keepWorkingItems,
  products,
  entitlement,
  onSubscribe,
}) {
  const isFree = entitlement?.subscription_tier === "free";
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.svg" alt="Vysti" />
      </div>

      <nav>
        <a href="/teacher_react.html" className="active" title="Upload and grade student essays">Mark</a>
        {products?.has_revise
          ? <a href="/student_react.html" title="Upload your essay for feedback">Revise</a>
          : <a className="disabled upgrade" title="Upgrade to unlock Revise" onClick={() => window.location.assign("/profile_react.html?upgrade=revise")}>Revise</a>}
        <a className="disabled" title="Coming soon..." aria-disabled="true">Write</a>
        <a href="/student_progress.html" title="Track your writing progress">Progress</a>
      </nav>

      <div className="actions">
        {pendingRestore && onResumeSession && (
          <div className="session-restore-wrap">
            <button
              className="topbar-btn resume-session-btn"
              type="button"
              title="Resume your previous marking session"
              onClick={onResumeSession}
            >
              Resume session ({pendingRestore.fileCount} doc{pendingRestore.fileCount === 1 ? "" : "s"})
            </button>
            <button
              className="iconbtn dismiss-session-btn"
              type="button"
              title="Discard saved session"
              aria-label="Discard saved session"
              onClick={onDismissSession}
            >
              &times;
            </button>
          </div>
        )}
        <KeepWorkingMenu items={keepWorkingItems} />
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
