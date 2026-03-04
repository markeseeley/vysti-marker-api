import { getApiBaseUrl } from "@shared/runtimeConfig";
import { getSupaClient } from "./supa";
import { getDebugInfo } from "./logger";

/**
 * Submit a user error report to the backend.
 * Auto-attaches debug info (build ID, recent errors, browser).
 */
export async function submitErrorReport(message) {
  const supa = getSupaClient();
  if (!supa) throw new Error("Not connected");

  const { data } = await supa.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const debugInfo = {
    ...getDebugInfo(),
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  };

  const apiBase = getApiBaseUrl();
  const resp = await fetch(`${apiBase}/api/report-error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      debug_info: debugInfo,
      page_url: window.location.href,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Report failed (${resp.status})`);
  }

  return resp.json();
}

/**
 * Get the current user's email from the Supabase session.
 */
export async function getUserEmail() {
  try {
    const supa = getSupaClient();
    if (!supa) return null;
    const { data } = await supa.auth.getSession();
    return data?.session?.user?.email || null;
  } catch {
    return null;
  }
}
