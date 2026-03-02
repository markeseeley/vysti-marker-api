let _config = null;
let _initPromise = null;

export async function initConfig() {
  if (_config) return _config;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const res = await fetch("/student-react-config.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load runtime config (${res.status})`);
    }
    const config = await res.json();
    if (!config || typeof config !== "object") {
      throw new Error("Invalid runtime config");
    }
    _config = config;
    window.__vystiRuntimeConfig = config;
    return _config;
  })();

  return _initPromise;
}

export function getConfig() {
  return _config || window.__vystiRuntimeConfig || {};
}

export function getApiBaseUrl(fallback = "") {
  const configBase = getConfig().apiBaseUrl;
  // Config points to localhost — only use it when actually running locally
  if (configBase && configBase.includes("localhost")) {
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h !== "localhost" && h !== "127.0.0.1") {
        return window.location.origin;   // production: use actual origin
      }
    }
  }
  const base = configBase || fallback;
  const result = String(base).replace(/\/$/, "");
  // Safety net: never return empty/falsy in a browser context
  if (!result && typeof window !== "undefined") {
    return window.location.origin;
  }
  return result;
}

export function isSharedCoreEnabled() {
  return Boolean(getConfig()?.featureFlags?.useSharedCore);
}

export function getBuildId() {
  return (
    document.querySelector('meta[name="app-build-id"]')?.content || "dev"
  );
}
