export function makeAbortableTimeout(ms) {
  const controller = new AbortController();
  let timeoutId = null;
  const signal = controller.signal;

  if (ms && Number.isFinite(ms) && ms > 0) {
    timeoutId = window.setTimeout(() => {
      signal.__abortReason = "timeout";
      controller.abort();
    }, ms);
  }

  const cancel = () => {
    if (signal.aborted) return;
    signal.__abortReason = "cancel";
    controller.abort();
  };

  const clear = () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { signal, cancel, controller, clear };
}

export async function fetchWithTimeout(url, options = {}, { timeoutMs } = {}) {
  const externalSignal = options.signal;
  const controller = new AbortController();
  let timedOut = false;
  let abortedByUser = false;
  let timeoutId = null;

  if (externalSignal) {
    externalSignal.addEventListener(
      "abort",
      () => {
        abortedByUser = externalSignal.__abortReason === "cancel";
        controller.abort();
      },
      { once: true }
    );
  }

  if (timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      const timeoutError = new Error("Request timed out");
      timeoutError.code = "TIMEOUT";
      throw timeoutError;
    }
    if (controller.signal.aborted || err?.name === "AbortError") {
      const abortError = new Error("Request canceled");
      abortError.code = abortedByUser ? "ABORTED" : "ABORTED";
      throw abortError;
    }
    throw err;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export async function extractErrorMessage(res) {
  if (!res) return "Unknown error";
  try {
    const text = await res.text();
    const trimmed = text.trim().slice(0, 200);
    return `${res.status} ${res.statusText}: ${trimmed || "Request failed"}`;
  } catch (err) {
    return `${res.status} ${res.statusText}`;
  }
}

export function isAuthExpired(res) {
  return res?.status === 401 || res?.status === 403;
}
