/**
 * Version check + chunk error recovery for live deployments.
 *
 * 1. Build-ID poller: every 3 minutes, fetches the current page HTML header
 *    to compare the deployed build ID with the running one. Shows a toast
 *    when they differ.
 *
 * 2. Chunk error recovery: catches dynamic import failures (404 on renamed
 *    chunks after a deploy) and auto-reloads once.
 */

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const RELOAD_FLAG = "vysti_chunk_reload";

// ── Build-ID version checker ──────────────────────────────────────

let _toastEl = null;

function getCurrentBuildId() {
  return document.querySelector('meta[name="app-build-id"]')?.content || "";
}

async function fetchLatestBuildId() {
  try {
    // Fetch just the current page with cache-busting to get the latest HTML
    const resp = await fetch(window.location.pathname, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(/name="app-build-id"\s+content="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function showUpdateToast() {
  if (_toastEl) return; // already showing

  _toastEl = document.createElement("div");
  _toastEl.className = "vysti-update-toast";
  _toastEl.innerHTML = `
    <span class="vysti-update-toast-text">A new version is available.</span>
    <button class="vysti-update-toast-btn" type="button">Refresh</button>
    <button class="vysti-update-toast-dismiss" type="button" aria-label="Dismiss">&times;</button>
  `;

  _toastEl.querySelector(".vysti-update-toast-btn").addEventListener("click", () => {
    window.location.reload();
  });

  _toastEl.querySelector(".vysti-update-toast-dismiss").addEventListener("click", () => {
    _toastEl.remove();
    _toastEl = null;
  });

  document.body.appendChild(_toastEl);
  // Trigger animation
  requestAnimationFrame(() => _toastEl.classList.add("vysti-update-toast--visible"));
}

function injectToastStyles() {
  if (document.getElementById("vysti-update-toast-styles")) return;
  const style = document.createElement("style");
  style.id = "vysti-update-toast-styles";
  style.textContent = `
    .vysti-update-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      opacity: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      background: #1a1a1a;
      color: #fff;
      border-radius: 10px;
      font-family: var(--font-body, "DM Sans", system-ui, sans-serif);
      font-size: 14px;
      box-shadow: 0 4px 24px rgba(0,0,0,.25);
      z-index: 99999;
      transition: opacity .3s, transform .3s;
    }
    .vysti-update-toast--visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .vysti-update-toast-text {
      white-space: nowrap;
    }
    .vysti-update-toast-btn {
      appearance: none;
      border: none;
      background: var(--maroon, #A90D22);
      color: #fff;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    .vysti-update-toast-btn:hover {
      background: #8a0b1c;
    }
    .vysti-update-toast-dismiss {
      appearance: none;
      border: none;
      background: none;
      color: rgba(255,255,255,.5);
      font-size: 18px;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
    }
    .vysti-update-toast-dismiss:hover {
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

export function startVersionChecker() {
  // Don't run on localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

  const currentId = getCurrentBuildId();
  if (!currentId || currentId === "dev") return;

  injectToastStyles();

  const check = async () => {
    const latestId = await fetchLatestBuildId();
    if (latestId && latestId !== currentId) {
      showUpdateToast();
    }
  };

  // First check after 1 minute (give the app time to settle)
  setTimeout(check, 60 * 1000);
  // Then every 3 minutes
  setInterval(check, POLL_INTERVAL_MS);
}

// ── Chunk error recovery ──────────────────────────────────────────

export function setupChunkErrorRecovery() {
  // Don't run on localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

  // If we already reloaded for a chunk error, clear the flag and don't set up again
  // (prevents reload loops)
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }
  } catch {}

  // Catch unhandled errors from failed dynamic imports
  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Loading CSS chunk")
    ) {
      tryChunkReload();
    }
  });

  // Also catch unhandled promise rejections (dynamic import returns a promise)
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event.reason?.message || String(event.reason || "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Loading CSS chunk") ||
      msg.includes("error loading dynamically imported module")
    ) {
      tryChunkReload();
    }
  });
}

function tryChunkReload() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried once
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  } catch {
    // sessionStorage not available — reload anyway but risk a loop
    // (very rare edge case)
    window.location.reload();
  }
}
