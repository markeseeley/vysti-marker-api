import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WriteApp from "./WriteApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getConfig, getConfigError, initConfig as initAppConfig } from "./config";
import { initLogger } from "./lib/logger";
import { initConfig as initRuntimeConfig } from "@shared/runtimeConfig";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);

const renderLoading = () => {
  root.render(null);
};

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
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <WriteApp />
      </ErrorBoundary>
    </StrictMode>
  );
})();
