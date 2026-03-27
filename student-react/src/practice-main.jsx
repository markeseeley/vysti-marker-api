import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PracticeApp from "./PracticeApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initConfig as initRuntimeConfig } from "@shared/runtimeConfig";
import { startVersionChecker, setupChunkErrorRecovery } from "@shared/versionCheck";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl);
setupChunkErrorRecovery();
root.render(null);

(async () => {
  try {
    await initRuntimeConfig();
  } catch (err) {
    console.warn("Runtime config init failed:", err);
  }
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <PracticeApp />
      </ErrorBoundary>
    </StrictMode>
  );
  startVersionChecker();
})();
