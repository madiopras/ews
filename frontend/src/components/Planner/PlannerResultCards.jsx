import React, { useEffect, useMemo, useRef, useState } from "react";
import { Compass, MapPinned, RefreshCw, Sparkles } from "lucide-react";
import DestinationCard from "../DestinationCard.jsx";
import PartnerCard from "../PartnerCard.jsx";
import { api } from "../../lib/api.js";
import { groupPlannerRecommendations } from "../../lib/plannerRecommendationGroups.js";

const stableIds = (values) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];

function DestinationSkeletons() {
  return <div className="flex gap-4 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
    {[0, 1, 2].map((index) => <div key={index} className="w-[82vw] max-w-[320px] shrink-0 overflow-hidden rounded-2xl border border-line bg-white sm:w-auto sm:max-w-none">
      <div className="aspect-[4/3] animate-pulse bg-line/50" />
      <div className="space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-line/50" /><div className="h-4 w-1/2 animate-pulse rounded bg-line/40" /></div>
    </div>)}
  </div>;
}

export default function PlannerResultCards({
  enabled,
  ready,
  partnerMatchesEnabled,
  culinaryEnabled,
  destinationIds,
  recommendations,
  t,
}) {
  const ids = useMemo(() => stableIds(destinationIds), [destinationIds]);
  const [destinationState, setDestinationState] = useState({ status: "idle", items: [] });
  const [retryVersion, setRetryVersion] = useState(0);
  const groups = useMemo(
    () => partnerMatchesEnabled
      ? groupPlannerRecommendations(recommendations, { includeCulinary: culinaryEnabled })
      : [],
    [culinaryEnabled, partnerMatchesEnabled, recommendations],
  );
  const [activeType, setActiveType] = useState("");
  const tabRefs = useRef({});

  useEffect(() => {
    if (!enabled || !ready || ids.length === 0) {
      setDestinationState({ status: "idle", items: [] });
      return undefined;
    }
    const controller = new AbortController();
    setDestinationState((current) => ({ status: "loading", items: current.items }));
    api.post("/destinations/batch", { ids }, { signal: controller.signal })
      .then(({ data }) => setDestinationState({ status: "ready", items: Array.isArray(data) ? data : [] }))
      .catch((error) => {
        if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") {
          setDestinationState({ status: "error", items: [] });
        }
      });
    return () => controller.abort();
  }, [enabled, ids, ready, retryVersion]);

  useEffect(() => {
    if (!groups.some((group) => group.type === activeType)) setActiveType(groups[0]?.type || "");
  }, [activeType, groups]);

  if (!enabled || !ready) return null;

  const activeGroup = groups.find((group) => group.type === activeType) || groups[0];
  const moveTab = (event, direction) => {
    if (!groups.length) return;
    const current = Math.max(0, groups.findIndex((group) => group.type === activeType));
    const next = direction === "home" ? 0
      : direction === "end" ? groups.length - 1
        : (current + direction + groups.length) % groups.length;
    event.preventDefault();
    setActiveType(groups[next].type);
    window.requestAnimationFrame(() => tabRefs.current[groups[next].type]?.focus());
  };

  return <div className="min-w-0" data-testid="planner-result-cards">
    {ids.length > 0 && <section className="mt-8 border-t border-line pt-6" aria-labelledby="planner-destinations-title" data-testid="planner-destination-cards">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-toba/10 p-2 text-toba"><MapPinned className="h-5 w-5" aria-hidden="true" /></span>
        <div><h2 id="planner-destinations-title" className="font-display text-xl text-ink">{t.planner.destinationsInTrip}</h2><p className="mt-1 text-[12px] text-inkSoft">{t.planner.destinationsInTripSub}</p></div>
      </div>
      {destinationState.status === "loading" && <div role="status" aria-live="polite"><span className="sr-only">{t.common.loading}</span><DestinationSkeletons /></div>}
      {destinationState.status === "error" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="planner-destinations-error">
        <p>{t.planner.destinationCardsLoadError}</p>
        <button type="button" className="btn-outline mt-3" onClick={() => setRetryVersion((value) => value + 1)}><RefreshCw className="h-4 w-4" />{t.common.retry}</button>
      </div>}
      {destinationState.status === "ready" && destinationState.items.length > 0 && <div className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3" data-testid="planner-destination-carousel">
        {destinationState.items.map((destination) => <div key={destination.id} className="w-[82vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:shrink"><DestinationCard dest={destination} showPlannerAction={false} /></div>)}
      </div>}
    </section>}

    {activeGroup && <section className="mt-8 border-t border-line pt-6" aria-labelledby="planner-partners-title" data-testid="planner-partner-groups">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-moss/15 p-2 text-toba"><Compass className="h-5 w-5" aria-hidden="true" /></span>
        <div><h2 id="planner-partners-title" className="font-display text-xl text-ink">{t.planner.recommendedPartners}</h2><p className="mt-1 text-[12px] text-inkSoft">{t.planner.organicMatch}</p></div>
      </div>
      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label={t.planner.partnerTypes}>
        {groups.map((group) => <button
          key={group.type}
          ref={(node) => { tabRefs.current[group.type] = node; }}
          type="button"
          role="tab"
          id={`planner-partner-tab-${group.type}`}
          aria-selected={activeGroup.type === group.type}
          aria-controls={`planner-partner-panel-${group.type}`}
          tabIndex={activeGroup.type === group.type ? 0 : -1}
          onClick={() => setActiveType(group.type)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") moveTab(event, 1);
            if (event.key === "ArrowLeft") moveTab(event, -1);
            if (event.key === "Home") moveTab(event, "home");
            if (event.key === "End") moveTab(event, "end");
          }}
          className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-semibold transition ${activeGroup.type === group.type ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft hover:border-toba"}`}
        >{t.partners.types[group.type] || group.type}</button>)}
      </div>
      <div role="tabpanel" id={`planner-partner-panel-${activeGroup.type}`} aria-labelledby={`planner-partner-tab-${activeGroup.type}`} className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        {activeGroup.items.map((recommendation) => <div key={recommendation.partner_id} className="min-w-0" data-testid={`planner-partner-match-${recommendation.partner_id}`}>
          <div className="mb-2 rounded-xl border border-line/80 bg-cream/45 px-3 py-2.5 text-[11px] text-inkSoft">
            <div className="flex flex-wrap items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-toba" aria-hidden="true" />
              <span>{t.planner.matches} <strong className="text-ink">{recommendation.destination_names.join(", ")}</strong></span>
              {recommendation.placement === "featured" && <span className="rounded-full bg-toba px-2 py-0.5 font-semibold text-cream">{t.planner.featuredDisclosure}</span>}
            </div>
            {recommendation.match_reasons.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t.planner.matchReasons}>
              {recommendation.match_reasons.map((reason) => <li key={reason} className="rounded-full bg-white px-2 py-1 text-[10px] text-inkSoft">{reason}</li>)}
            </ul>}
          </div>
          <PartnerCard partner={recommendation.partner} source="planner" destinationId={recommendation.destination_id} analyticsContext={recommendation} />
        </div>)}
      </div>
    </section>}
  </div>;
}
