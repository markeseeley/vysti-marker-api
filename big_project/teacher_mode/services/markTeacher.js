import { getApiUrls } from "@student/config";
import { getApiBaseUrl } from "@shared/runtimeConfig";
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

/**
 * Recheck a teacher essay using the current preview text via POST /mark_text.
 * Unlike markTeacherEssay (which re-uploads the original file), this sends
 * the edited preview text so teacher edits (e.g. deleting pages) are respected.
 */
export async function recheckTeacherText({
  supa,
  text,
  fileName,
  mode,
  rules,
  works,
  signal,
}) {
  const apiBaseUrl = getApiBaseUrl("");
  if (!apiBaseUrl) throw new Error("API URL not configured");

  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    throw new Error("Session expired. Please sign in again.");
  }
  const token = data.session.access_token;

  // Build titles array from works
  const titles = (works || [])
    .filter((w) => w.author?.trim() || w.title?.trim())
    .map((w) => ({
      author: w.author?.trim() || "",
      title: w.title?.trim() || "",
      is_minor: Boolean(w.isMinor),
    }));

  // Build rule overrides (invert teacher UI booleans → API booleans)
  const r = rules || {};
  const ruleOverrides = {
    forbid_personal_pronouns: !r.allowI,
    forbid_audience_reference: !r.allowAudience,
    enforce_closed_thesis: Boolean(r.enforceClosedThesis),
    require_body_evidence: Boolean(r.requireBodyEvidence),
    allow_intro_summary_quotes: Boolean(r.allowIntroQuotes),
    enforce_intro_quote_rule: !r.allowIntroQuotes,
    enforce_long_quote_rule: !r.allowLongQuotes,
    enforce_contractions_rule: !r.allowContractions,
    enforce_which_rule: !r.allowWhich,
    enforce_weak_verbs_rule: !r.disableWeakVerbs,
    enforce_fact_proof_rule: !r.disableFactRule,
    enforce_human_people_rule: !r.disableHumanRule,
    enforce_vague_terms_rule: !r.disableVagueGeneralRule,
    highlight_thesis_devices: Boolean(r.highlightDevices),
  };

  const payload = {
    file_name: fileName || "essay.docx",
    text,
    mode: mode || "textual_analysis",
    student_mode: false,
    return_metadata: true,
    ...(titles.length > 0 ? { titles } : {}),
    ...ruleOverrides,
  };

  const response = await fetch(`${apiBaseUrl}/mark_text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

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
    } catch {}
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
