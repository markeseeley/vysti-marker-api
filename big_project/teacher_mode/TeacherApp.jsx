import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TeacherApp.css";
import Footer from "@student/components/Footer";
import TeacherTopbar from "./components/TeacherTopbar";
import ClassOverview from "./components/ClassOverview";
import DocumentDetail from "./components/DocumentDetail";
import RulesPanel, { getCustomizedCount } from "./components/RulesPanel";
import { useAuthSession } from "@student/hooks/useAuthSession";
import { useTeacherReducer } from "./hooks/useTeacherReducer";
import { markTeacherEssay } from "./services/markTeacher";
import { buildPowerVerbFormsSet, loadPowerVerbs } from "@student/lib/powerVerbs";
import { loadThesisDevicesLexicon } from "@student/lib/studentMetrics";
import { saveRecentWorks } from "./lib/recentWorks";
import { loadToolkitPrefs, saveToolkitPrefs } from "@student/lib/teacherToolkit";
import { parseFilename } from "@student/lib/filenameParser";
import TeacherTour from "./components/TeacherTour";
import PaywallModal from "@student/components/PaywallModal";

const TEACHER_TOUR_KEYS = [
  "vysti_teacher_tour_hide",
  "vysti_teacher_tour_completed",
];

export default function TeacherApp() {
  const { supa, isChecking, authError, entitlement, setEntitlement, products } = useAuthSession("teacher");
  const [state, dispatch, derived] = useTeacherReducer();
  const [powerVerbFormsSet, setPowerVerbFormsSet] = useState(null);
  const [thesisDevicesLexicon, setThesisDevicesLexicon] = useState(null);
  const resumedRef = useRef(false);
  const tourRef = useRef(null);
  // Cached userId for synchronous access in callbacks
  const userIdRef = useRef(null);
  // Holds mark_event data from the resume flow so handleMarkAll can restore the comment
  const resumeEventRef = useRef(null);
  // AbortController for cancelling in-flight marking requests
  const markAbortRef = useRef(null);
  // True while the ?event_id= resume flow is running (fetching + re-marking)
  const [resuming, setResuming] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("event_id");
  });
  const [resumeError, setResumeError] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  // Read checkout param synchronously during render (survives re-renders)
  const [checkoutBanner, setCheckoutBanner] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success" || checkout === "cancelled") {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
      return checkout;
    }
    return null;
  });

  // Auto-dismiss checkout banner after 8 seconds
  useEffect(() => {
    if (!checkoutBanner) return;
    const t = setTimeout(() => setCheckoutBanner(null), 8000);
    return () => clearTimeout(t);
  }, [checkoutBanner]);

  // Load scoring lexicons on mount (same as student App.jsx)
  useEffect(() => {
    let isActive = true;
    loadPowerVerbs().then(({ list }) => {
      if (!isActive) return;
      setPowerVerbFormsSet(buildPowerVerbFormsSet(list));
    });
    loadThesisDevicesLexicon().then(({ lexicon }) => {
      if (!isActive) return;
      setThesisDevicesLexicon(lexicon);
    });
    return () => { isActive = false; };
  }, []);

  // Load classes on mount
  useEffect(() => {
    if (!supa) return;
    (async () => {
      try {
        const { data: session } = await supa.auth.getSession();
        if (!session?.session) return;
        const userId = session.session.user.id;
        const { data } = await supa
          .from("classes")
          .select("*")
          .eq("user_id", userId)
          .eq("archived", false)
          .order("name");
        if (data) dispatch({ type: "SET_CLASSES", payload: data });
      } catch (err) {
        console.warn("Failed to load classes:", err);
      }
    })();
  }, [supa, dispatch]);

  // Cache userId + load toolkit prefs on mount
  useEffect(() => {
    if (!supa) return;
    (async () => {
      try {
        const { data } = await supa.auth.getSession();
        const userId = data?.session?.user?.id;
        if (userId) {
          userIdRef.current = userId;
          const prefs = loadToolkitPrefs(userId);
          if (prefs) dispatch({ type: "SET_TOOLKIT", payload: prefs });
        }
      } catch (err) {
        // ignore
      }
    })();
  }, [supa, dispatch]);

  // Resume from student_progress "Continue" link (?event_id=<uuid>)
  useEffect(() => {
    if (!supa || resumedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event_id");
    if (!eventId) { setResuming(false); return; }
    resumedRef.current = true;
    setResuming(true);
    setResumeError(null);

    (async () => {
      try {
        const { data: sessionData } = await supa.auth.getSession();
        if (!sessionData?.session) {
          console.warn("[resume] no session");
          setResumeError("Not signed in. Please sign in and try again.");
          return;
        }
        const userId = sessionData.session.user.id;
        userIdRef.current = userId;

        // 1. Fetch the mark_event metadata directly from Supabase
        const { data: ev, error: evError } = await supa
          .from("mark_events")
          .select("*")
          .eq("id", eventId)
          .single();
        if (evError || !ev) {
          console.warn("[resume] mark_event lookup failed:", evError?.message);
          setResumeError(`Could not find the document event. It may have been deleted.`);
          return;
        }
        // 2. Set mode, class, and works from the event
        if (ev.mode) dispatch({ type: "SET_MODE", payload: ev.mode });
        if (ev.class_id) dispatch({ type: "SET_CLASS_ID", payload: ev.class_id });
        if (ev.source_works?.length) dispatch({ type: "SET_WORKS", payload: ev.source_works });

        // 3. Try to download savedHtml (teacher edits) from storage
        const savedHtmlPath = `${userId}/${ev.file_name}.saved.html`;
        const { data: htmlBlob, error: htmlError } = await supa.storage
          .from("originals")
          .download(savedHtmlPath);

        if (!htmlError && htmlBlob && htmlBlob.size > 0) {
          // ── Fast path: restore from savedHtml (preserves teacher edits) ──
          const savedHtml = await htmlBlob.text();

          // Parse teacher comment from mark_event
          let teacherComment = null;
          if (ev.teacher_comment) {
            const raw = ev.teacher_comment;
            let score = null;
            let paragraph = raw;
            const scoreMatch = raw.match(/^Score:\s*(\d+)%\s*\n*/);
            if (scoreMatch) {
              score = parseInt(scoreMatch[1], 10);
              paragraph = raw.slice(scoreMatch[0].length).trim();
            }
            teacherComment = { paragraph, score, includeInDownload: true };
          }

          const p = parseFilename(ev.file_name);
          const fileId = `resume-${eventId}`;

          // Extract score from teacher comment (if present)
          const resumeScore = teacherComment?.score ?? null;

          // Compute word count from savedHtml (mark_events doesn't store word_count)
          let resumeWordCount = ev.word_count || 0;
          if (!resumeWordCount && savedHtml) {
            const tmp = document.createElement("div");
            tmp.innerHTML = savedHtml;
            const text = (tmp.textContent || "").trim();
            resumeWordCount = text ? text.split(/\s+/).length : 0;
          }

          // Restore session directly (mirrors RESTORE_SESSION in the reducer)
          dispatch({
            type: "RESTORE_SESSION",
            session: {
              mode: ev.mode,
              classId: ev.class_id || "",
              works: ev.source_works?.length ? ev.source_works : [],
              activeDocId: fileId,
              files: [{
                id: fileId,
                fileName: ev.file_name,
                studentName: ev.student_name || p.studentName,
                assignmentName: ev.assignment_name || p.assignmentName,
                classId: ev.class_id || "",
                status: "marked",
                markedMode: ev.mode,
                savedHtml,
                teacherComment,
                score: resumeScore,
                labelCounts: ev.label_counts || {},
                issues: ev.issues || [],
                examples: ev.examples || [],
                totalLabels: ev.total_labels || 0,
                wordCount: resumeWordCount,
                markEventId: ev.id,
                reviewStatus: ev.review_status || "in_progress",
                dismissedIssues: [],
              }],
            },
          });

          setResuming(false);
        } else {
          // ── Slow path: download original and re-mark ──
          const storagePath = `${userId}/${ev.file_name}`;
          const { data: dlData, error: dlError } = await supa.storage
            .from("originals")
            .download(storagePath);
          if (dlError || !dlData) {
            console.warn("[resume] storage download failed:", dlError?.message);
            setResumeError(`Could not download the original essay "${ev.file_name}". ${dlError?.message || ""}`);
            return;
          }
          const file = new File([dlData], ev.file_name, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

          // Stash the event data so handleMarkAll can restore teacher comment
          resumeEventRef.current = ev;

          const p = parseFilename(file.name);
          dispatch({
            type: "ADD_FILES",
            payload: [{
              file,
              studentName: ev.student_name || p.studentName,
              assignmentName: ev.assignment_name || p.assignmentName,
            }],
          });
          autoMarkRef.current = true;
        }

        // Clean the URL so a page refresh doesn't re-trigger
        const clean = new URL(window.location.href);
        clean.searchParams.delete("event_id");
        window.history.replaceState({}, "", clean.pathname + clean.search);
      } catch (err) {
        console.error("[resume] uncaught error:", err);
        setResumeError(`Failed to load document: ${err.message || err}`);
      }
    })();
  }, [supa, dispatch]);

  // Ref for auto-marking files added from preview page
  const autoMarkRef = useRef(false);

  // Cancel an in-flight marking run
  const handleCancelMark = useCallback(() => {
    markAbortRef.current?.abort("cancel");
  }, []);

  // Mark all files sequentially
  const handleMarkAll = useCallback(async () => {
    if (!supa || state.files.length === 0 || state.isProcessing) return;

    // Free tier: block if already used their mark — show paywall modal
    if (entitlement.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit) {
      setShowPaywall(true);
      return;
    }

    const filesToMark = state.files.filter((f) => f.status === "queued" || f.status === "error");
    if (filesToMark.length === 0) return;

    dispatch({ type: "MARK_START", total: filesToMark.length });

    // Abort any previous in-flight marking, then create a new controller
    markAbortRef.current?.abort();
    const abortController = new AbortController();
    markAbortRef.current = abortController;

    // Persist works to recent history so teacher can reuse them next time
    saveRecentWorks(state.works);

    let firstMarkedId = null;

    for (let i = 0; i < filesToMark.length; i++) {
      // Stop if marking was cancelled
      if (abortController.signal.aborted) break;

      const f = filesToMark[i];
      dispatch({ type: "MARK_PROGRESS", current: i + 1 });
      dispatch({ type: "FILE_PROCESSING", payload: f.id });

      // Determine student/assignment names
      const sName = f.studentName || state.studentName;
      const aName = state.applyToAll
        ? (state.assignmentName || f.assignmentName)
        : (f.assignmentName || state.assignmentName);

      // Per-file timeout: 3 minutes
      const timeoutId = setTimeout(() => abortController.abort(), 180_000);

      try {
        const result = await markTeacherEssay({
          supa,
          file: f.file,
          mode: state.mode,
          rules: state.rules,
          works: f.works || state.works,
          studentName: sName,
          assignmentName: aName,
          classId: f.classId || state.classId,
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        dispatch({
          type: "FILE_MARKED",
          id: f.id,
          mode: state.mode,
          blob: result.blob,
          downloadUrl: result.downloadUrl,
          metadata: result.metadata,
        });

        // Upload original to Supabase Storage so the resume flow can
        // re-download it later (best-effort, don't block on failure)
        try {
          const uid = userIdRef.current;
          if (uid && f.file) {
            const storagePath = `${uid}/${f.file.name}`;
            await supa.storage.from("originals").upload(storagePath, f.file, {
              upsert: true,
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
          }
        } catch (uploadErr) {
          console.warn("Original upload to storage failed (non-critical):", uploadErr);
        }

        if (!firstMarkedId) firstMarkedId = f.id;

        // Update entitlement count so free-tier pre-check stays current
        setEntitlement((prev) => ({ ...prev, marks_used: prev.marks_used + 1 }));

      } catch (err) {
        clearTimeout(timeoutId);
        // Handle paywall error from backend
        if (err?.isEntitlementError) {
          dispatch({ type: "FILE_ERROR", id: f.id, error: err.message });
          setShowPaywall(true);
          break;
        }
        const cancelled = abortController.signal.reason === "cancel";
        if (cancelled) {
          // User cancelled — revert this file to queued (not an error)
          dispatch({ type: "FILE_QUEUED", id: f.id });
          break;
        }
        const msg = abortController.signal.aborted
          ? "Marking timed out. Try again or use a smaller file."
          : err.message;
        console.error("Mark failed for", f.fileName, err);
        dispatch({ type: "FILE_ERROR", id: f.id, error: msg });
        if (abortController.signal.aborted) break;
      }
    }

    dispatch({ type: "MARK_DONE" });

    // Restore teacher comment from the resume event (if resuming from student_progress)
    const ev = resumeEventRef.current;
    if (ev && firstMarkedId && ev.teacher_comment) {
      // Parse "Score: 87%\n\nParagraph text..." back into { paragraph, score, includeInDownload }
      const raw = ev.teacher_comment;
      let score = null;
      let paragraph = raw;
      const scoreMatch = raw.match(/^Score:\s*(\d+)%\s*\n*/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
        paragraph = raw.slice(scoreMatch[0].length).trim();
      }
      dispatch({
        type: "SET_TEACHER_COMMENT",
        id: firstMarkedId,
        comment: { paragraph, score, includeInDownload: true },
      });
      resumeEventRef.current = null;
    }

    // Auto-navigate to the first successfully marked document
    if (firstMarkedId) {
      dispatch({ type: "SELECT_DOCUMENT", payload: firstMarkedId });
    }

    // Clear the resume loading screen (if this mark was triggered by ?event_id)
    if (firstMarkedId) {
      setResuming(false);
    } else {
      // Keep resuming=true so the error card stays visible
      setResumeError("Marking failed. Please try uploading the essay directly.");
    }
  }, [supa, state, dispatch, entitlement, setEntitlement]);

  // Add files from preview page and auto-mark them
  const handleAddFilesFromPreview = useCallback((rawFiles) => {
    // Free tier: block upload if marks exhausted
    if (entitlement.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit) {
      setShowPaywall(true);
      return;
    }
    const parsed = rawFiles.map((file) => {
      const p = parseFilename(file.name);
      return { file, studentName: p.studentName, assignmentName: p.assignmentName };
    });
    dispatch({ type: "ADD_FILES", payload: parsed });
    autoMarkRef.current = true;
  }, [dispatch, entitlement]);

  // Auto-mark files added from preview once state updates
  useEffect(() => {
    if (autoMarkRef.current && !state.isProcessing && state.files.some((f) => f.status === "queued")) {
      autoMarkRef.current = false;
      handleMarkAll();
    }
  }, [state.files, state.isProcessing, handleMarkAll]);

  const handleSignOut = useCallback(async () => {
    if (supa) await supa.auth.signOut();
    window.location.href = "/signin.html";
  }, [supa]);

  // Toolkit customization handler
  const handleToolkitChange = useCallback(async (enabledTools) => {
    dispatch({ type: "SET_TOOLKIT", payload: enabledTools });
    try {
      const { data } = await supa.auth.getSession();
      const userId = data?.session?.user?.id;
      if (userId) saveToolkitPrefs(userId, enabledTools);
    } catch {}
  }, [supa, dispatch]);

  const customizedCount = useMemo(
    () => getCustomizedCount(state.rules, state.mode),
    [state.rules, state.mode]
  );

  const handleRepeatTutorial = useCallback(() => {
    TEACHER_TOUR_KEYS.forEach((key) => { try { localStorage.removeItem(key); } catch {} });
    tourRef.current?.restartTour({ force: true });
  }, []);

  // Auth timeout — if isChecking stays true for 12s, show a fallback
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    if (!isChecking) return;
    const t = setTimeout(() => setAuthTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, [isChecking]);

  // Auth guard
  if (isChecking) {
    if (authTimedOut) {
      return (
        <main className="page teacher-page" style={{ textAlign: "center", paddingTop: "15vh" }}>
          <div className="card form-card" style={{ maxWidth: 440, margin: "0 auto", padding: "32px 28px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Unable to load</h2>
            <p style={{ color: "rgba(0,0,0,.55)", fontSize: 14, lineHeight: 1.5 }}>
              We couldn't verify your session. This is usually caused by a slow connection or cached files.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid var(--maroon, #A90D22)", background: "var(--maroon, #A90D22)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/signin.html"; }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid rgba(0,0,0,.15)", background: "#fff", color: "rgba(0,0,0,.7)", fontWeight: 600, cursor: "pointer" }}
              >
                Sign in again
              </button>
            </div>
          </div>
        </main>
      );
    }
    return null;
  }
  if (authError) {
    return (
      <main className="page teacher-page" style={{ textAlign: "center", paddingTop: "15vh" }}>
        <div className="card form-card" style={{ maxWidth: 440, margin: "0 auto", padding: "32px 28px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Something went wrong</h2>
          <p style={{ color: "rgba(0,0,0,.55)", fontSize: 14, lineHeight: 1.5 }}>{authError}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid var(--maroon, #A90D22)", background: "var(--maroon, #A90D22)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/signin.html"; }}
              style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid rgba(0,0,0,.15)", background: "#fff", color: "rgba(0,0,0,.7)", fontWeight: 600, cursor: "pointer" }}
            >
              Sign in again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const showDetail = derived.activeDoc !== null;
  const hasMarkedDoc = state.files.some((f) => f.status === "marked");

  return (
    <>
      <TeacherTopbar
        onRepeatTutorial={handleRepeatTutorial}
        onSignOut={handleSignOut}
        products={products}
        entitlement={entitlement}
        onSubscribe={() => setShowPaywall(true)}
      />

      <TeacherTour
        ref={tourRef}
        authReady={!isChecking && !authError}
        showDetail={showDetail}
        hasMarkedDoc={hasMarkedDoc}
        hasFiles={state.files.length > 0}
      />

      <main className="page teacher-page">
        {checkoutBanner && (
          <div className={`checkout-banner checkout-banner--${checkoutBanner}`} role="status">
            <span>
              {checkoutBanner === "success"
                ? "Payment successful! You now have full access."
                : "Checkout was cancelled. You can try again any time."}
            </span>
            <button
              type="button"
              className="checkout-banner-close"
              aria-label="Dismiss"
              onClick={() => setCheckoutBanner(null)}
            >&times;</button>
          </div>
        )}
        {/* Loading screen while resuming from student_progress ?event_id link */}
        {resuming && !showDetail ? (
          <div className="card form-card teacher-resume-loading">
            {resumeError ? (
              <>
                <p className="teacher-resume-error">{resumeError}</p>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => { setResuming(false); setResumeError(null); }}
                >
                  Go to upload
                </button>
              </>
            ) : (
              <>
                <p className="teacher-resume-status">
                  Loading document{state.isProcessing ? " — marking" : ""}
                  <span className="loading-cursor" />
                </p>
                <p className="helper-text">Fetching and re-marking the essay. This may take a moment.</p>
              </>
            )}
          </div>
        ) : showDetail ? (
          <DocumentDetail
            doc={derived.activeDoc}
            state={state}
            dispatch={dispatch}
            supa={supa}
            derived={derived}
            powerVerbFormsSet={powerVerbFormsSet}
            thesisDevicesLexicon={thesisDevicesLexicon}
            toolkitEnabled={state.toolkitEnabled}
            onToolkitChange={handleToolkitChange}
            onAddFiles={handleAddFilesFromPreview}
            entitlement={entitlement}
            onUpgrade={() => setShowPaywall(true)}
          />
        ) : (
          <ClassOverview
            state={state}
            dispatch={dispatch}
            derived={derived}
            onMarkAll={handleMarkAll}
            onCancelMark={handleCancelMark}
            entitlement={entitlement}
            onUpgrade={() => setShowPaywall(true)}
          />
        )}
      </main>

      <RulesPanel
        rules={state.rules}
        onChange={(key, value) => dispatch({ type: "SET_RULE", key, value })}
        mode={state.mode}
        open={state.prefsOpen}
        onClose={() => dispatch({ type: "CLOSE_PREFS" })}
      />

      <Footer />
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        returnPath="/teacher_react.html"
      />
    </>
  );
}
