import { useEffect } from "react";

export default function usePlannerResultFocus(targetRef, revision) {
  useEffect(() => {
    if (!revision) return undefined;
    const frame = window.requestAnimationFrame(() => targetRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [revision, targetRef]);
}
