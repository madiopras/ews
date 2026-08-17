import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import OfflineBanner from "@/components/OfflineBanner";
import { renderMarkdown } from "@/lib/markdown";
import { cacheGet, cacheSet, isOffline } from "@/lib/offline";
import { Heart, Sparkles, Trash2, ChevronDown, Share2, Copy, MessageCircle, Link2Off } from "lucide-react";
import { toast } from "sonner";

function ShareBox({ trip, onChange }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const url = trip.share_slug
    ? `${process.env.REACT_APP_BACKEND_URL}/api/share/${trip.share_slug}`
    : "";

  const setPublic = async (pub) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/itineraries/${trip.id}/share`, { public: pub });
      onChange(data);
      toast.success(pub ? t.savedTrips.shareOn : t.savedTrips.sharingStopped);
    } catch {
      toast.error("Error");
    } finally {
      setBusy(false);
    }
  };

  if (!trip.is_public) {
    return (
      <button
        onClick={() => setPublic(true)}
        disabled={busy}
        className="btn-outline w-full text-[13px]"
        data-testid={`share-enable-${trip.id}`}
      >
        <Share2 className="w-4 h-4 text-toba" /> {t.savedTrips.shareOff}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-cream p-3.5 space-y-3" data-testid={`share-box-${trip.id}`}>
      <div>
        <div className="text-[13px] font-semibold">{t.savedTrips.shareTitle}</div>
        <p className="text-[12px] text-inkSoft mt-1">{t.savedTrips.shareDesc}</p>
      </div>
      <div
        className="text-[12px] text-toba break-all bg-surface border border-line rounded-lg px-3 py-2.5"
        data-testid={`share-url-${trip.id}`}
      >
        {url}
      </div>
      <img
        src={`${process.env.REACT_APP_BACKEND_URL}/api/share/${trip.share_slug}/image.png`}
        alt=""
        loading="lazy"
        className="w-full rounded-lg border border-line"
        data-testid={`share-preview-${trip.id}`}
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${t.savedTrips.waText} ${trip.title} — ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 text-[13px]"
          data-testid={`share-wa-${trip.id}`}
        >
          <MessageCircle className="w-4 h-4" /> {t.savedTrips.shareWA}
        </a>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url);
            toast.success(t.savedTrips.copied);
          }}
          className="btn-outline text-[13px]"
          data-testid={`share-copy-${trip.id}`}
        >
          <Copy className="w-4 h-4" /> {t.savedTrips.copyLink}
        </button>
        <button
          onClick={() => setPublic(false)}
          disabled={busy}
          className="btn-outline text-[13px]"
          data-testid={`share-disable-${trip.id}`}
        >
          <Link2Off className="w-4 h-4" /> {t.savedTrips.stopSharing}
        </button>
      </div>
    </div>
  );
}

export default function Wishlist() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "trips" ? "trips" : "destinations");
  const [dests, setDests] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [offlineAt, setOfflineAt] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.allSettled([api.get("/wishlist"), api.get("/itineraries")]).then(([w, i]) => {
      const ok = w.status === "fulfilled" && i.status === "fulfilled";
      if (ok) {
        setDests(w.value.data);
        setTrips(i.value.data);
        setOfflineAt(isOffline() ? Date.now() : null);
        cacheSet("wishlist", { dests: w.value.data, trips: i.value.data });
        w.value.data.forEach((d) => cacheSet(`dest_${d.id}`, d));
      } else {
        const cached = cacheGet("wishlist");
        if (cached) {
          setDests(cached.data.dests || []);
          setTrips(cached.data.trips || []);
          setOfflineAt(cached.savedAt);
        }
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const deleteTrip = async (id) => {
    if (!window.confirm(t.savedTrips.confirmDelete)) return;
    try {
      await api.delete(`/itineraries/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Error");
    }
  };

  const patchTrip = (updated) =>
    setTrips((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16" data-testid="wishlist-page">
      <header className="mb-5">
        <div className="eyebrow flex items-center gap-2">
          <Heart className="w-4 h-4" /> {t.nav.wishlist}
        </div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">{t.wishlist.title}</h1>
      </header>

      <OfflineBanner savedAt={offlineAt} />

      <div className="scroll-x mb-6">
        <button
          onClick={() => setTab("destinations")}
          className={`chip ${tab === "destinations" ? "chip-active" : ""}`}
          data-testid="wishlist-tab-dest"
        >
          <Heart className="w-4 h-4 mr-2" />
          {t.savedTrips.destTab} ({dests.length})
        </button>
        <button
          onClick={() => setTab("trips")}
          className={`chip ${tab === "trips" ? "chip-active" : ""}`}
          data-testid="wishlist-tab-trips"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {t.savedTrips.tab} ({trips.length})
        </button>
      </div>

      {loading ? (
        <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
      ) : tab === "destinations" ? (
        dests.length === 0 ? (
          <div className="card-flat text-center py-14 px-4">
            <div className="font-display text-[22px] mb-4">{t.wishlist.empty}</div>
            <Link to="/explore" className="btn-primary" data-testid="wishlist-browse-btn">
              {t.wishlist.browse}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {dests.map((d, i) => (
              <DestinationCard key={d.id} dest={d} index={i} />
            ))}
          </div>
        )
      ) : trips.length === 0 ? (
        <div className="card-flat text-center py-14 px-4">
          <div className="font-display text-[22px] mb-4">{t.savedTrips.empty}</div>
          <Link to="/planner" className="btn-primary" data-testid="wishlist-planner-btn">
            {t.planner.title}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((tr) => (
            <div key={tr.id} className="card-flat overflow-hidden" data-testid={`saved-trip-${tr.id}`}>
              <div className="w-full p-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                  className="flex-1 min-w-0 text-left min-h-[44px]"
                  data-testid={`saved-trip-toggle-${tr.id}`}
                >
                  <div className="font-display text-[19px] truncate">{tr.title}</div>
                  <div className="text-[12px] text-inkSoft mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {tr.days} {lang === "en" ? "days" : "hari"} · Rp{" "}
                      {new Intl.NumberFormat("id-ID").format(tr.budget)}
                      {" · "}
                      {new Date(tr.created_at).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {tr.is_public && <span className="badge-moss">{t.savedTrips.shareOn}</span>}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => deleteTrip(tr.id)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-red-500 transition-colors"
                    data-testid={`saved-trip-delete-${tr.id}`}
                    aria-label="delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-toba transition-colors"
                    aria-label="expand"
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${expanded === tr.id ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              <div className="px-4 pb-4">
                <ShareBox trip={tr} onChange={patchTrip} />
              </div>

              {expanded === tr.id && (
                <div className="px-4 pb-4 border-t border-line pt-3">
                  {renderMarkdown(tr.content, true)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
