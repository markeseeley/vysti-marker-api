import { getApiBaseUrl } from "@shared/runtimeConfig";
import { extractErrorMessage, fetchWithTimeout, isAuthExpired } from "../lib/request";

export async function checkText({ supa, text, mode, titles, signal, timeoutMs = 30000 }) {
  const isLocalDev = window.location.hostname === "localhost";

  let token = "dev";
  if (!isLocalDev) {
    if (!supa) throw new Error("Supabase is not available.");
    const { data, error } = await supa.auth.getSession();
    if (error || !data?.session) throw new Error("Session expired. Please sign in again.");
    token = data.session.access_token;
  }

  const apiBase = isLocalDev ? "" : getApiBaseUrl();
  if (!isLocalDev && !apiBase) throw new Error("Missing API configuration.");

  const response = await fetchWithTimeout(
    `${apiBase}/check_text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

  if (isAuthExpired(response)) throw new Error("Session expired.");
  if (!response.ok) throw new Error(await extractErrorMessage(response));

  return response.json();
}
