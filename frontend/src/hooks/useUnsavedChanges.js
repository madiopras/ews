import { useEffect } from "react";

export default function useUnsavedChanges(active, message) {
  useEffect(() => {
    if (!active) return undefined;

    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptLink = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || event.defaultPrevented) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.href === window.location.href) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [active, message]);
}
