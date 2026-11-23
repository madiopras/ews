import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Copy,
  ExternalLink,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MapPinned,
  NotebookText,
  Pencil,
  RefreshCw,
  Repeat,
  Route,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import DestinationCard from "../DestinationCard.jsx";
import PartnerCard from "../PartnerCard.jsx";
import AffiliateBookingSection from "../AffiliateBookingSection.jsx";
import { api } from "../../lib/api.js";
import { downloadItineraryIcs, formatItineraryForWhatsapp } from "../../lib/itineraryExport.js";
import { groupPlannerRecommendations } from "../../lib/plannerRecommendationGroups.js";
import {
  moveStopInDay,
  removeStopFromResult,
  swapStopDestination,
} from "../../lib/plannerResultEditor.js";
import { travelStyleLabel } from "../../lib/travelStyle.js";
import { buildGoogleMapsRouteUrl, buildRouteDays } from "../../lib/tripRouteMap.js";

const TripMap = React.lazy(() => import("../TripMap.jsx"));

const PERIOD_ICONS = {
  morning: Sparkles,
  afternoon: Compass,
  evening: BedDouble,
  flexible: Clock3,
};

const FEEDBACK_REASON_KEYS = ["route_too_far", "mismatch_interests", "too_packed", "other"];

function PlannerSummary({ result, lang, t }) {
  const snapshot = result.request_snapshot;
  const [copiedWa, setCopiedWa] = useState(false);

  const handleCopyWhatsapp = async () => {
    const text = formatItineraryForWhatsapp({ result, lang });
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedWa(true);
      window.setTimeout(() => setCopiedWa(false), 2200);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleDownloadIcs = () => {
    downloadItineraryIcs({ result, lang });
  };

  return <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(15,61,62,0.08),rgba(193,154,68,0.08))] p-4 shadow-soft sm:p-6" aria-labelledby="planner-summary-title" data-testid="structured-summary">
    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-toba/10 blur-2xl" aria-hidden="true" />
    <div className="relative flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-toba p-2.5 text-cream shadow-sm"><Route className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-toba/70">{t.planner.tripOverview}</p>
          <h3 id="planner-summary-title" className="mt-1 font-display text-xl leading-tight text-ink sm:text-2xl">{t.planner.structuredSummary}</h3>
        </div>
      </div>
      <div className="print-hidden flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleCopyWhatsapp}
          data-testid="export-whatsapp-btn"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-toba/25 bg-white/90 px-3 text-[11px] font-semibold text-toba transition hover:border-toba hover:bg-toba hover:text-cream"
        >
          {copiedWa ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copiedWa
            ? (t.planner.copiedWhatsapp || (lang === "en" ? "Copied for WhatsApp!" : "Disalin untuk WhatsApp!"))
            : (t.planner.copyWhatsapp || (lang === "en" ? "Copy for WhatsApp" : "Salin untuk WhatsApp"))}
        </button>
        <button
          type="button"
          onClick={handleDownloadIcs}
          data-testid="export-ics-btn"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-toba/25 bg-white/90 px-3 text-[11px] font-semibold text-toba transition hover:border-toba hover:bg-toba hover:text-cream"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t.planner.exportCalendar || (lang === "en" ? "Calendar (.ics)" : "Kalender (.ics)")}
        </button>
      </div>
    </div>
    <p className="relative mt-4 text-sm leading-7 text-ink sm:text-[15px]">{result.summary}</p>
    <dl className="relative mt-5 flex flex-wrap gap-2 text-[11px]">
      <div className="rounded-full bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.days}</dt><dd>{snapshot.days} {lang === "en" ? "days" : "hari"}</dd></div>
      <div className="rounded-full bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.travelStyle}</dt><dd>{travelStyleLabel(snapshot.budget_style, lang)}</dd></div>
      {snapshot.starting_point && snapshot.starting_point !== "flexible" && (
        <div className="rounded-full bg-white/80 px-3 py-1.5" data-testid="structured-snapshot-hub">
          <dt className="sr-only">{t.planner.startingPoint || (lang === "en" ? "Starting point" : "Titik mulai")}</dt>
          <dd>{t.planner.startingPoints?.[snapshot.starting_point] || snapshot.starting_point}</dd>
        </div>
      )}
      {snapshot.travel_pace && (
        <div className="rounded-full bg-white/80 px-3 py-1.5" data-testid="structured-snapshot-pace">
          <dt className="sr-only">{t.planner.travelPace || (lang === "en" ? "Travel pace" : "Tempo perjalanan")}</dt>
          <dd>{t.planner.travelPaces?.[snapshot.travel_pace] || snapshot.travel_pace}</dd>
        </div>
      )}
      {snapshot.interests.slice(0, 5).map((interest) => <div key={interest} className="rounded-full bg-white/80 px-3 py-1.5"><dt className="sr-only">{t.planner.interests}</dt><dd>{t.categories[interest] || interest}</dd></div>)}
    </dl>
  </section>;
}

function QuickRefineBar({ activeDay, lang, t, onRefine }) {
  if (!onRefine) return null;
  const targetDay = activeDay > 0 ? activeDay : 1;
  const chips = [
    {
      id: "relaxed",
      label: t.planner.refineRelaxed || (lang === "en" ? "Make it more relaxed" : "Buat lebih santai"),
      instruction: lang === "en"
        ? "Make the itinerary more relaxed with fewer stops per day and more rest time."
        : "Buat itinerary lebih santai dengan stop lebih sedikit per hari dan jeda istirahat lebih longgar.",
      targetDay: null,
    },
    {
      id: "family",
      label: t.planner.refineFamily || (lang === "en" ? "More family-friendly" : "Ramah keluarga & anak"),
      instruction: lang === "en"
        ? "Make the itinerary more family and child friendly, avoiding strenuous hikes."
        : "Buat itinerary lebih ramah keluarga dan anak-anak, hindari pendakian atau rute terlalu berat.",
      targetDay: null,
    },
    {
      id: "culinary",
      label: t.planner.refineCulinary || (lang === "en" ? "Add more local food" : "Tambah kuliner lokal"),
      instruction: lang === "en"
        ? "Include more North Sumatra local culinary experiences and coffee stops along the route."
        : "Tambahkan lebih banyak pengalaman kuliner khas Sumatera Utara dan singgah kopi di sepanjang rute.",
      targetDay: null,
    },
    {
      id: "day",
      label: `${t.planner.refineDay || (lang === "en" ? "Refresh Day" : "Ganti rute Hari")} ${targetDay}`,
      instruction: lang === "en"
        ? `Keep the other days coherent and suggest fresh alternative destinations for Day ${targetDay}.`
        : `Pertahankan hari lainnya agar tetap rapi dan berikan alternatif destinasi baru untuk Hari ${targetDay}.`,
      targetDay,
    },
  ];

  return (
    <section className="print-hidden mt-5 rounded-2xl border border-line/70 bg-cream/55 p-3.5 sm:p-4" aria-label={t.planner.quickRefineTitle || "Quick AI adjustments"} data-testid="structured-quick-refine">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-toba">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t.planner.quickRefineTitle || (lang === "en" ? "Quick AI adjustments" : "Sesuaikan cepat dengan AI")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onRefine(chip.instruction, chip.targetDay)}
            data-testid={`refine-chip-${chip.id}`}
            className="min-h-[38px] rounded-full border border-toba/25 bg-white px-3.5 text-xs font-semibold text-toba transition hover:border-toba hover:bg-toba hover:text-cream"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function PlannerStop({
  stop,
  destination,
  lang,
  t,
  isLast,
  editing,
  canMoveUp,
  canMoveDown,
  canRemove,
  swapOpen,
  swapLoading,
  swapOptions,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleSwap,
  onSelectAlternative,
}) {
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
    <div className="min-w-0">
      {destination && !editing ? (
        <Link to={`/destination/${destination.id}`} className="interactive-lift block min-w-0 rounded-2xl bg-white p-3.5 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toba" aria-label={`${name} · ${t.detail.viewDetails}`}>{content}</Link>
      ) : (
        <div className={`min-w-0 rounded-2xl p-3.5 ${destination ? "bg-white shadow-soft" : "border border-dashed border-amber-300 bg-amber-50/40"}`}>
          {content}
          {editing && (
            <div className="print-hidden mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3" data-testid={`stop-edit-controls-${stop.destination_id}`}>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                aria-label={t.planner.moveUp || (lang === "en" ? "Move up" : "Naikkan urutan")}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-line bg-cream/60 px-2.5 text-[11px] font-semibold text-ink transition hover:border-toba disabled:opacity-40"
                data-testid={`stop-move-up-${stop.destination_id}`}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                aria-label={t.planner.moveDown || (lang === "en" ? "Move down" : "Turunkan urutan")}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-line bg-cream/60 px-2.5 text-[11px] font-semibold text-ink transition hover:border-toba disabled:opacity-40"
                data-testid={`stop-move-down-${stop.destination_id}`}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onToggleSwap}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-toba/30 bg-toba/5 px-3 text-[11px] font-semibold text-toba transition hover:bg-toba hover:text-cream"
                data-testid={`stop-swap-btn-${stop.destination_id}`}
              >
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                {t.planner.swapStop || (lang === "en" ? "Swap place" : "Ganti tempat")}
              </button>
              <button
                type="button"
                disabled={!canRemove}
                onClick={onRemove}
                aria-label={t.planner.removeStop || (lang === "en" ? "Remove stop" : "Hapus stop")}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-40"
                data-testid={`stop-remove-btn-${stop.destination_id}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
          {editing && swapOpen && (
            <div className="print-hidden mt-3 rounded-xl border border-toba/20 bg-cream/70 p-3" data-testid={`stop-swap-panel-${stop.destination_id}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-ink">{t.planner.swapChooseAlternative || (lang === "en" ? "Choose a nearby alternative destination:" : "Pilih destinasi terdekat sebagai pengganti:")}</p>
                <button type="button" onClick={onToggleSwap} className="rounded-full p-1 text-inkSoft hover:bg-white" aria-label={t.common?.close || "Close"}><X className="h-3.5 w-3.5" /></button>
              </div>
              {swapLoading ? (
                <p className="mt-2 text-xs text-inkSoft">{t.planner.swapLoading || (lang === "en" ? "Finding nearby alternatives…" : "Mencari alternatif terdekat…")}</p>
              ) : swapOptions.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {swapOptions.map((alt) => {
                    const altName = lang === "en" && alt.name_en ? alt.name_en : alt.name;
                    return (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => onSelectAlternative(alt)}
                        data-testid={`swap-option-${alt.id}`}
                        className="rounded-xl border border-line bg-white p-2.5 text-left transition hover:border-toba hover:shadow-sm"
                      >
                        <span className="block text-xs font-semibold text-ink">{altName}</span>
                        <span className="mt-0.5 block text-[11px] text-inkSoft">{alt.location}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-inkSoft">{t.planner.swapNoAlternatives || (lang === "en" ? "No other nearby alternatives found in the catalog." : "Belum ada alternatif terdekat lainnya di katalog.")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </li>;
}

function DayAccordion({
  result,
  lang,
  t,
  activeDay,
  onActiveDayChange,
  partnerMatchesEnabled,
  onJumpToPartnerType,
  onResultChange,
}) {
  const buttonRefs = useRef({});
  const [editingStops, setEditingStops] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapState, setSwapState] = useState({ loading: false, items: [] });
  const destinationMap = useMemo(() => new Map(result.destinations.map((item) => [item.id, item])), [result.destinations]);

  useEffect(() => {
    setEditingStops(false);
    setSwapTarget(null);
  }, [result.generated_at]);

  const moveFocus = (event, index, direction) => {
    const last = result.days.length - 1;
    const next = direction === "home" ? 0 : direction === "end" ? last : Math.min(last, Math.max(0, index + direction));
    if (next === index) return;
    event.preventDefault();
    buttonRefs.current[result.days[next].day]?.focus();
  };

  const toggleSwap = async (dayNumber, stopIndex, destinationId) => {
    const key = `${dayNumber}-${stopIndex}`;
    if (swapTarget === key) {
      setSwapTarget(null);
      return;
    }
    setSwapTarget(key);
    setSwapState({ loading: true, items: [] });
    try {
      const exclude = (result.destination_ids || []).join(",");
      const { data } = await api.get(`/destinations/${destinationId}/alternatives`, {
        params: { exclude, limit: 4 },
      });
      setSwapState({ loading: false, items: Array.isArray(data) ? data : [] });
    } catch {
      setSwapState({ loading: false, items: [] });
    }
  };

  return <section className="mt-7" aria-labelledby="planner-days-title" data-testid="structured-days">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-toba/10 p-2 text-toba"><Route className="h-5 w-5" aria-hidden="true" /></span>
        <div><h3 id="planner-days-title" className="font-display text-xl text-ink">{t.planner.dailyPlan}</h3><p className="mt-1 text-[12px] text-inkSoft">{t.planner.dailyPlanSub}</p></div>
      </div>
      {onResultChange && (
        <button
          type="button"
          onClick={() => {
            setEditingStops((current) => !current);
            setSwapTarget(null);
          }}
          data-testid="toggle-edit-stops-btn"
          className={`print-hidden inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${editingStops ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft hover:border-toba hover:text-toba"}`}
        >
          {editingStops ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
          {editingStops
            ? (t.planner.doneEditing || (lang === "en" ? "Done" : "Selesai"))
            : (t.planner.editStops || (lang === "en" ? "Edit stops" : "Atur stop"))}
        </button>
      )}
    </div>
    <div className="space-y-3">
      {result.days.map((day, index) => {
        const open = activeDay === day.day;
        const panelId = `planner-day-panel-${day.day}`;
        const dayDestIds = new Set(day.stops.map((stop) => stop.destination_id));
        const dayPartners = partnerMatchesEnabled
          ? (result.partner_matches || []).filter((match) => (match.destination_ids || []).some((id) => dayDestIds.has(id)))
          : [];

        return <article key={day.day} className={`avoid-print-break overflow-hidden rounded-2xl transition-[background-color,box-shadow] duration-200 ${open ? "bg-cream/60 shadow-soft-md" : "bg-white shadow-soft"}`} data-testid={`structured-day-${day.day}`}>
          <h4>
            <button
              ref={(node) => { buttonRefs.current[day.day] = node; }}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => onActiveDayChange(open && result.days.length > 1 ? 0 : day.day)}
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
              {day.stops.map((stop, stopIndex) => {
                const swapKey = `${day.day}-${stopIndex}`;
                return <PlannerStop
                  key={`${day.day}-${stop.destination_id}-${stopIndex}`}
                  stop={stop}
                  destination={destinationMap.get(stop.destination_id)}
                  lang={lang}
                  t={t}
                  isLast={stopIndex === day.stops.length - 1}
                  editing={editingStops && Boolean(onResultChange)}
                  canMoveUp={stopIndex > 0}
                  canMoveDown={stopIndex < day.stops.length - 1}
                  canRemove={day.stops.length > 1}
                  swapOpen={swapTarget === swapKey}
                  swapLoading={swapState.loading}
                  swapOptions={swapState.items}
                  onMoveUp={() => onResultChange?.(moveStopInDay(result, day.day, stopIndex, -1))}
                  onMoveDown={() => onResultChange?.(moveStopInDay(result, day.day, stopIndex, 1))}
                  onRemove={() => onResultChange?.(removeStopFromResult(result, day.day, stopIndex))}
                  onToggleSwap={() => toggleSwap(day.day, stopIndex, stop.destination_id)}
                  onSelectAlternative={(alt) => {
                    onResultChange?.(swapStopDestination(result, day.day, stopIndex, alt, lang));
                    setSwapTarget(null);
                  }}
                />;
              })}
            </ol>
            {dayPartners.length > 0 && (
              <div className="print-hidden mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-moss/30 bg-moss/10 px-3.5 py-2.5 text-xs" data-testid={`day-partner-teaser-${day.day}`}>
                <span className="flex items-center gap-2 text-ink">
                  <Compass className="h-4 w-4 shrink-0 text-toba" aria-hidden="true" />
                  <span>
                    <strong>{dayPartners.length}</strong>{" "}
                    {t.planner.dayPartnersTeaser || (lang === "en" ? "Local partners available on this day's route" : "Mitra lokal tersedia untuk rute hari ini")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onJumpToPartnerType(dayPartners[0].type)}
                  className="font-semibold text-toba underline underline-offset-2 hover:text-brick"
                >
                  {t.planner.viewPartners || (lang === "en" ? "View partners" : "Lihat Mitra")} →
                </button>
              </div>
            )}
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function RouteMapSection({ result, lang, t }) {
  const routeDays = useMemo(
    () => buildRouteDays(result.days, result.destinations, lang),
    [lang, result.days, result.destinations],
  );
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    setSelectedDay(0);
  }, [result.generated_at, result.days]);

  if (!routeDays.length) return null;

  const activeStops = selectedDay > 0
    ? (routeDays.find((item) => item.day === selectedDay)?.stops || [])
    : routeDays.flatMap((item) => item.stops);
  const mapsUrl = buildGoogleMapsRouteUrl(activeStops);
  const title = t.planner.routeMap || (lang === "en" ? "Trip route map" : "Peta rute perjalanan");
  const subtitle = t.planner.routeMapSub || (
    lang === "en"
      ? "View the daily stop order or open turn-by-turn directions in Google Maps."
      : "Lihat urutan kunjungan per hari atau buka navigasi langsung di Google Maps."
  );
  const allDaysLabel = t.planner.allDays || (lang === "en" ? "All days" : "Semua hari");
  const openMapsLabel = t.planner.openGoogleMaps || (lang === "en" ? "Open in Google Maps" : "Buka di Google Maps");

  return (
    <section className="print-hidden mt-8 border-t border-line pt-6" aria-labelledby="structured-route-map-title" data-testid="structured-route-map">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-toba/10 p-2 text-toba"><MapIcon className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h3 id="structured-route-map-title" className="font-display text-xl text-ink">{title}</h3>
            <p className="mt-1 text-[12px] text-inkSoft">{subtitle}</p>
          </div>
        </div>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline min-h-[40px] shrink-0 text-xs"
            data-testid="structured-google-maps-link"
          >
            <ExternalLink className="h-3.5 w-3.5 text-toba" aria-hidden="true" />
            {openMapsLabel}
          </a>
        )}
      </div>

      {routeDays.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={title} data-testid="structured-map-day-filters">
          <button
            type="button"
            onClick={() => setSelectedDay(0)}
            aria-pressed={selectedDay === 0}
            className={`min-h-[38px] rounded-full border px-3.5 text-xs font-semibold transition ${selectedDay === 0 ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft hover:border-toba"}`}
          >
            {allDaysLabel}
          </button>
          {routeDays.map((day) => (
            <button
              key={day.day}
              type="button"
              onClick={() => setSelectedDay(day.day)}
              aria-pressed={selectedDay === day.day}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${selectedDay === day.day ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft hover:border-toba"}`}
              data-testid={`structured-map-day-${day.day}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: day.color }} aria-hidden="true" />
              {lang === "en" ? `Day ${day.day}` : `Hari ${day.day}`}
            </button>
          ))}
        </div>
      )}

      <div className="h-[320px] overflow-hidden rounded-2xl border border-line bg-cream/40 sm:h-[380px]">
        <React.Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-inkSoft">{t.common?.loading || "..."}</div>}>
          <TripMap destinations={result.destinations} days={result.days} activeDay={selectedDay} lang={lang} />
        </React.Suspense>
      </div>
    </section>
  );
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

function PartnerSections({
  result,
  lang,
  t,
  enabled,
  culinaryEnabled,
  requestedPartnerType,
  partnersSectionRef,
}) {
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
    if (requestedPartnerType && groups.some((group) => group.type === requestedPartnerType)) {
      setActiveType(requestedPartnerType);
    }
  }, [groups, requestedPartnerType]);

  useEffect(() => {
    if (!groups.some((group) => group.type === activeType)) setActiveType(groups[0]?.type || "");
  }, [activeType, groups]);

  if (!enabled) return null;
  if (!groups.length) return <section ref={partnersSectionRef} className="mt-8 border-t border-line pt-6" aria-labelledby="structured-partners-title" data-testid="structured-partners-empty"><h3 id="structured-partners-title" className="font-display text-xl text-ink">{t.planner.recommendedPartners}</h3><p className="mt-2 rounded-2xl bg-cream/60 p-4 text-[13px] leading-6 text-inkSoft">{t.planner.noPartnerMatches}</p></section>;

  const moveTab = (event, direction) => {
    const current = Math.max(0, groups.findIndex((group) => group.type === activeType));
    const next = direction === "home" ? 0 : direction === "end" ? groups.length - 1 : (current + direction + groups.length) % groups.length;
    event.preventDefault();
    setActiveType(groups[next].type);
    tabRefs.current[groups[next].type]?.focus();
  };

  return <section ref={partnersSectionRef} className="mt-8 border-t border-line pt-6" aria-labelledby="structured-partners-title" data-testid="structured-partners">
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
        <div className="mb-2 rounded-xl bg-cream/60 px-3 py-2.5 text-[11px] text-inkSoft">
          <div className="flex flex-wrap items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-toba" aria-hidden="true" /><span>{t.planner.matches} <strong className="text-ink">{match.destination_names.join(", ") || t.planner.tripRoute}</strong></span>{match.placement === "featured" && <span className="rounded-full bg-toba px-2 py-0.5 font-semibold text-cream">{t.planner.featuredDisclosure}</span>}</div>
          {match.match_reasons.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t.planner.matchReasons}>{match.match_reasons.map((reason) => <li key={reason} className="rounded-full bg-white px-2 py-1 text-[10px] text-inkSoft">{reason}</li>)}</ul>}
          {Array.isArray(match.offerings) && match.offerings.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid={`partner-offerings-${match.partner_id}`}>
              <span className="text-[10px] font-semibold text-toba">{t.planner.availableOfferings || (lang === "en" ? "Relevant services" : "Layanan relevan")}:</span>
              {match.offerings.map((offering) => (
                <span key={offering.id} className="rounded-full border border-toba/20 bg-white px-2 py-0.5 text-[10px] font-medium text-ink">
                  {offering.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <PartnerCard
          partner={match.partner}
          source="planner"
          destinationId={match.destination_id}
          analyticsContext={match}
          tripContext={{
            days: result.request_snapshot?.days,
            budgetStyle: result.request_snapshot?.budget_style,
            destinationNames: match.destination_names,
          }}
        />
      </div>)}
    </div>)}
  </section>;
}

function NotesAndTips({ result, t }) {
  if (!result.travel_notes.length && !result.travel_tips.length) return null;
  return <section className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2" aria-label={t.planner.notesAndTips} data-testid="structured-notes-tips">
    {result.travel_notes.length > 0 && <div className="rounded-2xl bg-white p-4 shadow-soft"><div className="flex items-center gap-2"><NotebookText className="h-5 w-5 text-toba" aria-hidden="true" /><h3 className="font-display text-lg text-ink">{t.planner.travelNotes}</h3></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-inkSoft">{result.travel_notes.map((note, index) => <li key={`${index}-${note}`} className="flex gap-2"><span className="text-toba" aria-hidden="true">•</span><span>{note}</span></li>)}</ul></div>}
    {result.travel_tips.length > 0 && <div className="rounded-2xl bg-amber-50/60 p-4 shadow-soft"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-700" aria-hidden="true" /><h3 className="font-display text-lg text-ink">{t.planner.travelTips}</h3></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-inkSoft">{result.travel_tips.map((tip, index) => <li key={`${index}-${tip}`} className="flex gap-2"><span className="text-amber-700" aria-hidden="true">•</span><span>{tip}</span></li>)}</ul></div>}
  </section>;
}

function PlannerFeedbackBar({ generationId, generatedAt, lang, t, enabled }) {
  const [rating, setRating] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setRating(null);
    setReasonCode(null);
    setSubmitted(false);
  }, [generationId, generatedAt]);

  if (!enabled) return null;

  const stableGenId = (generationId || `gen-${String(generatedAt || "default").replace(/[^A-Za-z0-9_-]/g, "")}`).slice(0, 80);

  const sendFeedback = async (nextRating, nextReason = null) => {
    setRating(nextRating);
    setReasonCode(nextReason);
    if (nextRating === "up" || nextReason) {
      setSubmitted(true);
    }
    try {
      await api.post("/planner/feedback", {
        generation_id: stableGenId.length >= 8 ? stableGenId : `gen-${stableGenId.padEnd(8, "0")}`,
        rating: nextRating,
        reason_code: nextReason,
        lang: lang === "en" ? "en" : "id",
      });
    } catch {
      // Non-blocking telemetry
    }
  };

  return (
    <section className="print-hidden mt-8 rounded-2xl border border-line/70 bg-cream/55 p-4" aria-label={t.planner.feedbackPrompt || "Feedback"} data-testid="structured-feedback">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink">
          {submitted
            ? (t.planner.feedbackThanks || (lang === "en" ? "Thanks! Your feedback helps improve the AI Planner." : "Terima kasih! Masukan Anda membantu meningkatkan AI Planner."))
            : (t.planner.feedbackPrompt || (lang === "en" ? "Was this itinerary helpful?" : "Apakah rencana perjalanan ini membantu?"))}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sendFeedback("up", "great_route")}
            aria-pressed={rating === "up"}
            data-testid="feedback-thumbs-up"
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${rating === "up" ? "border-toba bg-toba text-cream" : "border-line bg-white text-inkSoft hover:border-toba"}`}
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            {t.planner.feedbackHelpful || (lang === "en" ? "Helpful" : "Membantu")}
          </button>
          <button
            type="button"
            onClick={() => sendFeedback("down", null)}
            aria-pressed={rating === "down"}
            data-testid="feedback-thumbs-down"
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${rating === "down" ? "border-brick bg-brick text-cream" : "border-line bg-white text-inkSoft hover:border-brick"}`}
          >
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
            {t.planner.feedbackNeedsWork || (lang === "en" ? "Needs improvement" : "Perlu perbaikan")}
          </button>
        </div>
      </div>
      {rating === "down" && !submitted && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="feedback-reasons">
          {FEEDBACK_REASON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => sendFeedback("down", key)}
              aria-pressed={reasonCode === key}
              data-testid={`feedback-reason-${key}`}
              className="min-h-[34px] rounded-full border border-line bg-white px-3 text-[11px] font-medium text-inkSoft transition hover:border-brick hover:text-brick"
            >
              {t.planner.feedbackReasons?.[key] || key}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function PlannerResultProgress({
  phase = "generating",
  currentDay = 0,
  totalDays = 0,
  t,
  onCancel,
}) {
  const phases = ["generating", "validating", "hydrating"];
  const activeIndex = Math.max(0, phases.indexOf(phase));
  const dayLabelTemplate = t.planner.progressDayLabel || "Menyusun rencana Hari {day} dari {total}…";
  const phaseMessage = phase === "generating" && currentDay > 0 && totalDays > 0
    ? dayLabelTemplate.replace("{day}", String(currentDay)).replace("{total}", String(totalDays))
    : (t.planner.progressPhases[phase] || t.planner.generating);

  return <div className="min-h-[260px] space-y-4" role="status" aria-live="polite" data-testid="structured-progress">
    <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,61,62,0.08),rgba(193,154,68,0.08))] p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-3"><span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-toba text-cream"><Compass className="h-5 w-5 animate-pulse" aria-hidden="true" /></span><div><p className="font-semibold text-ink">{t.planner.progressTitle}</p><p className="mt-1 text-[12px] text-inkSoft" data-testid="structured-progress-message">{phaseMessage}</p></div></div>
      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t.planner.progressTitle}>{phases.map((item, index) => <li key={item} className={`h-1.5 rounded-full ${index <= activeIndex ? "bg-toba" : "bg-line"}`}><span className="sr-only">{t.planner.progressPhases[item]}</span></li>)}</ol>
      {onCancel && <button type="button" className="btn-outline mt-5 min-h-[44px]" onClick={onCancel}>{t.planner.cancelGeneration}</button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">{[0, 1].map((item) => <div key={item} className="animate-pulse rounded-2xl bg-white p-4 shadow-soft"><div className="h-5 w-1/2 rounded bg-line/60" /><div className="mt-4 h-3 w-full rounded bg-line/40" /><div className="mt-2 h-3 w-4/5 rounded bg-line/40" /></div>)}</div>
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
  affiliateEnabled = false,
  onRefine = null,
  onResultChange = null,
  generationId = "",
  feedbackEnabled = false,
}) {
  const [activeDay, setActiveDay] = useState(result.days[0]?.day || 1);
  const [requestedPartnerType, setRequestedPartnerType] = useState("");
  const partnersSectionRef = useRef(null);

  useEffect(() => {
    setActiveDay(result.days[0]?.day || 1);
  }, [result.generated_at, result.days]);

  const jumpToPartnerType = (partnerType) => {
    setRequestedPartnerType(partnerType);
    partnersSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return <div className="structured-planner-result min-w-0" data-testid="structured-planner-result">
    <PlannerSummary result={result} lang={lang} t={t} />
    <QuickRefineBar activeDay={activeDay} lang={lang} t={t} onRefine={onRefine} />
    <DayAccordion
      result={result}
      lang={lang}
      t={t}
      activeDay={activeDay}
      onActiveDayChange={setActiveDay}
      partnerMatchesEnabled={partnerMatchesEnabled}
      onJumpToPartnerType={jumpToPartnerType}
      onResultChange={onResultChange}
    />
    <RouteMapSection result={result} lang={lang} t={t} />
    <DestinationSection result={result} t={t} enabled={destinationCardsEnabled} />
    <PartnerSections
      result={result}
      lang={lang}
      t={t}
      enabled={partnerMatchesEnabled}
      culinaryEnabled={culinaryEnabled}
      requestedPartnerType={requestedPartnerType}
      partnersSectionRef={partnersSectionRef}
    />
    {affiliateEnabled && (
      <AffiliateBookingSection
        enabled={affiliateEnabled}
        destinationIds={result.destination_ids}
        startingPoint={result.request_snapshot?.starting_point || ""}
        source="planner"
        lang={lang}
      />
    )}
    <NotesAndTips result={result} t={t} />
    <PlannerFeedbackBar
      generationId={generationId}
      generatedAt={result.generated_at}
      lang={lang}
      t={t}
      enabled={feedbackEnabled}
    />
  </div>;
}
