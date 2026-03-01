import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initConfig } from '@shared/runtimeConfig'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById("root"));

const renderApp = () => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

(async () => {
  try {
    await initConfig();
  } catch (err) {
    console.warn("Failed to init runtime config", err);
    window.__vystiRuntimeConfigError =
      err?.message || "Failed to load runtime config.";
  } finally {
    renderApp();
  }
})();
