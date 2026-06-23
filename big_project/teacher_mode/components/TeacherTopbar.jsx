import UserMenu from "@student/components/UserMenu";

export default function TeacherTopbar({ onRepeatTutorial, onSignOut, entitlement, onSubscribe }) {
  const isFree = entitlement?.subscription_tier === "free";
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
        <a href="/teacher_react.html" className="active" title="Upload and grade student essays">Mark</a>
        <a href="/student_react.html" title="Upload your essay for feedback">Revise</a>
        <a href="/write_react.html" title="Draft an essay with guidance">Write</a>
        <a href="/student_progress.html" title="Track your writing progress">Progress</a>
      </nav>

      <div className="actions">
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
