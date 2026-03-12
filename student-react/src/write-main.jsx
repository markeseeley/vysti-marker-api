import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WriteApp from "./WriteApp.jsx";
import MobileApp from "./MobileApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getConfig, getConfigError, initConfig as initAppConfig } from "./config";
import { initLogger } from "./lib/logger";
import { initConfig as initRuntimeConfig } from "@shared/runtimeConfig";
import { isMobilePhone } from "./lib/isMobile";

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
  const AppComponent = isMobilePhone() ? MobileApp : WriteApp;
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AppComponent />
      </ErrorBoundary>
    </StrictMode>
  );
})();
