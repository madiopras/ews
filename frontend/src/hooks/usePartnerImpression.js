import { useEffect, useRef } from "react";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";

export default function usePartnerImpression({
  partnerId,
  source,
  destinationId = null,
  analyticsContext = {},
  enabled = true,
}) {
  const elementRef = useRef(null);
  const trackedRef = useRef(false);
  const factorKey = Array.isArray(analyticsContext.match_factor_codes)
    ? analyticsContext.match_factor_codes.join("|")
    : "";

  useEffect(() => {
    trackedRef.current = false;
  }, [destinationId, partnerId, source]);

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element || !partnerId || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!visible || trackedRef.current) return;
      trackedRef.current = true;
      observer.disconnect();
      trackPartnerEvent(
        source === "planner" ? "ai_impression" : "directory_impression",
        partnerId,
        source,
        destinationId,
        {
          placement: analyticsContext.placement,
          relevance_score: analyticsContext.relevance_score,
          match_factor_codes: factorKey ? factorKey.split("|") : [],
        },
      );
    }, { threshold: [0.5] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [analyticsContext.placement, analyticsContext.relevance_score, destinationId, enabled, factorKey, partnerId, source]);

  return elementRef;
}
