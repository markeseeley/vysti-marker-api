import { useCallback, useEffect, useRef, useState } from "react";
import "./TeacherApp.css";
import Footer from "./components/Footer";
import TeacherTopbar from "./components/TeacherTopbar";
import ClassOverview from "./components/ClassOverview";
import DocumentDetail from "./components/DocumentDetail";
import { useAuthSession } from "./hooks/useAuthSession";
import { useTeacherReducer } from "./hooks/useTeacherReducer";
import { markTeacherEssay } from "./services/markTeacher";
import { downloadBlob } from "@shared/download";
import {
  saveTeacherSession,
  loadTeacherSession,
  deleteTeacherSession,
  peekTeacherSession,
  serializeSession,
  saveMarkedBlobs,
  loadMarkedBlobs,
  deleteMarkedBlobs,
  throttle,
} from "./services/teacherSessionStore";
import { findAllRevisionDrafts } from "./services/revisionDraftStore";
import { peekWriteDraft } from "./WriteApp";
import { getApiUrls } from "./config";
import { parseFilename } from "./lib/filenameParser";

export default function TeacherApp() {
  const { supa, isChecking, authError, products, entitlement, setEntitlement } = useAuthSession("teacher");
  const [state, dispatch, derived] = useTeacherReducer();
  const [userId, setUserId] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [keepWorkingItems, setKeepWorkingItems] = useState([]);

  // Refs for auto-save throttle
  const saveThrottleRef = useRef(null);
  const blobThrottleRef = useRef(null);
  const resumedRef = useRef(false);
  const autoMarkRef = useRef(false);

  // ── Product guard: redirect if user lacks Mark product ──
  useEffect(() => {
    if (isChecking) return;
    if (!products.has_mark && !products.has_revise) {
      window.location.assign("/role.html");
    } else if (products.has_mark === false && products.has_revise === true) {
      window.location.assign("/student_react.html");
    }
  }, [isChecking, products]);

  // ── Get userId on auth ──
  useEffect(() => {
    if (!supa) return;
    (async () => {
      try {
        const { data: session } = await supa.auth.getSession();
        if (session?.session) {
          setUserId(session.session.user.id);
        }
      } catch {}
    })();
  }, [supa]);

  // ── Load classes on mount ──
  useEffect(() => {
    if (!supa) return;
    (async () => {
      try {
        const { data: session } = await supa.auth.getSession();
        if (!session?.session) return;
        const uid = session.session.user.id;
        const { data } = await supa
          .from("classes")
          .select("*")
          .eq("user_id", uid)
          .eq("archived", false)
          .order("name");
        if (data) dispatch({ type: "SET_CLASSES", payload: data });
      } catch (err) {
        console.warn("Failed to load classes:", err);
      }
    })();
  }, [supa, dispatch]);

  // ── Check for saved session on mount ──
  useEffect(() => {
    if (!userId) return;
    const info = peekTeacherSession(userId);
    if (info) {
      setPendingRestore(info);
    }
  }, [userId]);

  // ── Compute cross-app "Keep working" items (Revise + Write) ──
  useEffect(() => {
    if (!userId || !supa) { setKeepWorkingItems([]); return; }
    let cancelled = false;
    (async () => {
      const items = [];
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
      // Check for Write draft
      const writeInfo = peekWriteDraft(userId);
      if (writeInfo) {
        items.push({
          mode: "write",
          label: "Write",
          sublabel: writeInfo.textTitle || "Draft",
          time: writeInfo.savedAt,
          href: "/write_react.html",
        });
      }
      if (!cancelled) setKeepWorkingItems(items);
    })();
    return () => { cancelled = true; };
  }, [userId, supa]);

  // ── Resume from student_progress "Continue" link (?event_id=<uuid>) ──
  useEffect(() => {
    if (!supa || resumedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event_id");
    if (!eventId) return;
    resumedRef.current = true;

    (async () => {
      try {
        const { data: sessionData } = await supa.auth.getSession();
        if (!sessionData?.session) return;
        const token = sessionData.session.access_token;

        // 1. Fetch the mark_event metadata
        const { markUrl } = getApiUrls();
        const baseUrl = markUrl ? markUrl.replace(/\/mark$/, "") : "";
        const evResp = await fetch(
          `${baseUrl}/mark_event?event_id=${encodeURIComponent(eventId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!evResp.ok) {
          console.warn("Failed to fetch mark event:", evResp.status);
          return;
        }
        const ev = await evResp.json();

        // 2. Set mode from the event
        if (ev.mode) dispatch({ type: "SET_MODE", payload: ev.mode });
        if (ev.class_id) dispatch({ type: "SET_CLASS_ID", payload: ev.class_id });

        // 3. Download the original docx
        const dlResp = await fetch(
          `${baseUrl}/download_original?file_name=${encodeURIComponent(ev.file_name)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!dlResp.ok) {
          console.warn("Failed to download original:", dlResp.status);
          return;
        }
        const blob = await dlResp.blob();
        const file = new File([blob], ev.file_name, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // 4. Add the file and trigger auto-mark
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

        // Clean the URL so a page refresh doesn't re-trigger
        const clean = new URL(window.location.href);
        clean.searchParams.delete("event_id");
        window.history.replaceState({}, "", clean.pathname + clean.search);
      } catch (err) {
        console.warn("Failed to resume from event:", err);
      }
    })();
  }, [supa, dispatch]);

  // ── Resume session handler ──
  const handleResumeSession = useCallback(async () => {
    if (!userId) return;
    const session = loadTeacherSession(userId);
    if (!session?.files?.length) {
      setPendingRestore(null);
      return;
    }

    // Load blobs from IndexedDB
    const fileIds = session.files.map((f) => f.id);
    const blobMap = await loadMarkedBlobs(userId, fileIds);

    // Merge blobs back into file objects
    const filesWithBlobs = session.files.map((f) => ({
      ...f,
      markedBlob: blobMap.get(f.id) || null,
      downloadUrl: blobMap.has(f.id) ? URL.createObjectURL(blobMap.get(f.id)) : null,
      file: null, // original File object is not restorable
      error: null,
      hasRevisedSinceMark: false,
    }));

    dispatch({
      type: "RESTORE_SESSION",
      payload: { ...session, files: filesWithBlobs },
    });
    setPendingRestore(null);
  }, [userId, dispatch]);

  // ── Dismiss saved session handler ──
  const handleDismissSession = useCallback(async () => {
    if (userId) {
      deleteTeacherSession(userId);
      await deleteMarkedBlobs(userId).catch(() => {});
    }
    setPendingRestore(null);
  }, [userId]);

  // ── Auto-save session (throttled) ──
  useEffect(() => {
    if (!userId) return;

    if (!saveThrottleRef.current) {
      saveThrottleRef.current = throttle((uid, st) => {
        const markedFiles = st.files.filter((f) => f.status === "marked");
        if (markedFiles.length > 0) {
          saveTeacherSession(uid, serializeSession(st));
        }
      }, 5000);
    }
    if (!blobThrottleRef.current) {
      blobThrottleRef.current = throttle((uid, files) => {
        const markedFiles = files.filter((f) => f.status === "marked" && f.markedBlob);
        if (markedFiles.length > 0) {
          saveMarkedBlobs(uid, markedFiles);
        }
      }, 15000);
    }

    const markedCount = state.files.filter((f) => f.status === "marked").length;
    if (markedCount === 0) return;

    saveThrottleRef.current(userId, state);
    blobThrottleRef.current(userId, state.files);
  }, [userId, state]);

  // ── Auto-save active document's HTML periodically ──
  useEffect(() => {
    if (!derived.activeDoc) return;
    const docId = derived.activeDoc.id;

    const interval = setInterval(() => {
      const container = document.querySelector(".marked-preview-inner");
      if (container) {
        dispatch({ type: "FILE_SAVED", id: docId, html: container.innerHTML });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [derived.activeDoc?.id, dispatch]);

  // ── Save on beforeunload ──
  useEffect(() => {
    if (!userId) return;

    const handler = () => {
      const markedFiles = state.files.filter((f) => f.status === "marked");
      if (markedFiles.length === 0) return;

      // Capture active doc HTML before unload
      if (derived.activeDoc) {
        const container = document.querySelector(".marked-preview-inner");
        if (container) {
          dispatch({ type: "FILE_SAVED", id: derived.activeDoc.id, html: container.innerHTML });
        }
      }

      // Synchronous localStorage save (IndexedDB may not complete in time)
      saveTeacherSession(userId, serializeSession(state));
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [userId, state, derived.activeDoc, dispatch]);

  // ── Mark all files sequentially ──
  const handleMarkAll = useCallback(async () => {
    if (!supa || state.files.length === 0 || state.isProcessing) return;

    // Free tier: block if already used their mark — redirect to subscribe
    if (entitlement.subscription_tier === "free" && entitlement.marks_used >= entitlement.marks_limit) {
      alert("Subscribe to mark more essays.");
      window.location.assign("/role.html");
      return;
    }

    // If there was a pending restore, dismiss it since we're starting fresh
    if (pendingRestore && userId) {
      deleteTeacherSession(userId);
      deleteMarkedBlobs(userId).catch(() => {});
      setPendingRestore(null);
    }

    const filesToMark = state.files.filter((f) => f.status === "queued" || f.status === "error");
    if (filesToMark.length === 0) return;

    dispatch({ type: "MARK_START", total: filesToMark.length });

    let firstMarkedId = null;

    for (let i = 0; i < filesToMark.length; i++) {
      const f = filesToMark[i];
      dispatch({ type: "MARK_PROGRESS", current: i + 1 });
      dispatch({ type: "FILE_PROCESSING", payload: f.id });

      // Determine student/assignment names
      const sName = f.studentName || state.studentName;
      const aName = state.applyToAll
        ? (state.assignmentName || f.assignmentName)
        : (f.assignmentName || state.assignmentName);

      try {
        const result = await markTeacherEssay({
          supa,
          file: f.file,
          mode: state.mode,
          rules: state.rules,
          works: state.works,
          studentName: sName,
          assignmentName: aName,
          classId: f.classId || state.classId,
        });

        dispatch({
          type: "FILE_MARKED",
          id: f.id,
          blob: result.blob,
          downloadUrl: result.downloadUrl,
          metadata: result.metadata,
        });

        if (!firstMarkedId) firstMarkedId = f.id;

        // Update entitlement count so free-tier pre-check stays current
        setEntitlement((prev) => ({ ...prev, marks_used: prev.marks_used + 1 }));

      } catch (err) {
        console.error("Mark failed for", f.fileName, err);
        dispatch({ type: "FILE_ERROR", id: f.id, error: err.message });
        if (err?.isEntitlementError) {
          alert("Subscribe to mark more essays.");
          window.location.assign("/role.html");
          break;
        }
      }
    }

    dispatch({ type: "MARK_DONE" });

    // Auto-navigate to the first successfully marked document
    if (firstMarkedId) {
      dispatch({ type: "SELECT_DOCUMENT", payload: firstMarkedId });
    }
  }, [supa, state, dispatch, pendingRestore, userId, entitlement]);

  // ── Auto-mark files added from resume flow ──
  useEffect(() => {
    if (autoMarkRef.current && !state.isProcessing && state.files.some((f) => f.status === "queued")) {
      autoMarkRef.current = false;
      handleMarkAll();
    }
  }, [state.files, state.isProcessing, handleMarkAll]);

  const handleSignOut = useCallback(async () => {
    if (supa) await supa.auth.signOut();
    try { localStorage.removeItem("vysti_role"); localStorage.removeItem("vysti_products"); } catch {}
    window.location.href = "/signin.html";
  }, [supa]);

  // Auth guard
  if (isChecking) {
    return null;
  }
  if (authError) {
    return (
      <main className="page teacher-page">
        <div className="card form-card"><p>{authError}</p></div>
      </main>
    );
  }

  const showDetail = derived.activeDoc !== null;

  return (
    <>
      <TeacherTopbar
        onRepeatTutorial={() => {}}
        onSignOut={handleSignOut}
        pendingRestore={pendingRestore}
        onResumeSession={handleResumeSession}
        onDismissSession={handleDismissSession}
        keepWorkingItems={keepWorkingItems}
      />

      <main className="page teacher-page">
        {showDetail ? (
          <DocumentDetail
            doc={derived.activeDoc}
            state={state}
            dispatch={dispatch}
            supa={supa}
            derived={derived}
          />
        ) : (
          <ClassOverview
            state={state}
            dispatch={dispatch}
            derived={derived}
            onMarkAll={handleMarkAll}
            entitlement={entitlement}
          />
        )}
      </main>

      <Footer />
    </>
  );
}
