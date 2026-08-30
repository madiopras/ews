import React from "react";
import { renderMarkdown } from "../../lib/markdown.jsx";
import { isPlannerResultV2 } from "../../lib/plannerResultContract.js";
import StructuredPlannerResult from "./StructuredPlannerResult.jsx";

export default function ItineraryResult({ trip, t, lang, testId = "itinerary-result" }) {
  const result = isPlannerResultV2(trip?.structured_result) ? trip.structured_result : null;
  const invalidStructuredResult = !result && (trip?.result_version === 2 || trip?.structured_result?.version === 2);
  const resultLanguage = result?.request_snapshot?.lang || trip?.lang || lang;
  const fallbackMessage = t?.savedTrips?.structuredFallback || (
    resultLanguage === "en"
      ? "The card view could not be loaded. The readable itinerary is shown instead."
      : "Tampilan kartu tidak dapat dimuat. Itinerary yang tetap dapat dibaca ditampilkan sebagai pengganti."
  );
  return <article className="card-flat p-4 sm:p-7" data-testid={testId} data-result-version={result ? "2" : "1"} data-structured-invalid={invalidStructuredResult ? "true" : undefined}>
    {invalidStructuredResult && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950" role="status" data-testid="structured-result-fallback">{fallbackMessage}</p>}
    {result ? <StructuredPlannerResult
      result={result}
      lang={resultLanguage}
      t={t}
      destinationCardsEnabled
      partnerMatchesEnabled
      culinaryEnabled
    /> : renderMarkdown(trip?.content || "")}
  </article>;
}
