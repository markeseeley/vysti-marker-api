import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getConfig, getConfigError, initConfig as initAppConfig } from "./config";
import { initLogger } from "./lib/logger";
import { initConfig as initRuntimeConfig } from "@shared/runtimeConfig";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);

const renderLoading = () => {
  root.render(null);
};

const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get("classic") === "1") {
  try {
    localStorage.setItem("uiMode", "classic");
  } catch (err) {}
  window.location.replace("/student.html?classic=1");
} else {
  renderLoading();
  (async () => {
    try {
      await initRuntimeConfig();
    } catch (err) {
      console.warn("Runtime config init failed:", err);
    }
    try {
      await initAppConfig();
      const config = getConfig();
      const error = getConfigError();
      if (error) {
        console.warn("Config error:", error);
      }
      initLogger(config);
    } catch (err) {
      console.error("Config init failed:", err);
    }
    const AppComponent = App;
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <AppComponent />
        </ErrorBoundary>
      </StrictMode>
    );
  })();
}
