import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getConfigError, initConfig } from "./config";
import { initLogger } from "./lib/logger";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);

const renderConfigError = (message) => {
  root.render(
    <main className="page student-page student-react-shell">
      <div className="card form-card">
        <h1 className="card-title">Configuration error</h1>
        <p>{message}</p>
        <p>Please contact support or reload once configuration is fixed.</p>
      </div>
    </main>
  );
};

const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get("classic") === "1") {
  window.location.replace("/student.html");
} else {
  initConfig()
    .then((config) => {
      const error = getConfigError();
      if (error) {
        renderConfigError(error.message || "Missing configuration.");
        return;
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
      renderConfigError(err?.message || "Unable to load configuration.");
    });
}
