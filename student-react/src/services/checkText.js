import { getApiBaseUrl } from "@shared/runtimeConfig";
import { extractErrorMessage, fetchWithTimeout, isAuthExpired } from "../lib/request";

export async function checkText({ supa, text, mode, titles, signal, timeoutMs = 30000 }) {
  const isLocalDev = window.location.hostname === "localhost";
  const isWriteMode = typeof mode === "string" && mode.startsWith("write_");

  let token = isLocalDev ? "dev" : null;
  if (!isLocalDev && supa) {
    try {
      const { data, error } = await supa.auth.getSession();
      if (!error && data?.session) token = data.session.access_token;
    } catch {
      // Treat as anonymous
    }
  }
  // Non-write modes require a token; anonymous Write is fine without one.
  if (!token && !isWriteMode) {
    throw new Error("Session expired. Please sign in again.");
  }

  const apiBase = isLocalDev ? "" : getApiBaseUrl();
  if (!isLocalDev && !apiBase) throw new Error("Missing API configuration.");

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchWithTimeout(
    `${apiBase}/check_text`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        mode,
        titles: titles || undefined,
        student_mode: true,
        file_name: "write_session.docx",
      }),
      signal,
    },
    { timeoutMs }
  );

  // Anonymous Write rate limit returns 429 — surface it cleanly
  if (response.status === 429) {
    const err = new Error("Too many requests. Sign in for higher limits.");
    err.code = "ANON_RATE_LIMIT";
    throw err;
  }
  // Only treat 401/403 as expired auth for AUTHED callers; anonymous Write
  // shouldn't see 401, but if it does the message is unhelpful.
  if (token && isAuthExpired(response)) throw new Error("Session expired.");
  if (!response.ok) throw new Error(await extractErrorMessage(response));

  return response.json();
}
