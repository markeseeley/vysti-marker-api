import { useEffect, useRef } from "react";

export function useDocxPreview({ blob, zoom, containerRef, onError }) {
  const renderIdRef = useRef(0);

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
      renderIdRef.current += 1;
    };
  }, [blob, containerRef, onError, zoom]);
}
