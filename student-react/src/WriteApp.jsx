import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./WriteApp.css";
import { useWriteReducer } from "./hooks/useWriteReducer";
import { useDebouncedCheck } from "./hooks/useDebouncedCheck";
import { useAuthSession } from "./hooks/useAuthSession";
import { getConfig } from "./config";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { exportDocx } from "@shared/markingApi";
import { downloadBlob } from "@shared/download";
import { detectStage, resolveStage, filterByStage, countSentences, nextStage, STAGE_ORDER, STAGE_FIRST_SENTENCE, STAGE_CLOSED_THESIS, STAGE_INTRO_SUMMARY, STAGE_TOPIC_SENTENCE, STAGE_BODY_EVIDENCE, STAGE_CONCLUSION } from "./lib/writingStage";
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
  const { supa, isChecking: authChecking, products } = useAuthSession();
  const [state, dispatch] = useWriteReducer();
  const [authReady, setAuthReady] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [stageOverride, setStageOverride] = useState(null);
  const [userId, setUserId] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [keepWorkingItems, setKeepWorkingItems] = useState([]);
  const saveTimerRef = useRef(null);
  const draftRestoredRef = useRef(false);
  const editorWrapRef = useRef(null);

  // Extract userId on auth ready
  const isLocalDev = window.location.hostname === "localhost";
  useEffect(() => {
    if (isLocalDev) {
      setAuthReady(true);
      setUserId("local-dev");
      return;
    }
    if (!authChecking && supa) {
      setAuthReady(true);
      (async () => {
        try {
          const { data } = await supa.auth.getSession();
          setUserId(data?.session?.user?.id || null);
        } catch {}
      })();
    }
  }, [authChecking, supa, isLocalDev]);

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

  // Extract thesis sentence (last sentence of first paragraph)
  const thesisSentence = useMemo(() => {
    const trimmed = (state.text || "").trim();
    if (!trimmed) return "";
    const paragraphs = trimmed.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (paragraphs.length === 0) return "";
    const intro = paragraphs[0];
    const sentences = intro.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length === 0) return "";
    return sentences[sentences.length - 1].trim();
  }, [state.text]);

  // Per-body-paragraph quote counts (for CEECR guidance)
  const bodyParaStats = useMemo(() => {
    const trimmed = (state.text || "").trim();
    if (!trimmed) return [];
    const paragraphs = trimmed.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (paragraphs.length < 2) return [];
    // Body paragraphs = everything after the first (intro) paragraph, excluding a potential conclusion
    return paragraphs.slice(1).map(p => {
      const quotes = (p.match(/[""\u201C\u201D]/g) || []).length;
      const quotePairs = Math.floor(quotes / 2);
      const sentences = countSentences(p);
      return { quotePairs, sentences };
    });
  }, [state.text]);

  // Writing stage detection + progressive mode selection
  const structuralStage = useMemo(() => detectStage(state.text, { deviceCount }), [state.text, deviceCount]);
  const apiMode = useMemo(() => {
    switch (structuralStage) {
      case STAGE_FIRST_SENTENCE:
        return "write_first_sentence";
      case STAGE_CLOSED_THESIS:
      case STAGE_INTRO_SUMMARY:
        return "write_intro";
      case STAGE_TOPIC_SENTENCE:
      case STAGE_BODY_EVIDENCE:
        return "write_body";
      case STAGE_CONCLUSION:
        return "write_conclusion";
      default:
        return "textual_analysis";
    }
  }, [structuralStage]);

  // Build titles array for the API (tells backend minor vs major work)
  const titles = useMemo(() => {
    if (!state.authorName && !state.textTitle) return undefined;
    return [{ author: state.authorName || "", title: state.textTitle || "", is_minor: state.textIsMinor }];
  }, [state.authorName, state.textTitle, state.textIsMinor]);

  // Debounced analysis — mode follows structural stage
  useDebouncedCheck({
    text: state.text,
    mode: apiMode,
    supa,
    dispatch,
    titles,
  });

  const computedStage = useMemo(
    () => resolveStage(structuralStage, state.issues, state.hasChecked, { sentenceCount, deviceCount, bodyParaStats }),
    [structuralStage, state.issues, state.hasChecked, sentenceCount, deviceCount, bodyParaStats]
  );

  // Apply manual override: use whichever is further ahead
  const stage = useMemo(() => {
    if (!stageOverride) return computedStage;
    const compIdx = STAGE_ORDER.indexOf(computedStage);
    const overIdx = STAGE_ORDER.indexOf(stageOverride);
    return overIdx > compIdx ? stageOverride : computedStage;
  }, [computedStage, stageOverride]);

  // Clear override when computed stage catches up or passes it
  useEffect(() => {
    if (stageOverride) {
      const compIdx = STAGE_ORDER.indexOf(computedStage);
      const overIdx = STAGE_ORDER.indexOf(stageOverride);
      if (compIdx >= overIdx) setStageOverride(null);
    }
  }, [computedStage, stageOverride]);

  const handleSkipStage = useCallback(() => {
    const next = nextStage(stage);
    if (next) setStageOverride(next);
  }, [stage]);
  const filtered = useMemo(
    () => filterByStage(state.issues, state.labelCounts, stage),
    [state.issues, state.labelCounts, stage]
  );

  // Jump to issue in editor when sidebar issue is clicked
  const handleIssueClick = useCallback((label) => {
    // Find an example sentence for this label
    const example = (state.examples || []).find(
      (ex) => ex.label === label && ex.sentence
    );
    if (!example) return;

    // Find the sentence text in the editor DOM
    const editorEl = editorWrapRef.current?.querySelector(".write-editor-area");
    if (!editorEl) return;

    const snippet = example.sentence.trim();
    // Walk text nodes to find a match
    const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
    let node;
    let found = false;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf(snippet);
      if (idx >= 0) {
        // Create a range around the matched text
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + snippet.length);

        // Scroll the match into view
        const rect = range.getBoundingClientRect();
        const container = editorEl;
        const containerRect = container.getBoundingClientRect();
        if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
          const scrollTarget = rect.top - containerRect.top + container.scrollTop - 60;
          container.scrollTo({ top: scrollTarget, behavior: "smooth" });
        }

        // Flash highlight using a temporary mark element
        const mark = document.createElement("mark");
        mark.className = "write-issue-flash";
        range.surroundContents(mark);
        setTimeout(() => {
          // Unwrap the mark, keeping the text
          const parent = mark.parentNode;
          if (parent) {
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
          }
        }, 1500);

        found = true;
        break;
      }
    }

    // If snippet spans multiple text nodes, try matching across a paragraph
    if (!found) {
      const paragraphs = editorEl.querySelectorAll("p");
      for (const p of paragraphs) {
        const pText = p.textContent || "";
        if (pText.includes(snippet)) {
          p.scrollIntoView({ behavior: "smooth", block: "center" });
          p.classList.add("write-issue-flash-para");
          setTimeout(() => p.classList.remove("write-issue-flash-para"), 1500);
          break;
        }
      }
    }
  }, [state.examples]);

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
    return null;
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
        products={products}
      />

      <main className="page write-page">
        <div className="write-grid">
          <section className="write-left">
            <div className="card write-editor-card" ref={editorWrapRef}>
              <WriteEditor
                text={state.text}
                onChange={(value) => dispatch({ type: "SET_TEXT", payload: value })}
                isChecking={state.isChecking}
                wordCount={liveWordCount}
                authorName={state.authorName}
                onAuthorNameChange={(v) => dispatch({ type: "SET_AUTHOR_NAME", payload: v })}
                textTitle={state.textTitle}
                onTextTitleChange={(v) => dispatch({ type: "SET_TEXT_TITLE", payload: v })}
                metrics={state.metrics}
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
              textTitle={state.textTitle}
              textIsMinor={state.textIsMinor}
              onTextIsMinorChange={(val) => dispatch({ type: "SET_TEXT_IS_MINOR", payload: val })}
              sentenceCount={sentenceCount}
              onDeviceCountChange={setDeviceCount}
              bodyParaStats={bodyParaStats}
              thesisSentence={thesisSentence}
              onIssueClick={handleIssueClick}
              onSkipStage={handleSkipStage}
              essayText={state.text}
            />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
