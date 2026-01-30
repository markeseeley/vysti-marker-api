export function buildMarkFormData({
  file,
  mode,
  includeSummaryTable = false,
  assignmentName = "",
  detectedWork = null
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  formData.append("include_summary_table", includeSummaryTable ? "true" : "false");
  formData.append("highlight_thesis_devices", "false");
  formData.append("student_mode", "true");

  if (assignmentName && assignmentName.trim()) {
    formData.append("assignment_name", assignmentName.trim());
  }

  if (detectedWork?.confidence === "high") {
    const isMinor =
      typeof detectedWork.text_is_minor_work === "boolean"
        ? detectedWork.text_is_minor_work
        : detectedWork.isMinor;
    if (detectedWork.author) formData.append("author", detectedWork.author);
    if (detectedWork.title) formData.append("title", detectedWork.title);
    if (typeof isMinor === "boolean") {
      formData.append(
        "text_is_minor_work",
        isMinor ? "true" : "false"
      );
    }
  }

  return formData;
}

export function parseTechniquesHeader(header) {
  if (!header) return null;
  try {
    return JSON.parse(header);
  } catch (err) {
    return header;
  }
}

export async function markDocx({
  apiBaseUrl,
  token,
  file,
  mode,
  includeSummaryTable = false,
  assignmentName = "",
  detectedWork = null
}) {
  const formData = buildMarkFormData({
    file,
    mode,
    includeSummaryTable,
    assignmentName,
    detectedWork
  });

  const response = await fetch(`${apiBaseUrl}/mark`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Session expired");
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mark failed (${response.status}): ${text.substring(0, 120)}`);
  }

  const techniquesHeaderRaw = response.headers.get("X-Vysti-Techniques");
  const blob = await response.blob();
  return {
    blob,
    techniquesHeaderRaw,
    techniquesParsed: parseTechniquesHeader(techniquesHeaderRaw)
  };
}

export function buildMarkTextPayload({ fileName, text, mode, detectedWork = null }) {
  const payload = {
    file_name: fileName,
    text,
    mode,
    highlight_thesis_devices: false,
    student_mode: true
  };

  if (detectedWork?.confidence === "high") {
    const isMinor =
      typeof detectedWork.text_is_minor_work === "boolean"
        ? detectedWork.text_is_minor_work
        : detectedWork.isMinor;
    payload.titles = [
      {
        author: detectedWork.author || "",
        title: detectedWork.title || "",
        is_minor: Boolean(isMinor)
      }
    ];
  }

  return payload;
}

export async function markText({ apiBaseUrl, token, payload }) {
  const response = await fetch(`${apiBaseUrl}/mark_text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Session expired");
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mark text failed (${response.status}): ${text.substring(0, 120)}`);
  }

  return response;
}

export async function exportDocx({ apiBaseUrl, token, fileName, text }) {
  const response = await fetch(`${apiBaseUrl}/export_docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      file_name: fileName,
      text
    })
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Session expired");
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  if (!response.ok) {
    const textResp = await response.text();
    throw new Error(
      `Export docx failed (${response.status}): ${textResp.substring(0, 120)}`
    );
  }

  return response.blob();
}

export async function exportDocx({ apiBaseUrl, token, fileName, text }) {
  const response = await fetch(`${apiBaseUrl}/export_docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      file_name: fileName,
      text
    })
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Session expired");
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  if (!response.ok) {
    const textBody = await response.text();
    throw new Error(
      `Export docx failed (${response.status}): ${textBody.substring(0, 120)}`
    );
  }

  return response;
}
