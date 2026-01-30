import { getApiUrls } from "../config";
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

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  formData.append("include_summary_table", "false");
  formData.append("highlight_thesis_devices", "false");
  formData.append("student_mode", "true");

  if (assignmentName?.trim()) {
    formData.append("assignment_name", assignmentName.trim());
  }

  const { markUrl } = getApiUrls();
  const response = await fetch(markUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`
    },
    body: formData
  });

  if (response.status === 401 || response.status === 403) {
    if (onSessionExpired) onSessionExpired();
    logError("Session expired during mark", { status: response.status });
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    const snippet = text ? `: ${text.substring(0, 140)}` : "";
    logError("Mark failed", { status: response.status, snippet });
    throw new Error(`Mark failed (${response.status})${snippet}`);
  }

  const techniquesHeader = response.headers.get("X-Vysti-Techniques");
  const blob = await response.blob();
  logEvent("mark_success", { size: blob.size });

  return { blob, techniquesHeader };
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

  const { markTextUrl } = getApiUrls();
  const response = await fetch(markTextUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 401 || response.status === 403) {
    if (onSessionExpired) onSessionExpired();
    logError("Session expired during recheck", { status: response.status });
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    const snippet = text ? `: ${text.substring(0, 140)}` : "";
    logError("Recheck failed", { status: response.status, snippet });
    throw new Error(`Recheck failed (${response.status})${snippet}`);
  }
  const blob = await response.blob();
  logEvent("recheck_success", { size: blob.size });
  return blob;
}
