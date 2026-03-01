/**
 * Supabase-backed revision draft persistence.
 * Mirrors the localStorage draftStore.js pattern but saves to the
 * `revision_drafts` table so students can resume from any device.
 */

const MAX_CHARS = 200000;

export async function saveRevisionDraftToSupabase({
  supa,
  userId,
  fileName,
  mode,
  text,
  markEventId
}) {
  if (!supa || !userId || !fileName || !text) return null;
  const trimmed = text.trim();
  if (trimmed.length < 40 || trimmed.length > MAX_CHARS) return null;

  try {
    const now = new Date().toISOString();
    const { data, error } = await supa
      .from("revision_drafts")
      .upsert(
        {
          user_id: userId,
          file_name: fileName,
          mode: mode || "textual_analysis",
          draft_text: trimmed,
          mark_event_id: markEventId || null,
          saved_at: now
        },
        { onConflict: "user_id,file_name,mode" }
      )
      .select("saved_at")
      .single();

    if (error) {
      console.warn("[revisionDraft] save error:", error.message);
      return null;
    }
    return { savedAt: data?.saved_at || now };
  } catch (err) {
    console.warn("[revisionDraft] save exception:", err);
    return null;
  }
}

export async function findLatestRevisionDraft({ supa, userId }) {
  if (!supa || !userId) return null;
  try {
    const { data, error } = await supa
      .from("revision_drafts")
      .select("file_name, mode, draft_text, saved_at")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data?.draft_text) return null;
    return {
      fileName: data.file_name,
      mode: data.mode,
      text: data.draft_text,
      savedAt: data.saved_at
    };
  } catch {
    return null;
  }
}

export async function findAllRevisionDrafts({ supa, userId }) {
  if (!supa || !userId) return [];
  try {
    const { data, error } = await supa
      .from("revision_drafts")
      .select("file_name, mode, draft_text, saved_at")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(20);
    if (error || !data?.length) return [];
    return data.map((row) => ({
      fileName: row.file_name,
      mode: row.mode,
      text: row.draft_text,
      savedAt: row.saved_at
    }));
  } catch {
    return [];
  }
}

export async function loadRevisionDraftFromSupabase({
  supa,
  userId,
  fileName,
  mode
}) {
  if (!supa || !userId || !fileName) return null;

  try {
    const { data, error } = await supa
      .from("revision_drafts")
      .select("draft_text, saved_at, mark_event_id")
      .eq("user_id", userId)
      .eq("file_name", fileName)
      .eq("mode", mode || "textual_analysis")
      .order("saved_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.draft_text) return null;
    return {
      text: data.draft_text,
      savedAt: data.saved_at,
      markEventId: data.mark_event_id
    };
  } catch (err) {
    console.warn("[revisionDraft] load exception:", err);
    return null;
  }
}

export async function deleteRevisionDraftFromSupabase({
  supa,
  userId,
  fileName,
  mode
}) {
  if (!supa || !userId || !fileName) return;

  try {
    await supa
      .from("revision_drafts")
      .delete()
      .eq("user_id", userId)
      .eq("file_name", fileName)
      .eq("mode", mode || "textual_analysis");
  } catch (err) {
    console.warn("[revisionDraft] delete exception:", err);
  }
}

/**
 * Returns a throttled saver that writes to Supabase at most once per
 * `intervalMs` (default 10 s). Calls are coalesced — only the latest
 * args are used when the timer fires.
 */
export function createSupabaseThrottledSaver(intervalMs = 60000) {
  let lastCall = 0;
  let timeoutId = null;
  let pending = null;

  return (saveFn) => {
    pending = saveFn;
    const now = Date.now();
    const remaining = intervalMs - (now - lastCall);

    if (remaining <= 0) {
      lastCall = now;
      if (pending) pending();
      pending = null;
      return;
    }
    if (timeoutId) return;
    timeoutId = setTimeout(() => {
      lastCall = Date.now();
      timeoutId = null;
      if (pending) pending();
      pending = null;
    }, remaining);
  };
}
