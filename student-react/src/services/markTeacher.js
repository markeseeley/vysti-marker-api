import { getApiUrls } from "../config";
import { buildTeacherFormData } from "../lib/teacherFormData";

/**
 * Mark a single teacher essay via POST /mark.
 * Returns { blob, downloadUrl } on success.
 */
export async function markTeacherEssay({
  supa,
  file,
  mode,
  rules,
  works,
  studentName,
  assignmentName,
  classId,
  signal,
}) {
  const { markUrl } = getApiUrls();
  if (!markUrl) throw new Error("API URL not configured");

  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    throw new Error("Session expired. Please sign in again.");
  }
  const token = data.session.access_token;

  const formData = buildTeacherFormData({
    file,
    mode,
    rules,
    works,
    studentName,
    assignmentName,
    classId,
  });
  formData.append("return_metadata", "true");

  const response = await fetch(markUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal,
  });

  // Check for entitlement/paywall error (402)
  if (response.status === 402) {
    let msg = "Subscribe for unlimited marking.";
    try {
      const json = await response.json();
      const detail = json.detail || json;
      msg = detail.message || detail || msg;
    } catch {}
    const err = new Error(typeof msg === "string" ? msg : "Subscribe for unlimited marking.");
    err.code = "USAGE_LIMIT";
    err.isEntitlementError = true;
    throw err;
  }

  if (!response.ok) {
    let msg = `Server error (${response.status})`;
    try {
      const json = await response.json();
      msg = json.detail || json.message || msg;
    } catch {
      // ignore parse failures
    }
    throw new Error(msg);
  }

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
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    metadata = jsonData.metadata || null;
  } else {
    blob = await response.blob();
  }

  const downloadUrl = URL.createObjectURL(blob);
  return { blob, metadata, downloadUrl };
}
