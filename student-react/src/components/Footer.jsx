export default function Footer() {
  return (
    <footer className="marker-footer" aria-label="Site footer">
      <div className="footer-copy">
        &copy; 2026 Vysti Research. All rights reserved.
        <span className="footer-legal">
          <a href="/terms.html">Terms</a>
          <a href="/privacy.html">Privacy</a>
        </span>
      </div>
      <img className="footer-logo" src="/assets/logo_black.png" alt="Vysti" />
    </footer>
  );
}
