/**
 * Trigger a file download from a Blob.
 *
 * Returns `{ url, revoke }` so callers can offer a visible fallback link
 * when the programmatic click is silently blocked by the browser.
 *
 * Chrome blocks "automatic" downloads (link.click() outside a user gesture)
 * after the first one per page.  We mitigate this by:
 *   1. Wrapping the blob as application/octet-stream so Chrome treats it
 *      as a pure download rather than renderable content.
 *   2. Trying link.click() (works for the first download).
 *   3. Trying an iframe-based download as a secondary mechanism
 *      (not subject to the same gesture restrictions).
 *   4. Always returning { url, revoke } for a visible fallback link.
 *
 * Call `revoke()` when the fallback is no longer needed (or let the 60 s
 * auto-revoke handle it).
 */
export function downloadBlob(blob, filename) {
  // Wrap as octet-stream so the browser won't try to render/display the blob
  // inline — it will always treat it as a download.
  const downloadableBlob = new Blob([blob], { type: "application/octet-stream" });
  const url = URL.createObjectURL(downloadableBlob);

  // ── Primary: hidden <a> click ──
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";

  // Prevent the programmatic click from propagating through the DOM.
  link.addEventListener("click", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  });

  document.body.appendChild(link);

  let primaryClicked = false;
  try {
    link.click();
    primaryClicked = true;
  } catch (_) {
    // ignored — fall through to secondary mechanism
  }

  // Keep the link in the DOM briefly so the browser can start the download.
  setTimeout(() => {
    try { document.body.removeChild(link); } catch {}
  }, 2000);

  // ── Secondary: iframe-based download ──
  // Chrome may silently block the link.click() above after the first
  // automatic download on a page.  An iframe navigating to the blob URL
  // is a separate download pathway and often succeeds where click() fails.
  if (primaryClicked) {
    setTimeout(() => {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 5000);
      } catch (_) {
        // ignored — caller has the fallback url
      }
    }, 300);
  }

  // Revoke after a generous delay so the browser can finish writing the file.
  const revokeTimer = setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return {
    url,
    revoke() {
      clearTimeout(revokeTimer);
      URL.revokeObjectURL(url);
    },
    /** Cancel the auto-revoke timer without revoking the URL.
     *  Use when the caller wants to manage the URL lifetime itself. */
    cancelAutoRevoke() {
      clearTimeout(revokeTimer);
    },
  };
}
