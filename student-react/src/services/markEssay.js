import { getApiBaseUrl } from "@shared/runtimeConfig";
import { markDocx, markText as markTextShared } from "@shared/markingApi";
import { logError, logEvent } from "../lib/logger";

export async function markEssay({
  supa,
  file,
  mode,
  assignmentName,
  onSessionExpired
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
    const { blob, techniquesHeaderRaw, status } = await markDocx({
      apiBaseUrl,
      token: data.session.access_token,
      file,
      mode,
      includeSummaryTable: false,
      assignmentName
    });
    logEvent("mark_success", { size: blob.size });
    return { blob, techniquesHeader: techniquesHeaderRaw, status };
  } catch (err) {
    if (err?.code === "SESSION_EXPIRED") {
      if (onSessionExpired) onSessionExpired();
      logError("Session expired during mark");
      throw new Error("Session expired. Please sign in again.");
    }
    logError("Mark failed", { error: err?.message });
    throw err;
  }
}

export async function markText({
  supa,
  payload,
  onSessionExpired
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
    const response = await markTextShared({
      apiBaseUrl,
      token: data.session.access_token,
      payload
    });
    const blob = await response.blob();
    logEvent("recheck_success", { size: blob.size });
    return blob;
  } catch (err) {
    if (err?.code === "SESSION_EXPIRED") {
      if (onSessionExpired) onSessionExpired();
      logError("Session expired during recheck");
      throw new Error("Session expired. Please sign in again.");
    }
    logError("Recheck failed", { error: err?.message });
    throw err;
  }
}
