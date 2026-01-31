export default function Topbar({
  onProgress,
  onTeacher,
  onRepeatTutorial,
  onSignOut,
  onBackToClassic,
  onSwitchToReact,
  showReactSwitch
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.svg" alt="Vysti" />
      </div>

      <nav></nav>

      <div className="actions">
        <div className="ph-badge">Project Headache ✅</div>
        <button className="topbar-btn" type="button" onClick={onBackToClassic}>
          Back to classic
        </button>
        {showReactSwitch ? (
          <button className="topbar-btn" type="button" onClick={onSwitchToReact}>
            Switch to React (beta)
          </button>
        ) : null}
        <button className="topbar-btn" type="button" onClick={onProgress}>
          Progress
        </button>
        <button className="topbar-btn" type="button" onClick={onTeacher}>
          Teacher
        </button>
        <button
          className="iconbtn repeat-tutorial-trigger"
          type="button"
          aria-label="Repeat tutorial"
          data-tip="Repeat the tutorial"
          onClick={onRepeatTutorial}
        >
          ?
        </button>
        <button className="topbar-btn" type="button" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
