import { getApiBaseUrl } from "@shared/runtimeConfig";
import { getSupaClient } from "./supa";

let buildId = "";
const events = [];
let lastError = null;

// Rate limiting: max 5 server reports per 10 minutes
const _REPORT_WINDOW = 10 * 60 * 1000;
let _reportCount = 0;
let _reportWindowStart = Date.now();
const _reportedHashes = new Set();

const pushEvent = (entry) => {
  events.push(entry);
  if (events.length > 50) {
    events.shift();
  }
};

export function initLogger(config) {
  buildId = config?.buildId || "";
}

export function logEvent(type, details = {}) {
  pushEvent({
    type,
    details,
    buildId,
    at: new Date().toISOString()
  });
}

export function logError(message, details = {}) {
  lastError = {
    message,
    ...details,
    at: new Date().toISOString(),
    buildId
  };
  logEvent("error", { message, ...details });
}

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function _canReport(message) {
  const now = Date.now();
  if (now - _reportWindowStart > _REPORT_WINDOW) {
    _reportCount = 0;
    _reportWindowStart = now;
    _reportedHashes.clear();
  }
  if (_reportCount >= 5) return false;
  const hash = _simpleHash(message);
  if (_reportedHashes.has(hash)) return false;
  _reportedHashes.add(hash);
  _reportCount++;
  return true;
}

/**
 * Send a critical error to the backend (best-effort, fire-and-forget).
 * Rate-limited to max 5 unique errors per 10-minute window.
 */
async function _sendToServer(errorType, message, details) {
  if (!_canReport(message)) return;
  try {
    const supa = getSupaClient();
    if (!supa) return;
    const { data } = await supa.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;

    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/log-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        error_type: errorType,
        message: message.slice(0, 2000),
        details,
        page_url: window.location.href,
        build_id: buildId,
      }),
    }).catch(() => {});
  } catch {
    // never let logging crash the app
  }
}

/**
 * Log a critical error both in-memory AND to the server.
 * Use for: mark failures, auth issues, render crashes.
 */
export function logCriticalError(message, details = {}) {
  logError(message, details);
  _sendToServer(details.errorType || "critical", message, details);
}

export function getDebugInfo() {
  return {
    buildId,
    lastError,
    recentEvents: events.slice(-12)
  };
}
