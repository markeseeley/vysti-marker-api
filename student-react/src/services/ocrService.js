import { getApiBaseUrl } from "@shared/runtimeConfig";
import { logEvent, logError } from "../lib/logger";
import { fetchWithTimeout, isAuthExpired } from "../lib/request";

/**
 * Send page images to the OCR endpoint and return transcribed text + page data.
 *
 * @param {Object} opts
 * @param {import("@supabase/supabase-js").SupabaseClient} opts.supa
 * @param {File[]} opts.images - Ordered page image files
 * @param {"handwritten"|"typed"} [opts.mode="handwritten"]
 * @param {"desktop"|"mobile"} [opts.source="desktop"]
 * @param {Function} [opts.onSessionExpired]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{text: string, pages: Array<{page: number, text: string, imageUrl: string}>, pageCount: number}>}
 */
export async function transcribeImages({
  supa,
  images,
  mode = "handwritten",
  source = "desktop",
  onSessionExpired,
  signal,
}) {
  logEvent("ocr_start", { pageCount: images.length, mode });

  if (!supa) throw new Error("Supabase is not available.");

  const { data, error } = await supa.auth.getSession();
  if (error || !data?.session) {
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please sign in again.");
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error("Missing API configuration. Please refresh.");

  const formData = new FormData();
  formData.append("mode", mode);
  formData.append("source", source);
  for (const img of images) {
    formData.append("images", img);
  }

  const response = await fetchWithTimeout(
    `${apiBaseUrl}/ocr/transcribe`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: formData,
      signal,
    },
    { timeoutMs: 120000 } // OCR can be slow for many pages
  );

  if (isAuthExpired(response)) {
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    let msg;
    try { msg = JSON.parse(text).detail; } catch { msg = text; }
    logError("OCR failed", { status: response.status, msg });
    throw new Error(msg || `OCR failed (${response.status})`);
  }

  const result = await response.json();
  logEvent("ocr_success", { pageCount: result.page_count });

  // Attach blob URLs for the original images so TranscriptionReview can show them
  const pages = result.pages.map((p, i) => ({
    page: p.page,
    text: p.text,
    imageUrl: URL.createObjectURL(images[i]),
  }));

  return {
    text: result.text,
    pages,
    pageCount: result.page_count,
  };
}