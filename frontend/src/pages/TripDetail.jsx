import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Copy, Download, Edit3, Map, Printer, RefreshCw, Save, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatError } from "../lib/api.js";
import { privateCacheGet, privateCacheSet } from "../lib/offline.js";
import { renderMarkdown } from "../lib/markdown.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import Seo from "../components/Seo.jsx";
import TripShareControls from "../components/TripShareControls.jsx";

const TripMap = React.lazy(() => import("../components/TripMap.jsx"));

function metadataFromTrip(trip) {
  return {
    title: trip.title || "",
    days: trip.days || 1,
    budget: trip.budget || 0,
    interests: (trip.interests || []).join(", "),
    lang: trip.lang === "en" ? "en" : "id",
    extra_context: trip.extra_context || "",
  };
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [offlineAt, setOfflineAt] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const cacheKey = `trip_${id}`;
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get(`/itineraries/${id}`);
      setTrip(data);
      setForm(metadataFromTrip(data));
      privateCacheSet(user.id, cacheKey, data);
      setOfflineAt(null);
    } catch (error) {
      if ([403, 404].includes(error.response?.status)) {
        setTrip(null);
        setLoadError(true);
      } else {
        const cached = privateCacheGet(user.id, cacheKey);
        if (cached) {
          setTrip(cached.data);
          setForm(metadataFromTrip(cached.data));
          setOfflineAt(cached.savedAt);
        } else {
          setLoadError(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, id, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!trip?.destination_ids?.length) {
      setDestinations([]);
      return;
    }
    api.post("/destinations/batch", { ids: trip.destination_ids })
      .then(({ data }) => setDestinations(data))
      .catch(() => setDestinations([]));
  }, [trip?.destination_ids]);

  const mapDestinations = useMemo(() => destinations.filter((destination) => Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude))), [destinations]);
  const mapCenter = mapDestinations.length
    ? [Number(mapDestinations[0].latitude), Number(mapDestinations[0].longitude)]
    : [2.95, 99.06];

  const saveMetadata = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        days: Number(form.days),
        budget: Number(form.budget),
        interests: form.interests.split(",").map((value) => value.trim()).filter(Boolean),
        lang: form.lang,
        extra_context: form.extra_context.trim(),
        destination_ids: trip.destination_ids || [],
      };
      const { data } = await api.put(`/itineraries/${id}`, payload);
      setTrip(data);
      setForm(metadataFromTrip(data));
      privateCacheSet(user.id, cacheKey, data);
      setEditing(false);
      toast.success(t.savedTrips.updateSuccess);
    } catch (error) {
      toast.error(formatError(error.response?.data?.detail) || t.common.saveError);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/itineraries/${id}/duplicate`, { title: `${trip.title} — ${t.savedTrips.copySuffix}` });
      toast.success(t.savedTrips.duplicated);
      navigate(`/saved/trips/${data.id}`);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t.savedTrips.confirmDelete)) return;
    setBusy(true);
    try {
      await api.delete(`/itineraries/${id}`);
      toast.success(t.common.deleted);
      navigate("/wishlist?tab=trips", { replace: true });
    } catch {
      toast.error(t.common.error);
      setBusy(false);
    }
  };

  const exportTrip = () => {
    const payload = {
      title: trip.title,
      days: trip.days,
      budget: trip.budget,
      interests: trip.interests,
      destinations: destinations.map(({ id: destinationId, name, location }) => ({ id: destinationId, name, location })),
      itinerary: trip.content,
      updated_at: trip.updated_at,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${trip.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "trip"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-16 text-[13px] text-inkSoft">{t.common.loading}</div>;
  if (loadError || !trip) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center" data-testid="private-trip-error">
      <h1 className="font-display text-[26px]">{t.savedTrips.loadError}</h1>
      <p className="text-[14px] text-inkSoft mt-2">{t.savedTrips.loadErrorHint}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={load} className="btn-primary"><RefreshCw className="w-4 h-4" /> {t.common.retry}</button>
        <Link to="/wishlist?tab=trips" className="btn-outline">{t.savedTrips.backWorkspace}</Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10 print-area" data-testid="private-trip-detail">
      <Seo title={trip.title} description={t.savedTrips.privateSeoDescription} path={`/saved/trips/${id}`} noIndex />
      <div className="print-hidden mb-5">
        <Link to="/wishlist?tab=trips" className="inline-flex items-center gap-1.5 text-[13px] text-inkSoft hover:text-toba"><ArrowLeft className="w-4 h-4" /> {t.savedTrips.backWorkspace}</Link>
      </div>
      {offlineAt && <OfflineBanner savedAt={offlineAt} stale />}

      <header className="card-flat p-5 sm:p-7 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-toba">{t.savedTrips.tripLabel}</div>
            <h1 className="font-display text-[28px] sm:text-[36px] leading-tight mt-1 break-words">{trip.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-inkSoft">
              <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {trip.days} {t.savedTrips.daysLabel}</span>
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Rp {new Intl.NumberFormat("id-ID").format(trip.budget || 0)}</span>
              <span>{t.savedTrips.updatedAt} {formatDate(trip.updated_at || trip.created_at, lang)}</span>
            </div>
          </div>
          <div className="print-hidden flex flex-wrap gap-2 lg:justify-end">
            <button type="button" onClick={() => setEditing((value) => !value)} className="btn-outline"><Edit3 className="w-4 h-4" /> {t.savedTrips.edit}</button>
            <button type="button" onClick={duplicate} disabled={busy || offlineAt} className="btn-outline"><Copy className="w-4 h-4" /> {t.savedTrips.duplicate}</button>
            <Link to={`/planner?itinerary=${id}`} className="btn-outline"><Sparkles className="w-4 h-4" /> {t.savedTrips.regenerate}</Link>
            <button type="button" onClick={() => window.print()} className="btn-outline"><Printer className="w-4 h-4" /> {t.savedTrips.printPdf}</button>
            <button type="button" onClick={exportTrip} className="btn-outline"><Download className="w-4 h-4" /> {t.savedTrips.exportFile}</button>
            <button type="button" onClick={remove} disabled={busy || offlineAt} className="btn-outline text-red-700"><Trash2 className="w-4 h-4" /> {t.savedTrips.deleteBtn}</button>
          </div>
        </div>
        {!!trip.interests?.length && <div className="mt-4 flex flex-wrap gap-2">{trip.interests.map((interest) => <span key={interest} className="rounded-full bg-cream px-3 py-1.5 text-[12px] text-inkSoft">{interest}</span>)}</div>}
      </header>

      {editing && form && (
        <form onSubmit={saveMetadata} className="print-hidden card-flat p-5 sm:p-6 mb-5" data-testid="trip-metadata-form">
          <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-display text-[22px]">{t.savedTrips.metadata}</h2><button type="button" onClick={() => { setEditing(false); setForm(metadataFromTrip(trip)); }} className="p-2 text-inkSoft" aria-label={t.common.close}><X className="w-5 h-5" /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t.savedTrips.titleLabel} wide><input required maxLength={200} className="input-flat" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <Field label={t.planner.days}><input required type="number" min="1" max="30" className="input-flat" value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></Field>
            <Field label={t.planner.budget}><input required type="number" min="0" className="input-flat" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></Field>
            <Field label={t.savedTrips.language}><select className="input-flat" value={form.lang} onChange={(event) => setForm({ ...form, lang: event.target.value })}><option value="id">Indonesia</option><option value="en">English</option></select></Field>
            <Field label={t.planner.interests}><input className="input-flat" value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} placeholder={t.savedTrips.interestsHint} /></Field>
            <Field label={t.planner.extraContext} wide><textarea rows="3" maxLength={500} className="input-flat resize-y" value={form.extra_context} onChange={(event) => setForm({ ...form, extra_context: event.target.value })} /></Field>
          </div>
          <button type="submit" disabled={busy || !form.title.trim()} className="btn-primary mt-4"><Save className="w-4 h-4" /> {busy ? t.common.loading : t.savedTrips.saveChanges}</button>
        </form>
      )}

      <div className="print-hidden mb-5"><TripShareControls trip={trip} onChange={(data) => { setTrip(data); privateCacheSet(user.id, cacheKey, data); }} /></div>

      <article className="card-flat p-4 sm:p-7" data-testid="trip-content">{renderMarkdown(trip.content)}</article>

      <section className="mt-8 avoid-print-break">
        <div className="flex items-center gap-2 mb-4"><Map className="w-5 h-5 text-toba" /><h2 className="font-display text-[24px]">{t.savedTrips.destinationsInTrip}</h2></div>
        {destinations.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print-destination-grid">{destinations.map((destination) => <DestinationCard key={destination.id} dest={destination} />)}</div>
        ) : (
          <p className="card-flat p-4 text-[13px] text-inkSoft">{t.savedTrips.legacyNoDestinations}</p>
        )}
      </section>

      {!!mapDestinations.length && (
        <section className="mt-8 print-hidden">
          <h2 className="font-display text-[24px] mb-4">{t.savedTrips.map}</h2>
          <div className="rounded-xl overflow-hidden border border-line h-[360px]">
            <React.Suspense fallback={<div className="h-full flex items-center justify-center text-[13px] text-inkSoft">{t.common.loading}</div>}>
              <TripMap destinations={mapDestinations} center={mapCenter} lang={lang} />
            </React.Suspense>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, wide = false, children }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="block text-[12px] font-semibold text-inkSoft mb-1.5">{label}</span>{children}</label>;
}

function formatDate(value, lang) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" });
}
