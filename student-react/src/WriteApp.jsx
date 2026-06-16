import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./WriteApp.css";
import { useWriteReducer } from "./hooks/useWriteReducer";
import { useDebouncedCheck } from "./hooks/useDebouncedCheck";
import { useAuthSession } from "./hooks/useAuthSession";
import { getConfig } from "./config";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { exportDocx } from "@shared/markingApi";
import { downloadBlob } from "@shared/download";
import { detectStage, resolveStage, filterByStage, countSentences, nextStage, STAGE_ORDER, STAGE_FIRST_SENTENCE, STAGE_CLOSED_THESIS, STAGE_INTRO_SUMMARY, STAGE_TOPIC_SENTENCE, STAGE_BODY_EVIDENCE, STAGE_CONCLUSION, STAGE_COMPLETE } from "./lib/writingStage";
import { peekTeacherSession } from "./services/teacherSessionStore";
import { findAllRevisionDrafts } from "./services/revisionDraftStore";
import WriteTopbar from "./components/WriteTopbar";
import WriteEditor from "./components/WriteEditor";
import WriteSidebar from "./components/WriteSidebar";
import WriteTour from "./components/WriteTour";
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

// Stable anonymous identifier for draft-scoping and analytics. Generated on
// first Write visit and persisted in localStorage so the same browser keeps
// the same "anon-" prefix across sessions until the user signs in.
function getAnonymousId() {
  try {
    let id = localStorage.getItem("vysti_anon_id");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem("vysti_anon_id", id);
    }
    return id;
  } catch {
    return "anon-fallback";
  }
}

export default function WriteApp() {
  // skipRedirect: stay on Write even without a session — Write is a free,
  // sign-in-optional tool. The hook still applies the session if one exists
  // so logged-in users get their normal entitlements.
  const { supa, isChecking: authChecking, products } = useAuthSession("student", { skipRedirect: true });
  const [state, dispatch] = useWriteReducer();
  const [authReady, setAuthReady] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [stageOverride, setStageOverride] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [downloadState, setDownloadState] = useState("idle"); // idle | preparing | failed
  const [downloadError, setDownloadError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const downloadFetchTimerRef = useRef(null);
  const [keepWorkingItems, setKeepWorkingItems] = useState([]);
  const [signinPrompt, setSigninPrompt] = useState(null); // null | "save" | "download" | "revise"
  const saveTimerRef = useRef(null);
  const tourRef = useRef(null);
  const draftRestoredRef = useRef(false);
  const editorWrapRef = useRef(null);

  // Extract userId on auth ready. If no session: fall back to an anonymous
  // ID so draft autosave / KeepWorking menu still scope correctly.
  const isLocalDev = window.location.hostname === "localhost";
  useEffect(() => {
    if (isLocalDev) {
      setAuthReady(true);
      setUserId("local-dev");
      setIsAnonymous(false);
      return;
    }
    if (!authChecking) {
      setAuthReady(true);
      if (!supa) {
        // Supabase client not available — treat as anonymous
        setUserId(getAnonymousId());
        setIsAnonymous(true);
        return;
      }
      (async () => {
        try {
          const { data } = await supa.auth.getSession();
          const uid = data?.session?.user?.id;
          if (uid) {
            setUserId(uid);
            setIsAnonymous(false);
          } else {
            setUserId(getAnonymousId());
            setIsAnonymous(true);
          }
        } catch {
          setUserId(getAnonymousId());
          setIsAnonymous(true);
        }
      })();
    }
  }, [authChecking, supa, isLocalDev]);

  // Restore draft from localStorage on mount. Pending-essay (from a
  // pre-sign-in stash) takes priority over a regular draft and gets
  // cleared after restore so it only fires once.
  const [postSigninNotice, setPostSigninNotice] = useState(null);
  useEffect(() => {
    if (!userId || draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    let restored = false;
    try {
      const pendingRaw = localStorage.getItem("vysti_write_pending_essay");
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (pending?.text?.trim() && !isAnonymous) {
          // Only restore if user is actually signed in now — otherwise
          // they could keep the stash and we'd loop the sign-in prompt.
          dispatch({ type: "RESTORE_DRAFT", payload: pending });
          setPostSigninNotice(pending.intent || "save");
          try { localStorage.removeItem("vysti_write_pending_essay"); } catch {}
          restored = true;
        }
      }
    } catch {}

    if (!restored) {
      const draft = loadWriteDraft(userId);
      if (draft) {
        dispatch({ type: "RESTORE_DRAFT", payload: draft });
      }
    }
  }, [userId, isAnonymous, dispatch]);

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
          href: "/mark",
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
            href: `/revise?resumeDraft=${encodeURIComponent(drafts[0].fileName)}&resumeMode=${encodeURIComponent(drafts[0].mode || "textual_analysis")}`,
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
  const handleIssueClick = useCallback((label, issue) => {
    const editorEl = editorWrapRef.current?.querySelector(".write-editor-area");
    if (!editorEl) return;

    // Noun repetition: highlight the actual repeated noun (word-level),
    // not the surrounding sentence. Use the most-repeated noun from
    // state.repeatedNouns (sorted by count descending in the backend).
    let snippet = null;
    if (label === "Noun repetition") {
      const top = (state.repeatedNouns || [])[0];
      const noun = top?.lemma;
      if (noun) {
        const re = new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\w*`, "i");
        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
        let node, found = false;
        while ((node = walker.nextNode())) {
          const m = node.textContent.match(re);
          if (m) {
            const idx = node.textContent.toLowerCase().indexOf(m[0].toLowerCase());
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + m[0].length);
            const rect = range.getBoundingClientRect();
            const containerRect = editorEl.getBoundingClientRect();
            if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
              editorEl.scrollTo({
                top: rect.top - containerRect.top + editorEl.scrollTop - 60,
                behavior: "smooth",
              });
            }
            const mark = document.createElement("mark");
            mark.className = "write-issue-flash";
            range.surroundContents(mark);
            setTimeout(() => {
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
        if (found) return;
      }
    }

    // Default: find an example sentence for this label
    const example = (state.examples || []).find(
      (ex) => ex.label === label && ex.sentence
    );
    if (!example) return;
    snippet = example.sentence.trim();
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
  }, [state.examples, state.repeatedNouns]);

  // Download handler
  // Background pre-prepare the download: every time the text changes,
  // call /prepare_download to get a short-lived URL that serves the .docx
  // with a proper Content-Disposition header. The Download click then
  // navigates to that REAL URL (not a blob: URL), which gets the filename
  // from the server header — reliable across browsers/extensions even
  // when the `download` attribute on blob URLs is silently ignored.
  //
  // Skip entirely for anonymous users — /prepare_download requires auth
  // and the click will open a sign-in prompt instead.
  useEffect(() => {
    if (isAnonymous) {
      setDownloadUrl(null);
      setDownloadState("idle");
      return;
    }
    if (!state.text.trim()) {
      setDownloadUrl(null);
      setDownloadState("idle");
      return;
    }
    if (downloadFetchTimerRef.current) clearTimeout(downloadFetchTimerRef.current);
    setDownloadUrl(null); // invalidate stale token immediately
    setDownloadState("preparing");
    downloadFetchTimerRef.current = setTimeout(async () => {
      try {
        let token = "dev";
        if (!isLocalDev && supa) {
          const { data } = await supa.auth.getSession();
          token = data?.session?.access_token || "";
        }
        const apiBase = isLocalDev ? "" : getApiBaseUrl("");
        const resp = await fetch(`${apiBase}/prepare_download`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: state.text, file_name: "essay.docx" }),
        });
        if (!resp.ok) throw new Error(`prepare_download failed (${resp.status})`);
        const data = await resp.json();
        if (!data.download_url) throw new Error("Missing download_url in response");
        setDownloadUrl(data.download_url);
        setDownloadState("idle");
        setDownloadError(null);
      } catch (err) {
        console.error("Pre-fetch failed:", err);
        setDownloadState("failed");
        setDownloadError(err?.message || String(err));
      }
    }, 1500);
    return () => {
      if (downloadFetchTimerRef.current) clearTimeout(downloadFetchTimerRef.current);
    };
  }, [state.text, supa, isLocalDev, isAnonymous]);

  // "Open in Revise" — stash the current essay so Revise can auto-load
  // it after auth, then navigate. Anonymous users go through the sign-in
  // prompt first (the modal also stashes under vysti_write_pending_essay
  // so the essay is restored on return to Write).
  const handleOpenInRevise = useCallback(() => {
    if (!state.text.trim()) return;
    if (isAnonymous) {
      setSigninPrompt("revise");
      return;
    }
    try {
      localStorage.setItem(
        "vysti_write_to_revise",
        JSON.stringify({
          text: state.text,
          authorName: state.authorName,
          textTitle: state.textTitle,
          textIsMinor: state.textIsMinor,
          stashed_at: new Date().toISOString(),
        })
      );
    } catch {}
    window.location.href = "/revise";
  }, [state.text, state.authorName, state.textTitle, state.textIsMinor, isAnonymous]);

  // Synchronous Download click — clicks a real HTTP URL whose
  // Content-Disposition controls the filename. No blob URL involved.
  // For anonymous users: open the sign-in prompt instead; downloading
  // requires an account so we have somewhere to bill it against.
  // After a successful click we flip to a "downloaded" state for 3s so
  // rapid re-clicks don't trigger a second download. The token is also
  // single-use server-side (GET pops the entry from _pending_downloads),
  // so a duplicate click would just 404 if we didn't pre-fetch a fresh
  // token — which we don't do until the text changes again.
  const handleDownload = useCallback(() => {
    if (isAnonymous) {
      setSigninPrompt("download");
      return;
    }
    if (!downloadUrl) return;
    if (downloadState === "downloaded") return; // double-click guard
    try {
      const apiBase = isLocalDev ? "" : getApiBaseUrl("");
      const link = document.createElement("a");
      link.href = `${apiBase}${downloadUrl}`;
      link.download = "essay.docx"; // hint; server's Content-Disposition is authoritative
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { try { link.remove(); } catch {} }, 1000);
      // Invalidate the token client-side too. Pre-fetch effect will
      // grab a fresh one only when state.text next changes.
      setDownloadUrl(null);
      setDownloadState("downloaded");
      setTimeout(() => setDownloadState("idle"), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadState("failed");
      setDownloadError(err?.message || String(err));
    }
  }, [downloadUrl, isLocalDev, isAnonymous, downloadState]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    if (!supa) {
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/write")}`
      );
      return;
    }
    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      localStorage.removeItem("vysti_products");
      window.location.replace(
        `/signin.html?redirect=${encodeURIComponent("/write")}`
      );
    }
  }, [supa]);

  if (!authReady) {
    return null;
  }

  return (
    <div className="student-react-shell">
      <WriteTopbar
        onRepeatTutorial={() => tourRef.current?.restartTour()}
        onSignOut={handleSignOut}
        onDownload={handleDownload}
        canDownload={isAnonymous ? Boolean(state.text.trim()) : Boolean(downloadUrl)}
        downloadState={isAnonymous ? "idle" : downloadState}
        downloadError={downloadError}
        onSave={handleSave}
        saveState={saveState}
        canSave={Boolean(state.text.trim())}
        keepWorkingItems={keepWorkingItems}
        products={products}
        isAnonymous={isAnonymous}
      />

      {isAnonymous && (
        <div className="write-anon-banner" role="status">
          <span>
            <strong>Working anonymously</strong> — your draft is saved on this device only.
          </span>
          <a
            className="write-anon-banner-link"
            href={`/signin.html?redirect=${encodeURIComponent("/write")}`}
          >
            Sign in to save & download &rarr;
          </a>
        </div>
      )}

      {postSigninNotice && !isAnonymous && (
        <div className="write-postsignin-notice" role="status">
          <span>
            Signed in — your essay is restored.
            {" "}
            {postSigninNotice === "download" && "Click Download to save it as a Word doc."}
            {postSigninNotice === "save" && "Click Save to keep it across devices."}
            {postSigninNotice === "revise" && "Finish your draft, then Open in Revise from the conclusion step."}
          </span>
          <button
            className="write-postsignin-dismiss"
            onClick={() => setPostSigninNotice(null)}
            aria-label="Dismiss"
          >&times;</button>
        </div>
      )}

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
              repeatedNouns={state.repeatedNouns}
              onOpenInRevise={handleOpenInRevise}
            />
          </aside>
        </div>
      </main>

      <Footer />

      <WriteTour ref={tourRef} />

      {signinPrompt && (
        <SigninPromptModal
          intent={signinPrompt}
          essay={{ text: state.text, authorName: state.authorName, textTitle: state.textTitle, textIsMinor: state.textIsMinor }}
          onClose={() => setSigninPrompt(null)}
        />
      )}
    </div>
  );
}

// Sign-in prompt shown when an anonymous user tries to Save/Download/Revise.
// Stashes the current essay to localStorage so it's restored after sign-in.
function SigninPromptModal({ intent, essay, onClose }) {
  const copy = {
    save: {
      title: "Sign in to save your draft",
      body: "Your draft is currently saved on this device only. Sign in to keep your work across devices and access it any time.",
      cta: "Sign in to save",
    },
    download: {
      title: "Sign in to download your essay",
      body: "Downloading a polished .docx copy of your essay is included with any paid plan. Sign in to unlock the download.",
      cta: "Sign in to download",
    },
    revise: {
      title: "Sign in to open Revise",
      body: "Revise gives you full feedback on your essay — every rule, every rewrite suggestion. Sign in to continue with your essay already filled in.",
      cta: "Sign in to continue",
    },
  };
  const m = copy[intent] || copy.save;
  const handleSignin = () => {
    try {
      localStorage.setItem(
        "vysti_write_pending_essay",
        JSON.stringify({ ...essay, intent, stashed_at: new Date().toISOString() })
      );
    } catch {}
    // Always return to Write after sign-in. The essay restores on mount and
    // the user can re-click Save / Download / Revise from there, now
    // authenticated. This avoids landing them in Revise empty-handed.
    window.location.href = `/signin.html?redirect=${encodeURIComponent("/write")}`;
  };
  return (
    <div className="write-signin-prompt-backdrop" onClick={onClose}>
      <div className="write-signin-prompt" onClick={(e) => e.stopPropagation()}>
        <button className="write-signin-prompt-close" onClick={onClose} aria-label="Close">&times;</button>
        <h3>{m.title}</h3>
        <p>{m.body}</p>
        <div className="write-signin-prompt-actions">
          <button className="write-signin-prompt-secondary" onClick={onClose}>Not yet</button>
          <button className="write-signin-prompt-primary" onClick={handleSignin}>{m.cta}</button>
        </div>
      </div>
    </div>
  );
}
