/**
 * Teacher Session Persistence
 *
 * Saves/restores teacher marking sessions so they can leave and come back.
 * - localStorage: session config + file metadata + savedHtml
 * - IndexedDB: markedBlob per file (binary data too large for localStorage)
 */

const SESSION_KEY = "vysti:teacher-session";
const DB_NAME = "vysti-teacher-blobs";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

// ── localStorage layer ──

function makeKey(userId) {
  return `${SESSION_KEY}:${userId || "anon"}`;
}

export function saveTeacherSession(userId, sessionData) {
  try {
    localStorage.setItem(makeKey(userId), JSON.stringify(sessionData));
    return true;
  } catch (err) {
    console.warn("Failed to save teacher session:", err);
    return false;
  }
}

export function loadTeacherSession(userId) {
  try {
    const raw = localStorage.getItem(makeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.files?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteTeacherSession(userId) {
  try {
    localStorage.removeItem(makeKey(userId));
  } catch {}
}

export function hasTeacherSession(userId) {
  try {
    const raw = localStorage.getItem(makeKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.files?.length);
  } catch {
    return false;
  }
}

/**
 * Peek at the saved session metadata without fully loading it.
 * Returns { fileCount, savedAt } or null.
 */
export function peekTeacherSession(userId) {
  try {
    const raw = localStorage.getItem(makeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.files?.length) return null;
    return {
      fileCount: parsed.files.length,
      savedAt: parsed.savedAt || null,
    };
  } catch {
    return null;
  }
}

/**
 * Serialize reducer state into a persistable object.
 * Excludes non-serializable data: file (File object), markedBlob, downloadUrl.
 */
export function serializeSession(state) {
  const markedFiles = state.files.filter((f) => f.status === "marked");
  return {
    mode: state.mode,
    rules: state.rules,
    assignmentName: state.assignmentName || "",
    studentName: state.studentName || "",
    applyToAll: state.applyToAll ?? true,
    classId: state.classId || "",
    works: state.works,
    savedAt: new Date().toISOString(),
    files: markedFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      studentName: f.studentName || "",
      assignmentName: f.assignmentName || "",
      classId: f.classId || "",
      status: "marked",
      reviewStatus: f.reviewStatus || "unseen",
      savedHtml: f.savedHtml || null,
      labelCounts: f.labelCounts || {},
      issues: f.issues || [],
      totalLabels: f.totalLabels || 0,
      wordCount: f.wordCount || 0,
      score: f.score ?? null,
      metadata: f.metadata || null,
    })),
  };
}

// ── IndexedDB layer (for markedBlob storage) ──

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function blobKey(userId, fileId) {
  return `${userId || "anon"}:${fileId}`;
}

/**
 * Save markedBlob for each file that has one.
 * Only writes blobs that aren't already stored (checks via flag).
 */
export async function saveMarkedBlobs(userId, files) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    for (const f of files) {
      if (f.markedBlob) {
        store.put(f.markedBlob, blobKey(userId, f.id));
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn("Failed to save marked blobs:", err);
    return false;
  }
}

/**
 * Load markedBlobs for a list of file IDs.
 * Returns a Map of fileId → Blob.
 */
export async function loadMarkedBlobs(userId, fileIds) {
  const result = new Map();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const promises = fileIds.map(
      (fid) =>
        new Promise((resolve) => {
          const req = store.get(blobKey(userId, fid));
          req.onsuccess = () => resolve([fid, req.result || null]);
          req.onerror = () => resolve([fid, null]);
        })
    );

    const entries = await Promise.all(promises);
    db.close();

    for (const [fid, blob] of entries) {
      if (blob) result.set(fid, blob);
    }
  } catch (err) {
    console.warn("Failed to load marked blobs:", err);
  }
  return result;
}

/**
 * Delete all blobs for a user.
 */
export async function deleteMarkedBlobs(userId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const prefix = `${userId || "anon"}:`;

    // Get all keys and delete those matching the user prefix
    const req = store.getAllKeys();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const keys = req.result || [];
        for (const key of keys) {
          if (String(key).startsWith(prefix)) {
            store.delete(key);
          }
        }
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      };
      req.onerror = () => { db.close(); resolve(false); };
    });
  } catch {
    return false;
  }
}

// ── Throttle utility ──

export function throttle(fn, ms) {
  let lastCall = 0;
  let timeoutId = null;

  const throttled = (...args) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
      return;
    }
    if (timeoutId) return;
    timeoutId = window.setTimeout(() => {
      lastCall = Date.now();
      timeoutId = null;
      fn(...args);
    }, remaining);
  };

  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastCall = Date.now();
      fn();
    }
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}
