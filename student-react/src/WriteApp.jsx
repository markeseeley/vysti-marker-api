import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./WriteApp.css";
import { useWriteReducer } from "./hooks/useWriteReducer";
import { useDebouncedCheck } from "./hooks/useDebouncedCheck";
import { useAuthSession } from "./hooks/useAuthSession";
import { getConfig } from "./config";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { exportDocx } from "@shared/markingApi";
import { downloadBlob } from "@shared/download";
import { detectStage, resolveStage, filterByStage, countSentences, STAGE_FIRST_SENTENCE, STAGE_CLOSED_THESIS, STAGE_INTRO_SUMMARY } from "./lib/writingStage";
import { peekTeacherSession } from "./services/teacherSessionStore";
import { findAllRevisionDrafts } from "./services/revisionDraftStore";
import WriteTopbar from "./components/WriteTopbar";
import WriteEditor from "./components/WriteEditor";
import WriteSidebar from "./components/WriteSidebar";
import Footer from "./components/Footer";

const WRITE_DRAFT_KEY = "vysti:write-draft";
function writeDraftKey(uid) { return `${WRITE_DRAFT_KEY}:${uid || "anon"}`; }

function saveWriteDraft(uid, data) {
  try {
    localStorage.setItem(writeDraftKey(uid), JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {}
}

function loadWriteDraft(uid) {
  try {
    const raw = localStorage.getItem(writeDraftKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.text?.trim()) return null;
    return parsed;
  } catch { return null; }
}

export function hasWriteDraft(uid) {
  try {
    const raw = localStorage.getItem(writeDraftKey(uid));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.text?.trim());
  } catch { return false; }
}

export function peekWriteDraft(uid) {
  try {
    const raw = localStorage.getItem(writeDraftKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.text?.trim()) return null;
    return { savedAt: parsed.savedAt || null, textTitle: parsed.textTitle || "" };
  } catch { return null; }
}

export default function WriteApp() {
  const { supa, isChecking: authChecking } = useAuthSession();
  const [state, dispatch] = useWriteReducer();
  const [authReady, setAuthReady] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [userId, setUserId] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [keepWorkingItems, setKeepWorkingItems] = useState([]);
  const saveTimerRef = useRef(null);
  const draftRestoredRef = useRef(false);

  // Extract userId on auth ready
  useEffect(() => {
    if (!authChecking && supa) {
      setAuthReady(true);
      (async () => {
        try {
          const { data } = await supa.auth.getSession();
          setUserId(data?.session?.user?.id || null);
        } catch {}
      })();
    }
  }, [authChecking, supa]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (!userId || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    const draft = loadWriteDraft(userId);
    if (draft) {
      dispatch({ type: "RESTORE_DRAFT", payload: draft });
    }
  }, [userId, dispatch]);

  // Auto-save to localStorage (throttled 5s)
  useEffect(() => {
    if (!userId || !state.text.trim()) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveWriteDraft(userId, { text: state.text, authorName: state.authorName, textTitle: state.textTitle });
    }, 5000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [userId, state.text, state.authorName, state.textTitle]);

  // Emergency save on beforeunload
  useEffect(() => {
    if (!userId) return;
    const handler = () => {
      if (state.text.trim()) {
        saveWriteDraft(userId, { text: state.text, authorName: state.authorName, textTitle: state.textTitle });
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [userId, state.text, state.authorName, state.textTitle]);

  // Manual save handler
  const handleSave = useCallback(() => {
    if (!userId || !state.text.trim()) return;
    setSaveState("saving");
    saveWriteDraft(userId, { text: state.text, authorName: state.authorName, textTitle: state.textTitle });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  }, [userId, state.text, state.authorName, state.textTitle]);

  // Compute Keep working items (cross-app)
  useEffect(() => {
    if (!userId || !supa) return;
    let cancelled = false;
    (async () => {
      const items = [];
      // Check for Mark session
      const markInfo = peekTeacherSession(userId);
      if (markInfo) {
        items.push({
          mode: "mark",
          label: "Mark",
          sublabel: `${markInfo.fileCount} document${markInfo.fileCount === 1 ? "" : "s"}`,
          time: markInfo.savedAt,
          href: "/teacher_react.html",
        });
      }
      // Check for Revise drafts
      try {
        const drafts = await findAllRevisionDrafts({ supa, userId });
        if (drafts.length > 0) {
          items.push({
            mode: "revise",
            label: "Revise",
            sublabel: drafts[0].fileName,
            time: drafts[0].savedAt,
            href: `/student_react.html?resumeDraft=${encodeURIComponent(drafts[0].fileName)}&resumeMode=${encodeURIComponent(drafts[0].mode || "textual_analysis")}`,
          });
        }
      } catch {}
      if (!cancelled) setKeepWorkingItems(items);
    })();
    return () => { cancelled = true; };
  }, [userId, supa]);

  // Client-side word count (instant, no API needed)
  const liveWordCount = useMemo(() => {
    const trimmed = (state.text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [state.text]);

  // Sentence count (for intro summary guidance)
  const sentenceCount = useMemo(() => countSentences(state.text || ""), [state.text]);

  // Writing stage detection + progressive mode selection
  const structuralStage = useMemo(() => detectStage(state.text), [state.text]);
  const apiMode = useMemo(() => {
    switch (structuralStage) {
      case STAGE_FIRST_SENTENCE:
        return "write_first_sentence";
      case STAGE_CLOSED_THESIS:
      case STAGE_INTRO_SUMMARY:
        return "write_intro";
      default:
        return "textual_analysis";
    }
  }, [structuralStage]);

  // Debounced analysis — mode follows structural stage
  useDebouncedCheck({
    text: state.text,
    mode: apiMode,
    supa,
    dispatch,
  });

  const stage = useMemo(
    () => resolveStage(structuralStage, state.issues, Boolean(state.markEventId), { sentenceCount, deviceCount }),
    [structuralStage, state.issues, state.markEventId, sentenceCount, deviceCount]
  );
  const filtered = useMemo(
    () => filterByStage(state.issues, state.labelCounts, stage),
    [state.issues, state.labelCounts, stage]
  );

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!supa || !state.text.trim()) return;
    try {
      const { data } = await supa.auth.getSession();
      const token = data?.session?.access_token;
      const apiBase = getApiBaseUrl("");
      const fileName = "essay.docx";

      const blob = await exportDocx({
        apiBaseUrl: apiBase,
        token,
        fileName,
        text: state.text,
      });
      downloadBlob(blob, fileName);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [supa, state.text]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    if (!supa) {
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/write_react.html")}`
      );
      return;
    }
    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      localStorage.removeItem("vysti_products");
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/write_react.html")}`
      );
    }
  }, [supa]);

  if (!authReady) {
    return (
      <main className="page student-page student-react-shell">
        <div className="card form-card">
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="student-react-shell">
      <WriteTopbar
        onRepeatTutorial={() => {}}
        onSignOut={handleSignOut}
        onDownload={handleDownload}
        canDownload={Boolean(state.text.trim())}
        onSave={handleSave}
        saveState={saveState}
        canSave={Boolean(state.text.trim())}
        keepWorkingItems={keepWorkingItems}
      />

      <main className="page write-page">
        <div className="write-grid">
          <section className="write-left">
            <div className="card write-editor-card">
              <WriteEditor
                text={state.text}
                onChange={(value) => dispatch({ type: "SET_TEXT", payload: value })}
                isChecking={state.isChecking}
                wordCount={liveWordCount}
                authorName={state.authorName}
                onAuthorNameChange={(v) => dispatch({ type: "SET_AUTHOR_NAME", payload: v })}
                textTitle={state.textTitle}
                onTextTitleChange={(v) => dispatch({ type: "SET_TEXT_TITLE", payload: v })}
              />
            </div>
          </section>

          <aside className="write-right">
            <WriteSidebar
              issues={filtered.issues}
              labelCounts={filtered.labelCounts}
              totalLabels={filtered.totalLabels}
              expandedMetric={state.mciExpandedMetric}
              onExpandedMetricChange={(value) =>
                dispatch({ type: "SET_MCI_EXPANDED", payload: value })
              }
              markEventId={state.markEventId}
              isChecking={state.isChecking}
              mode={state.mode}
              hasText={Boolean(state.text.trim())}
              stage={stage}
              structuralStage={structuralStage}
              firstSentenceComponents={state.firstSentenceComponents}
              authorName={state.authorName}
              sentenceCount={sentenceCount}
              onDeviceCountChange={setDeviceCount}
            />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
