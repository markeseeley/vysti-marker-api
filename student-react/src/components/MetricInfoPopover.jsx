import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { METRIC_INFO } from "../lib/studentMetrics";

export default function MetricInfoPopover({ isOpen, anchorEl, metricKey, onClose }) {
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || !popoverRef.current) return;
    const popover = popoverRef.current;
    const rect = anchorEl.getBoundingClientRect();
    const gap = 10;
    const padding = 12;
    popover.style.display = "block";
    popover.style.visibility = "hidden";
    const popRect = popover.getBoundingClientRect();
    const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.visibility = "visible";
  }, [anchorEl, isOpen, metricKey]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClick = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (anchorEl?.contains(event.target)) return;
      onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handleReposition = () => {
      if (!popoverRef.current || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const gap = 10;
      const padding = 12;
      const popRect = popoverRef.current.getBoundingClientRect();
      const fitsBelow = rect.bottom + gap + popRect.height <= window.innerHeight;
      const top = fitsBelow ? rect.bottom + gap : rect.top - gap - popRect.height;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));
      popoverRef.current.style.top = `${Math.round(top)}px`;
      popoverRef.current.style.left = `${Math.round(left)}px`;
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [anchorEl, isOpen, onClose]);

  if (!isOpen) return null;
  const info = METRIC_INFO[metricKey] || {};

  return createPortal(
    <div ref={popoverRef} className="tour-popover metric-popover">
      <div className="tour-title">{info.title || "Metric"}</div>
      <div className="tour-body">{info.body || ""}</div>
      {info.tips?.length ? (
        <>
          <div className="metric-popover-tips-title">Tips</div>
          <ul className="metric-popover-list">
            {info.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>,
    document.body
  );
}
