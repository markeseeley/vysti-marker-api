import { useEffect, useRef } from "react";

export function useDocxPreview({ blob, zoom, containerRef, onError, onEdit }) {
  const renderIdRef = useRef(0);
  const editHandlerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    renderIdRef.current += 1;
    const renderId = renderIdRef.current;
    container.innerHTML = "";

    if (!blob) {
      container.innerHTML =
        "<p class='preview-empty'>Upload and mark an essay to preview it here.</p>";
      return undefined;
    }

    const render = async () => {
      try {
        const buf = await blob.arrayBuffer();
        if (renderId !== renderIdRef.current) return;

        if (window.docx?.renderAsync) {
          await window.docx.renderAsync(buf, container, null, { inWrapper: true });
          if (renderId !== renderIdRef.current) return;
          container.contentEditable = "true";
          container.spellcheck = true;
          container.classList.add("preview-editable");
          container.style.zoom = zoom;
          if (typeof onEdit === "function") {
            const handler = () => onEdit();
            editHandlerRef.current = handler;
            container.addEventListener("input", handler);
            container.addEventListener("paste", handler);
          }
        } else {
          container.innerHTML =
            "<p>Preview not available. Please download the file to view.</p>";
        }
      } catch (err) {
        console.error("Failed to render preview", err);
        if (renderId !== renderIdRef.current) return;
        container.innerHTML =
          "<p>Error rendering preview. Please download the file to view.</p>";
        if (onError) onError(err);
      }
    };

    render();

    return () => {
      if (editHandlerRef.current) {
        container.removeEventListener("input", editHandlerRef.current);
        container.removeEventListener("paste", editHandlerRef.current);
        editHandlerRef.current = null;
      }
      renderIdRef.current += 1;
    };
  }, [blob, containerRef, onError, onEdit, zoom]);
}
