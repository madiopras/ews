import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble,
  ChevronDown,
  Clock3,
  Compass,
  Lightbulb,
  MapPin,
  MapPinned,
  NotebookText,
  RefreshCw,
  Route,
  Sparkles,
} from "lucide-react";
import DestinationCard from "../DestinationCard.jsx";
import PartnerCard from "../PartnerCard.jsx";
import { groupPlannerRecommendations } from "../../lib/plannerRecommendationGroups.js";
import { travelStyleLabel } from "../../lib/travelStyle.js";

const PERIOD_ICONS = {
  morning: Sparkles,
  afternoon: Compass,
  evening: BedDouble,
  flexible: Clock3,
};

function PlannerSummary({ result, lang, t }) {
  const snapshot = result.request_snapshot;
  return <section className="relative overflow-hidden rounded-2xl border border-toba/15 bg-[linear-gradient(135deg,rgba(15,61,62,0.08),rgba(193,154,68,0.08))] p-4 sm:p-6" aria-labelledby="planner-summary-title" data-testid="structured-summary">
    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-toba/10 blur-2xl" aria-hidden="true" />
    <div className="relative flex items-start gap-3">
      <span className="rounded-xl bg-toba p-2.5 text-cream shadow-sm"><Route className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-toba/70">{t.planner.tripOverview}</p>
        <h3 id="planner-summary-title" className="mt-1 font-display text-xl leading-tight text-ink sm:text-2xl">{t.planner.structuredSummary}</h3>
      </div>
    </div>
    <p className="relative mt-4 text-sm leading-7 text-ink sm:text-[15px]">{result.summary}</p>
    <dl className="relative mt-5 flex flex-wrap gap-2 text-[11px]">
      <div className="rounded-full border border-toba/15 bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.days}</dt><dd>{snapshot.days} {lang === "en" ? "days" : "hari"}</dd></div>
      <div className="rounded-full border border-toba/15 bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.travelStyle}</dt><dd>{travelStyleLabel(snapshot.budget_style, lang)}</dd></div>
      {snapshot.interests.slice(0, 5).map((interest) => <div key={interest} className="rounded-full border border-toba/15 bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.interests}</dt><dd>{t.categories[interest] || interest}</dd></div>)}
    </dl>
  </section>;
}

function PlannerStop({ stop, destination, lang, t, isLast }) {
  const PeriodIcon = PERIOD_ICONS[stop.period] || Clock3;
  const name = destination
    ? (lang === "en" && destination.name_en ? destination.name_en : destination.name)
    : t.planner.destinationUnavailable;
  const content = <>
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-toba/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-toba"><PeriodIcon className="h-3 w-3" aria-hidden="true" />{t.planner.periods[stop.period] || stop.period}</span>
      {stop.time_label && <span className="text-[11px] text-inkSoft">{stop.time_label}</span>}
    </div>
    <h5 className="mt-2 font-display text-lg leading-snug text-ink">{name}</h5>
    {destination?.location && <p className="mt-1 flex items-start gap-1 text-[11px] text-inkSoft"><MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{destination.location}</p>}
    <p className="mt-2 text-[13px] leading-6 text-inkSoft">{stop.activity}</p>
    {stop.practical_tip && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950"><strong>{t.planner.practicalTip}:</strong> {stop.practical_tip}</p>}
  </>;

  return <li className="relative grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
    {!isLast && <span className="absolute bottom-0 left-[13px] top-7 w-px bg-line" aria-hidden="true" />}
    <span className="relative z-10 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-toba text-[10px] font-semibold text-cream" aria-hidden="true">•</span>
    {destination ? <Link to={`/destination/${destination.id}`} className="min-w-0 rounded-2xl border border-line/80 bg-white p-3.5 transition hover:border-toba/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toba" aria-label={`${name} · ${t.detail.viewDetails}`}>{content}</Link> : <div className="min-w-0 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-3.5">{content}</div>}
  </li>;
}

function DayAccordion({ result, lang, t }) {
  const [activeDay, setActiveDay] = useState(result.days[0]?.day || 1);
  const buttonRefs = useRef({});
  const destinationMap = useMemo(() => new Map(result.destinations.map((item) => [item.id, item])), [result.destinations]);

  useEffect(() => setActiveDay(result.days[0]?.day || 1), [result.generated_at, result.days]);

  const moveFocus = (event, index, direction) => {
    const last = result.days.length - 1;
    const next = direction === "home" ? 0 : direction === "end" ? last : Math.min(last, Math.max(0, index + direction));
    if (next === index) return;
    event.preventDefault();
    buttonRefs.current[result.days[next].day]?.focus();
  };

  return <section className="mt-7" aria-labelledby="planner-days-title" data-testid="structured-days">
    <div className="mb-4 flex items-center gap-3">
      <span className="rounded-xl bg-toba/10 p-2 text-toba"><Route className="h-5 w-5" aria-hidden="true" /></span>
      <div><h3 id="planner-days-title" className="font-display text-xl text-ink">{t.planner.dailyPlan}</h3><p className="mt-1 text-[12px] text-inkSoft">{t.planner.dailyPlanSub}</p></div>
    </div>
    <div className="space-y-3">
      {result.days.map((day, index) => {
        const open = activeDay === day.day;
        const panelId = `planner-day-panel-${day.day}`;
        return <article key={day.day} className={`avoid-print-break overflow-hidden rounded-2xl border transition ${open ? "border-toba/30 bg-cream/35 shadow-sm" : "border-line bg-white"}`} data-testid={`structured-day-${day.day}`}>
          <h4>
            <button
              ref={(node) => { buttonRefs.current[day.day] = node; }}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setActiveDay(open && result.days.length > 1 ? 0 : day.day)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") moveFocus(event, index, 1);
                if (event.key === "ArrowUp") moveFocus(event, index, -1);
                if (event.key === "Home") moveFocus(event, index, "home");
                if (event.key === "End") moveFocus(event, index, "end");
              }}
              className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-toba sm:px-5"
            >
              <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-toba text-cream"><span className="text-[8px] font-semibold uppercase tracking-wider">{lang === "en" ? "Day" : "Hari"}</span><span className="font-display text-lg leading-none">{day.day}</span></span>
              <span className="min-w-0 flex-1"><span className="block font-display text-[17px] leading-snug text-ink sm:text-lg">{day.title}</span>{day.area_label && <span className="mt-1 flex items-center gap-1 text-[11px] text-inkSoft"><MapPin className="h-3 w-3" aria-hidden="true" />{day.area_label}</span>}</span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-inkSoft transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </h4>
          <div id={panelId} hidden={!open} className="structured-planner-day-panel border-t border-line/70 px-4 pb-5 pt-4 sm:px-5">
            {day.description && <p className="mb-5 text-[13px] leading-6 text-inkSoft">{day.description}</p>}
            <ol aria-label={`${lang === "en" ? "Stops for day" : "Tujuan hari"} ${day.day}`}>
              {day.stops.map((stop, stopIndex) => <PlannerStop key={`${day.day}-${stop.destination_id}-${stopIndex}`} stop={stop} destination={destinationMap.get(stop.destination_id)} lang={lang} t={t} isLast={stopIndex === day.stops.length - 1} />)}
            </ol>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function DestinationSection({ result, t, enabled }) {
  if (!enabled) return null;
  const missingCount = Math.max(0, result.destination_ids.length - result.destinations.length);
  return <section className="mt-8 border-t border-line pt-6" aria-labelledby="structured-destinations-title" data-testid="structured-destinations">
    <div className="mb-4 flex items-start gap-3">
      <span className="rounded-xl bg-toba/10 p-2 text-toba"><MapPinned className="h-5 w-5" aria-hidden="true" /></span>
      <div><h3 id="structured-destinations-title" className="font-display text-xl text-ink">{t.planner.destinationsInTrip}</h3><p className="mt-1 text-[12px] text-inkSoft">{t.planner.destinationsInTripSub}</p></div>
    </div>
    {result.destinations.length > 0 ? <div className="print-destination-grid -mx-1 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3" data-testid="structured-destination-rail">
      {result.destinations.map((destination) => <div key={destination.id} className="w-[82vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:shrink"><DestinationCard dest={destination} showPlannerAction={false} /></div>)}
    </div> : <p className="rounded-2xl border border-dashed border-line bg-cream/50 p-4 text-sm text-inkSoft">{t.planner.noDestinationCards}</p>}
    {missingCount > 0 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950" role="status">{t.planner.partialDestinationCards}</p>}
  </section>;
}

function PartnerSections({ result, lang, t, enabled, culinaryEnabled }) {
  const destinationMap = useMemo(() => new Map(result.destinations.map((item) => [item.id, item])), [result.destinations]);
  const recommendations = useMemo(() => result.partner_matches.map((match) => ({
    ...match,
    destination_id: match.destination_ids[0] || null,
    destination_names: match.destination_ids.map((id) => {
      const destination = destinationMap.get(id);
      return destination ? (lang === "en" && destination.name_en ? destination.name_en : destination.name) : "";
    }).filter(Boolean),
  })), [destinationMap, lang, result.partner_matches]);
  const groups = useMemo(() => enabled ? groupPlannerRecommendations(recommendations, { includeCulinary: culinaryEnabled }) : [], [culinaryEnabled, enabled, recommendations]);
  const [activeType, setActiveType] = useState(groups[0]?.type || "");
  const tabRefs = useRef({});

  useEffect(() => {
    if (!groups.some((group) => group.type === activeType)) setActiveType(groups[0]?.type || "");
  }, [activeType, groups]);

  if (!enabled) return null;
  if (!groups.length) return <section className="mt-8 border-t border-line pt-6" aria-labelledby="structured-partners-title" data-testid="structured-partners-empty"><h3 id="structured-partners-title" className="font-display text-xl text-ink">{t.planner.recommendedPartners}</h3><p className="mt-2 rounded-2xl bg-cream/60 p-4 text-[13px] leading-6 text-inkSoft">{t.planner.noPartnerMatches}</p></section>;

  const moveTab = (event, direction) => {
    const current = Math.max(0, groups.findIndex((group) => group.type === activeType));
    const next = direction === "home" ? 0 : direction === "end" ? groups.length - 1 : (current + direction + groups.length) % groups.length;
    event.preventDefault();
    setActiveType(groups[next].type);
    tabRefs.current[groups[next].type]?.focus();
  };

  return <section className="mt-8 border-t border-line pt-6" aria-labelledby="structured-partners-title" data-testid="structured-partners">
    <div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-moss/15 p-2 text-toba"><Compass className="h-5 w-5" aria-hidden="true" /></span><div><h3 id="structured-partners-title" className="font-display text-xl text-ink">{t.planner.recommendedPartners}</h3><p className="mt-1 text-[12px] text-inkSoft">{t.planner.organicMatch}</p></div></div>
    <div className="structured-partner-tabs -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label={t.planner.partnerTypes}>
      {groups.map((group) => <button key={group.type} ref={(node) => { tabRefs.current[group.type] = node; }} type="button" role="tab" id={`structured-partner-tab-${group.type}`} aria-selected={activeType === group.type} aria-controls={`structured-partner-panel-${group.type}`} tabIndex={activeType === group.type ? 0 : -1} onClick={() => setActiveType(group.type)} onKeyDown={(event) => {
        if (event.key === "ArrowRight") moveTab(event, 1);
        if (event.key === "ArrowLeft") moveTab(event, -1);
        if (event.key === "Home") moveTab(event, "home");
        if (event.key === "End") moveTab(event, "end");
      }} className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toba ${activeType === group.type ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft"}`}>{t.partners.types[group.type] || group.type}</button>)}
    </div>
    {groups.map((group) => <div key={group.type} role="tabpanel" id={`structured-partner-panel-${group.type}`} aria-labelledby={`structured-partner-tab-${group.type}`} hidden={activeType !== group.type} className="structured-partner-panel mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
      {group.items.map((match) => <div key={match.partner_id} className="avoid-print-break min-w-0" data-testid={`structured-partner-${match.partner_id}`}>
        <div className="mb-2 rounded-xl border border-line/80 bg-cream/45 px-3 py-2.5 text-[11px] text-inkSoft">
          <div className="flex flex-wrap items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-toba" aria-hidden="true" /><span>{t.planner.matches} <strong className="text-ink">{match.destination_names.join(", ") || t.planner.tripRoute}</strong></span>{match.placement === "featured" && <span className="rounded-full bg-toba px-2 py-0.5 font-semibold text-cream">{t.planner.featuredDisclosure}</span>}</div>
          {match.match_reasons.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t.planner.matchReasons}>{match.match_reasons.map((reason) => <li key={reason} className="rounded-full bg-white px-2 py-1 text-[10px] text-inkSoft">{reason}</li>)}</ul>}
        </div>
        <PartnerCard partner={match.partner} source="planner" destinationId={match.destination_id} analyticsContext={match} />
      </div>)}
    </div>)}
  </section>;
}

function NotesAndTips({ result, t }) {
  if (!result.travel_notes.length && !result.travel_tips.length) return null;
  return <section className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2" aria-label={t.planner.notesAndTips} data-testid="structured-notes-tips">
    {result.travel_notes.length > 0 && <div className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center gap-2"><NotebookText className="h-5 w-5 text-toba" aria-hidden="true" /><h3 className="font-display text-lg text-ink">{t.planner.travelNotes}</h3></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-inkSoft">{result.travel_notes.map((note, index) => <li key={`${index}-${note}`} className="flex gap-2"><span className="text-toba" aria-hidden="true">•</span><span>{note}</span></li>)}</ul></div>}
    {result.travel_tips.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-700" aria-hidden="true" /><h3 className="font-display text-lg text-ink">{t.planner.travelTips}</h3></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-inkSoft">{result.travel_tips.map((tip, index) => <li key={`${index}-${tip}`} className="flex gap-2"><span className="text-amber-700" aria-hidden="true">•</span><span>{tip}</span></li>)}</ul></div>}
  </section>;
}

export function PlannerResultProgress({ phase = "generating", t, onCancel }) {
  const phases = ["generating", "validating", "hydrating"];
  const activeIndex = Math.max(0, phases.indexOf(phase));
  return <div className="min-h-[260px] space-y-4" role="status" aria-live="polite" data-testid="structured-progress">
    <div className="rounded-2xl border border-toba/10 bg-[linear-gradient(135deg,rgba(15,61,62,0.08),rgba(193,154,68,0.08))] p-4 sm:p-5">
      <div className="flex items-center gap-3"><span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-toba text-cream"><Compass className="h-5 w-5 animate-pulse" aria-hidden="true" /></span><div><p className="font-semibold text-ink">{t.planner.progressTitle}</p><p className="mt-1 text-[12px] text-inkSoft">{t.planner.progressPhases[phase] || t.planner.generating}</p></div></div>
      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t.planner.progressTitle}>{phases.map((item, index) => <li key={item} className={`h-1.5 rounded-full ${index <= activeIndex ? "bg-toba" : "bg-line"}`}><span className="sr-only">{t.planner.progressPhases[item]}</span></li>)}</ol>
      {onCancel && <button type="button" className="btn-outline mt-5 min-h-[44px]" onClick={onCancel}>{t.planner.cancelGeneration}</button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">{[0, 1].map((item) => <div key={item} className="animate-pulse rounded-2xl border border-line bg-white p-4"><div className="h-5 w-1/2 rounded bg-line/60" /><div className="mt-4 h-3 w-full rounded bg-line/40" /><div className="mt-2 h-3 w-4/5 rounded bg-line/40" /></div>)}</div>
  </div>;
}

export function PlannerGenerationError({ message, retryLabel, onRetry }) {
  return <div className="mt-5 w-full rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700 shadow-sm" role="alert" data-testid="planner-error">
    <p>{message}</p>
    {onRetry && <button type="button" className="btn-outline mt-3 min-h-[44px]" onClick={onRetry} data-testid="planner-retry-btn"><RefreshCw className="h-4 w-4" aria-hidden="true" />{retryLabel}</button>}
  </div>;
}

export default function StructuredPlannerResult({
  result,
  lang,
  t,
  destinationCardsEnabled = true,
  partnerMatchesEnabled = true,
  culinaryEnabled = false,
}) {
  return <div className="structured-planner-result min-w-0" data-testid="structured-planner-result">
    <PlannerSummary result={result} lang={lang} t={t} />
    <DayAccordion result={result} lang={lang} t={t} />
    <DestinationSection result={result} t={t} enabled={destinationCardsEnabled} />
    <PartnerSections result={result} lang={lang} t={t} enabled={partnerMatchesEnabled} culinaryEnabled={culinaryEnabled} />
    <NotesAndTips result={result} t={t} />
  </div>;
}
