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

export function getApiBaseUrl(fallback = "https://vysti-rules.onrender.com") {
  const base = getConfig().apiBaseUrl || fallback;
  return String(base).replace(/\/$/, "");
}

export function isSharedCoreEnabled() {
  return Boolean(getConfig()?.featureFlags?.useSharedCore);
}

export function getBuildId() {
  return (
    document.querySelector('meta[name="app-build-id"]')?.content || "dev"
  );
}
