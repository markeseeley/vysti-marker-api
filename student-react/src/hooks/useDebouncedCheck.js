import { useEffect, useRef } from "react";
import { checkText } from "../services/checkText";

export function useDebouncedCheck({ text, mode, supa, dispatch, titles, debounceMs = 2700 }) {
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const lastSentRef = useRef("");
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = (text || "").trim();

    // Don't check if text is too short
    if (trimmed.length < 50) return undefined;

    // Re-check if text OR titles/mode changed
    const checkKey = `${trimmed}|${mode}|${JSON.stringify(titles)}`;
    if (checkKey === lastKeyRef.current) return undefined;

    timerRef.current = setTimeout(async () => {
      // Abort previous in-flight request
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "CHECK_START" });
      lastSentRef.current = trimmed;
      lastKeyRef.current = checkKey;

      try {
        const result = await checkText({
          supa,
          text: trimmed,
          mode,
          titles,
          signal: controller.signal,
        });
        dispatch({ type: "CHECK_SUCCESS", payload: result });
      } catch (err) {
        if (err.name !== "AbortError") {
          dispatch({ type: "CHECK_ERROR", payload: err.message });
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, mode, supa, dispatch, titles, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
