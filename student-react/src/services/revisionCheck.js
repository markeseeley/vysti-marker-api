import { getApiBaseUrl } from "@shared/runtimeConfig";
import { extractErrorMessage, fetchWithTimeout, isAuthExpired } from "../lib/request";

export async function checkRevision({
  supa,
  label,
  labelTrimmed,
  rewrite,
  mode,
  contextText,
  originalSentence,
  paragraphIndex
}) {
  if (!supa) {
    throw new Error("Supabase is not available.");
  }
  const { data, error: sessionError } = await supa.auth.getSession();
  if (sessionError || !data?.session) {
    throw new Error("Session expired. Please sign in again.");
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error("Missing API configuration.");
  }

  const payload = {
    label,
    label_trimmed: labelTrimmed,
    rewrite,
    mode,
    context_text: contextText,
    original_sentence: originalSentence,
    paragraph_index: paragraphIndex ?? 0
  };

  const response = await fetchWithTimeout(
    `${apiBaseUrl}/revision/check`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify(payload)
    },
    { timeoutMs: 25000 }
  );

  if (isAuthExpired(response)) {
    throw new Error("Session expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
}
