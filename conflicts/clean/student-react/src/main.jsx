import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getConfig, getConfigError, initConfig } from "./config";
import { initLogger } from "./lib/logger";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);

const renderLoading = () => {
  root.render(
    <main className="page student-page student-react-shell">
      <div className="card form-card">
        <p>Loading…</p>
      </div>
    </main>
  );
};

const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get("classic") === "1") {
  window.location.replace("/student.html");
} else {
  renderLoading();
  initConfig()
    .then(() => {
      const config = getConfig();
      const error = getConfigError();
      if (error) {
        console.warn("Config error:", error);
      }
      initLogger(config);
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>
      );
    })
    .catch((err) => {
      console.error("Config init failed:", err);
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>
      );
    });
}
