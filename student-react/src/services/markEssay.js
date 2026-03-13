import { getApiBaseUrl } from "@shared/runtimeConfig";
import { buildMarkFormData } from "@shared/markingApi";
import { logError, logCriticalError, logEvent } from "../lib/logger";
import { extractErrorMessage, fetchWithTimeout, isAuthExpired } from "../lib/request";

function throwIfEntitlementError(response) {
  if (response.status === 402 || response.status === 403) {
    return response.json().then((j) => {
      const detail = j.detail || j;
      const err = new Error(detail.message || "Please upgrade to continue.");
      err.code = response.status === 403 ? "PRODUCT_ACCESS" : (detail.code || "USAGE_LIMIT");
      err.isEntitlementError = true;
      throw err;
    }).catch((e) => {
      if (e.isEntitlementError) throw e;
      const err = new Error("Please upgrade to continue.");
      err.code = response.status === 403 ? "PRODUCT_ACCESS" : "USAGE_LIMIT";
      err.isEntitlementError = true;
      throw err;
    });
  }
  return null;
}

export async function markEssay({
  supa,
  file,
  mode,
  assignmentName,
  onSessionExpired,
  signal,
  timeoutMs
}) {
  logEvent("mark_start", { mode, fileName: file?.name || "" });
  if (!supa) {
    logError("Supabase is not available");
    throw new Error("Supabase is not available.");
  }
  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    if (onSessionExpired) onSessionExpired();
    logError("Session expired before mark");
    throw new Error("Session expired. Please sign in again.");
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    logError("Mark URL missing from config");
    throw new Error("Missing API configuration. Please refresh.");
  }

  try {
    const formData = buildMarkFormData({
      file,
      mode,
      includeSummaryTable: false,
      assignmentName
    });
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/mark`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: formData,
        signal
      },
      { timeoutMs }
    );

    await throwIfEntitlementError(response);

    if (isAuthExpired(response)) {
      const err = new Error("Session expired");
      err.code = "SESSION_EXPIRED";
      throw err;
    }

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const techniquesHeaderRaw = response.headers.get("X-Vysti-Techniques");
    const contentType = response.headers.get("content-type");

    let blob;
    let metadata = null;

    if (contentType && contentType.includes("application/json")) {
      const jsonData = await response.json();
      const binaryString = atob(jsonData.document);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      metadata = jsonData.metadata || null;
    } else {
      blob = await response.blob();
    }

    logEvent("mark_success", { size: blob.size });
    return { blob, metadata, techniquesHeader: techniquesHeaderRaw, status: response.status };
  } catch (err) {
    if (err?.code === "SESSION_EXPIRED") {
      if (onSessionExpired) onSessionExpired();
      logError("Session expired during mark");
      throw new Error("Session expired. Please sign in again.");
    }
    logCriticalError("Mark failed", { errorType: "mark_failure", error: err?.message });
    throw err;
  }
}

export async function markText({
  supa,
  payload,
  onSessionExpired,
  signal,
  timeoutMs
}) {
  logEvent("recheck_start");
  if (!supa) {
    logError("Supabase is not available");
    throw new Error("Supabase is not available.");
  }
  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    if (onSessionExpired) onSessionExpired();
    logError("Session expired before recheck");
    throw new Error("Session expired. Please sign in again.");
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    logError("Recheck URL missing from config");
    throw new Error("Missing API configuration. Please refresh.");
  }
  try {
    const enrichedPayload = { ...payload, return_metadata: true };
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/mark_text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify(enrichedPayload),
        signal
      },
      { timeoutMs }
    );

    await throwIfEntitlementError(response);

    if (isAuthExpired(response)) {
      const err = new Error("Session expired");
      err.code = "SESSION_EXPIRED";
      throw err;
    }

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const techniquesHeader = response.headers.get("X-Vysti-Techniques");
    const contentType = response.headers.get("content-type");

    let blob;
    let metadata = null;

    if (contentType && contentType.includes("application/json")) {
      const jsonData = await response.json();
      const binaryString = atob(jsonData.document);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      metadata = jsonData.metadata || null;
    } else {
      blob = await response.blob();
    }

    logEvent("recheck_success", { size: blob.size });
    return { blob, metadata, techniquesHeader };
  } catch (err) {
    if (err?.code === "SESSION_EXPIRED") {
      if (onSessionExpired) onSessionExpired();
      logError("Session expired during recheck");
      throw new Error("Session expired. Please sign in again.");
    }
    logCriticalError("Recheck failed", { errorType: "recheck_failure", error: err?.message });
    throw err;
  }
}
