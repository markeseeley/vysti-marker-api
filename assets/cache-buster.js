(function () {
  const META_BUILD_ID = "app-build-id";
  const META_VERSION = "app-version";
  const BUILD_ID_KEYS = [
    "APP_BUILD_ID",
    "NEXT_PUBLIC_BUILD_ID",
    "VITE_APP_VERSION",
    "__APP_BUILD_ID__",
    "__APP_VERSION__"
  ];

  function readMetaContent(name) {
    if (typeof document === "undefined") return "";
    const el = document.querySelector(`meta[name="${name}"]`);
    return el && el.content ? el.content.trim() : "";
  }

  function getBuildId() {
    if (typeof window !== "undefined") {
      for (const key of BUILD_ID_KEYS) {
        const value = window[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }

    const metaValue = readMetaContent(META_BUILD_ID) || readMetaContent(META_VERSION);
    if (metaValue) return metaValue;

    if (typeof document !== "undefined" && document.lastModified) {
      return document.lastModified;
    }

    return "";
  }

  function addCacheBuster(url, mode = "build") {
    if (!url) return url;

    const isUrlObject = typeof URL !== "undefined" && url instanceof URL;
    const rawUrl = isUrlObject ? url.toString() : String(url);

    if (/^(data|blob):/i.test(rawUrl)) return url;

    const cbValue = mode === "timestamp" ? String(Date.now()) : getBuildId();
    if (!cbValue) return url;

    try {
      const resolved = new URL(rawUrl, window.location.href);
      resolved.searchParams.set("cb", cbValue);
      return resolved.toString();
    } catch (_) {
      const parts = rawUrl.split("#");
      const base = parts[0];
      const hash = parts[1] ? `#${parts[1]}` : "";
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}cb=${encodeURIComponent(cbValue)}${hash}`;
    }
  }

  window.CacheBuster = {
    addCacheBuster,
    getBuildId
  };
  window.addCacheBuster = addCacheBuster;

  /*
    How to verify:
    1) Chrome DevTools > Network, disable cache off/on, reload.
    2) Confirm config/data requests are NOT "from disk cache".
    3) Deploy with new build id; ensure cb changes and data refreshes.
  */
})();
