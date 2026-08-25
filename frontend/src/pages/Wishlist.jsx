import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, CloudOff, ExternalLink, Heart, Lock, Search, Share2, Sparkles } from "lucide-react";
import { api } from "../lib/api.js";
import { travelStyleLabel } from "../lib/travelStyle.js";
import { privateCacheGet, privateCacheSet } from "../lib/offline.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import Seo from "../components/Seo.jsx";

const CACHE_KEY = "trip_workspace";

function normalizeTab(value) {
  return value === "trips" ? "trips" : "destinations";
}

function normalizeVisibility(value) {
  return ["all", "public", "private"].includes(value) ? value : "all";
}

export default function Wishlist() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [destinations, setDestinations] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(null);
  const [syncFailed, setSyncFailed] = useState(false);

  const tab = normalizeTab(searchParams.get("tab"));
  const query = searchParams.get("q") || "";
  const visibility = normalizeVisibility(searchParams.get("visibility"));

  const updateParams = useCallback((changes) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => {
        if (!value || value === "all" || (key === "tab" && value === "destinations")) next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setSyncFailed(false);
    const cached = privateCacheGet(user.id, CACHE_KEY);
    try {
      const [wishlistResult, tripsResult] = await Promise.allSettled([
        api.get("/wishlist"),
        api.get("/itineraries"),
      ]);
      if (wishlistResult.status === "rejected" && tripsResult.status === "rejected") throw wishlistResult.reason;
      const nextDestinations = wishlistResult.status === "fulfilled"
        ? wishlistResult.value.data
        : cached?.data?.destinations || [];
      const nextTrips = tripsResult.status === "fulfilled"
        ? tripsResult.value.data
        : cached?.data?.trips || [];
      setDestinations(nextDestinations);
      setTrips(nextTrips);
      privateCacheSet(user.id, CACHE_KEY, { destinations: nextDestinations, trips: nextTrips });
      setSavedAt(null);
      setSyncFailed(wishlistResult.status === "rejected" || tripsResult.status === "rejected");
    } catch {
      if (cached) {
        setDestinations(cached.data?.destinations || []);
        setTrips(cached.data?.trips || []);
        setSavedAt(cached.savedAt);
      }
      setSyncFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const filteredDestinations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(lang === "en" ? "en" : "id");
    if (!needle) return destinations;
    return destinations.filter((destination) => [
      destination.name,
      destination.name_en,
      destination.location,
      ...(destination.tags || []),
    ].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
  }, [destinations, lang, query]);

  const filteredTrips = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(lang === "en" ? "en" : "id");
    return trips.filter((trip) => {
      if (visibility === "public" && !trip.is_public) return false;
      if (visibility === "private" && trip.is_public) return false;
      return !needle || [trip.title, ...(trip.interests || [])].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [lang, query, trips, visibility]);

  const hasCache = savedAt !== null;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10" data-testid="trip-workspace">
      <Seo title={t.savedTrips.workspaceTitle} description={t.savedTrips.workspaceSubtitle} path="/wishlist" noIndex />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-[12px] tracking-[0.16em] uppercase font-semibold text-toba">{t.savedTrips.eyebrow}</div>
          <h1 className="font-display text-[30px] sm:text-[38px] text-ink mt-1">{t.savedTrips.workspaceTitle}</h1>
          <p className="text-[14px] text-inkSoft mt-1 max-w-2xl">{t.savedTrips.workspaceSubtitle}</p>
        </div>
        <Link to="/planner" className="btn-primary shrink-0"><Sparkles className="w-4 h-4" /> {t.savedTrips.newTrip}</Link>
      </div>

      {hasCache && <OfflineBanner savedAt={savedAt} stale />}
      {syncFailed && !hasCache && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-950 flex flex-wrap items-center justify-between gap-3" role="alert">
          <span className="flex items-center gap-2"><CloudOff className="w-4 h-4" /> {t.savedTrips.syncError}</span>
          <button type="button" onClick={load} className="underline font-semibold">{t.common.retry}</button>
        </div>
      )}

      <div className="card-flat p-3 sm:p-4 mb-6">
        <div className="flex gap-1 border-b border-line" role="tablist" aria-label={t.savedTrips.workspaceTitle}>
          <button type="button" role="tab" aria-selected={tab === "destinations"} onClick={() => updateParams({ tab: "destinations" })} className={`px-3 sm:px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px ${tab === "destinations" ? "border-toba text-toba" : "border-transparent text-inkSoft"}`}>
            <Heart className="inline w-4 h-4 mr-1.5" /> {t.savedTrips.destTab} ({destinations.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "trips"} onClick={() => updateParams({ tab: "trips" })} className={`px-3 sm:px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px ${tab === "trips" ? "border-toba text-toba" : "border-transparent text-inkSoft"}`}>
            <CalendarDays className="inline w-4 h-4 mr-1.5" /> {t.savedTrips.tab} ({trips.length})
          </button>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1">
            <span className="sr-only">{t.savedTrips.searchPlaceholder}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkSoft" />
            <input value={query} onChange={(event) => updateParams({ q: event.target.value })} placeholder={t.savedTrips.searchPlaceholder} className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-3 text-[14px] outline-none focus:border-toba" />
          </label>
          {tab === "trips" && (
            <select value={visibility} onChange={(event) => updateParams({ visibility: event.target.value })} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-toba" aria-label={t.savedTrips.visibilityFilter}>
              <option value="all">{t.savedTrips.allVisibility}</option>
              <option value="public">{t.savedTrips.sharedOnly}</option>
              <option value="private">{t.savedTrips.privateOnly}</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-inkSoft">{t.common.loading}</div>
      ) : tab === "destinations" ? (
        filteredDestinations.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{filteredDestinations.map((destination) => <DestinationCard key={destination.id} dest={destination} />)}</div>
        ) : (
          <EmptyState title={query ? t.savedTrips.noSearchResults : t.wishlist.empty} actionLabel={t.wishlist.browse} action="/explore" />
        )
      ) : filteredTrips.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTrips.map((trip) => (
            <article key={trip.id} className="card-flat p-5 flex flex-col" data-testid={`saved-trip-${trip.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[21px] text-ink truncate">{trip.title}</h2>
                  <p className="mt-1 text-[13px] text-inkSoft">{trip.days} {t.savedTrips.daysLabel} · {travelStyleLabel(trip.budget_style, lang, lang === "en" ? "Legacy travel preference" : "Preferensi perjalanan lama")}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${trip.is_public ? "bg-moss/20 text-toba" : "bg-line/50 text-inkSoft"}`}>
                  {trip.is_public ? <Share2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {trip.is_public ? t.savedTrips.shared : t.savedTrips.private}
                </span>
              </div>
              {!!trip.interests?.length && <div className="mt-3 flex flex-wrap gap-1.5">{trip.interests.slice(0, 5).map((interest) => <span key={interest} className="rounded-full bg-cream px-2 py-1 text-[11px] text-inkSoft">{interest}</span>)}</div>}
              <div className="mt-auto pt-5 flex items-center justify-between gap-3 border-t border-line/70">
                <span className="text-[11px] text-inkSoft">{t.savedTrips.updatedAt} {formatDate(trip.updated_at || trip.created_at, lang)}</span>
                <Link to={`/saved/trips/${trip.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-toba hover:underline">{t.savedTrips.openDetails} <ExternalLink className="w-3.5 h-3.5" /></Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={query || visibility !== "all" ? t.savedTrips.noSearchResults : t.savedTrips.empty} actionLabel={t.savedTrips.newTrip} action="/planner" />
      )}
    </div>
  );
}

function formatDate(value, lang) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function EmptyState({ title, actionLabel, action }) {
  return (
    <div className="card-flat py-14 px-5 text-center">
      <Heart className="w-8 h-8 mx-auto text-inkSoft/50" />
      <p className="mt-3 text-[14px] text-inkSoft">{title}</p>
      <Link to={action} className="btn-outline mt-4">{actionLabel}</Link>
    </div>
  );
}
