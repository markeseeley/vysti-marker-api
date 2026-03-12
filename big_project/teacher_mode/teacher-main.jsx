import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@student/index.css";
import TeacherApp from "./TeacherApp.jsx";
import MobileApp from "@student/MobileApp.jsx";
import ErrorBoundary from "@student/components/ErrorBoundary.jsx";
import { getConfig, getConfigError, initConfig as initAppConfig } from "@student/config";
import { initLogger } from "@student/lib/logger";
import { initConfig as initRuntimeConfig } from "@shared/runtimeConfig";
import { isMobilePhone } from "@student/lib/isMobile";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);

const renderLoading = () => {
  root.render(
    <main className="page teacher-page">
      <div className="card form-card">
        <p>Loading…</p>
      </div>
    </main>
  );
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
  const AppComponent = isMobilePhone() ? MobileApp : TeacherApp;
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AppComponent />
      </ErrorBoundary>
    </StrictMode>
  );
})();
