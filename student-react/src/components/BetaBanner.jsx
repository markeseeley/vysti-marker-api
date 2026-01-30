import { getConfig } from "../config";

export default function BetaBanner() {
  const { buildId } = getConfig();
  const handleClassicClick = () => {
    try {
      localStorage.setItem("uiMode", "classic");
    } catch (err) {}
  };

  return (
    <div className="beta-banner" role="status" aria-live="polite">
      <span className="beta-badge">React Beta</span>
      <span className="beta-text">
        React Beta — if anything looks wrong, use{" "}
        <a href="/student.html" onClick={handleClassicClick}>
          student.html
        </a>
      </span>
      {buildId ? <span className="beta-build">Build {buildId}</span> : null}
      <a className="beta-link" href="/student.html" onClick={handleClassicClick}>
        Return to classic student.html
      </a>
    </div>
  );
}
