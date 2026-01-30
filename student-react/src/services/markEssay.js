import { MARK_TEXT_URL, MARK_URL } from "../config";

export async function markEssay({
  supa,
  file,
  mode,
  assignmentName,
  onSessionExpired
}) {
  if (!supa) {
    throw new Error("Supabase is not available.");
  }
  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    if (onSessionExpired) onSessionExpired();
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

  const response = await fetch(MARK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`
    },
    body: formData
  });

  if (response.status === 401 || response.status === 403) {
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    const snippet = text ? `: ${text.substring(0, 140)}` : "";
    throw new Error(`Mark failed (${response.status})${snippet}`);
  }

  const techniquesHeader = response.headers.get("X-Vysti-Techniques");
  const blob = await response.blob();

  return { blob, techniquesHeader };
}

export async function markText({
  supa,
  payload,
  onSessionExpired
}) {
  if (!supa) {
    throw new Error("Supabase is not available.");
  }
  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please sign in again.");
  }

  const response = await fetch(MARK_TEXT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 401 || response.status === 403) {
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    const snippet = text ? `: ${text.substring(0, 140)}` : "";
    throw new Error(`Recheck failed (${response.status})${snippet}`);
  }

  return response.blob();
}
