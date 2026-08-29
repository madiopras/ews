import React, { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { toast } from "sonner";
import { ArrowLeft, Heart, MapPin, Tag, Sparkles, Navigation, Share2, ExternalLink, CalendarDays, ShieldCheck, RefreshCw } from "lucide-react";
import Reviews from "../components/Reviews.jsx";
import DestinationPartners from "../components/DestinationPartners.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import VideoLightbox from "../components/VideoLightbox.jsx";
import { cacheGet, cacheSet, isOffline } from "../lib/offline.js";
import Seo from "../components/Seo.jsx";
import NotFound from "./NotFound.jsx";
import { authUrl } from "../lib/authNavigation.js";

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function DestinationDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dest, setDest] = useState(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [loadState, setLoadState] = useState("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [offlineAt, setOfflineAt] = useState(null);
  const adminPreview = new URLSearchParams(window.location.search).get("preview") === "admin";

  useEffect(() => {
    setLoadState("loading");
    api
      .get(adminPreview ? `/admin/governance/preview/destinations/${id}` : `/destinations/${id}`)
      .then(({ data }) => {
        setDest(data);
        setOfflineAt(isOffline() ? Date.now() : null);
        cacheSet(`dest_${id}`, data);
        setLoadState("ready");
      })
      .catch((error) => {
        if ([400, 404].includes(error.response?.status)) {
          setDest(null);
          setLoadState("not_found");
          return;
        }
        const cached = cacheGet(`dest_${id}`);
        if (cached) {
          setDest(cached.data);
          setOfflineAt(cached.savedAt);
          setLoadState("ready");
        } else {
          setDest(null);
          setLoadState("error");
        }
      });
  }, [id, retryKey, adminPreview]);

  useEffect(() => {
    if (user && typeof user === "object") {
      api
        .get("/wishlist")
        .then(({ data }) => {
          setInWishlist(data.some((d) => d.id === id));
        })
        .catch(() => {});
    }
  }, [user, id]);

  const toggleWishlist = async () => {
    if (!user || typeof user !== "object") {
      toast.error(t.detail.loginToSave);
      navigate(authUrl("/login", `/destination/${id}`, `wishlist:${id}`));
      return;
    }
    try {
      if (inWishlist) {
        await api.delete(`/wishlist/${id}`);
        setInWishlist(false);
        toast.success(t.detail.removeWishlist);
      } else {
        await api.post(`/wishlist/${id}`);
        setInWishlist(true);
        toast.success(t.detail.addWishlist);
      }
    } catch {
      toast.error(t.common.error);
    }
  };

  const shareDestination = async () => {
    const shareData = { title: dest?.name || "Explore Wisata Sumut", text: t.detail.shareText, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareData.url);
        else {
          const field = document.createElement("textarea");
          field.value = shareData.url;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.appendChild(field);
          field.select();
          const copied = document.execCommand("copy");
          field.remove();
          if (!copied) throw new Error("Copy is not supported");
        }
        toast.success(t.detail.linkCopied);
      }
    } catch (error) {
      if (error.name !== "AbortError") toast.error(t.common.error);
    }
  };

  if (loadState === "loading")
    return (
      <div className="app-gutter mx-auto mt-8 max-w-7xl text-[13px] text-inkSoft">
        {t.common.loading}
      </div>
    );
  if (loadState === "not_found") return <NotFound />;
  if (loadState === "error")
    return (
      <div className="app-gutter mx-auto max-w-xl py-16 text-center" data-testid="destination-load-error">
        <div className="card-flat p-7"><h1 className="font-display text-2xl">{t.detail.loadError}</h1><p className="mt-2 text-sm text-inkSoft">{t.detail.loadErrorHint}</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => setRetryKey((value) => value + 1)} className="btn-primary"><RefreshCw className="w-4 h-4" /> {t.common.retry}</button><Link to="/explore" className="btn-outline">{t.nav.explore}</Link></div></div>
      </div>
    );

  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const description =
    lang === "en" && dest.description_en ? dest.description_en : dest.description;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${dest.latitude},${dest.longitude}`)}`;
  const reviewedAt = Date.parse(dest.editorial_reviewed_at || "");
  const reviewedDate = Number.isFinite(reviewedAt)
    ? new Date(reviewedAt).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name,
    description: description.slice(0, 300),
    image: dest.images || [],
    address: dest.location,
    geo: { "@type": "GeoCoordinates", latitude: dest.latitude, longitude: dest.longitude },
    url: window.location.href,
  };

  return (
    <div className="app-gutter mx-auto mt-3 max-w-7xl sm:mt-4 md:pb-16" data-testid="dest-detail-page">
      <Seo title={name} description={description.slice(0, 160)} path={`/destination/${dest.id}`} image={dest.images?.[0]} structuredData={structuredData} />
      {adminPreview && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950">Admin preview · {lang.toUpperCase()}</div>}
      <button
        onClick={() => navigate(-1)}
        className="btn-ghost px-2 mb-3 text-[13px]"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> {t.common.back}
      </button>

      <OfflineBanner savedAt={offlineAt} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
            {dest.images?.length > 0 && (
              <div className="min-w-0">
                <div className="rounded-xl overflow-hidden border border-line aspect-[4/3] bg-line/40">
                  <img
                    src={dest.images?.[activeImg] || dest.images?.[0]}
                    alt={name}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                    data-testid="dest-main-image"
                  />
                </div>
                {dest.images?.length > 1 && (
                  <div className="scroll-x mt-3">
                    {dest.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImg(i)}
                        className={`rounded-lg overflow-hidden w-20 h-20 shrink-0 border-2 transition-colors ${
                          activeImg === i ? "border-toba" : "border-line"
                        }`}
                        data-testid={`dest-thumb-${i}`}
                      >
                        <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Video (9:16) — lightweight, only loads when played */}
            {dest.video ? (
              <div
                className="w-40 xs:w-44 sm:w-48 shrink-0 mx-auto"
                style={{ maxWidth: "min(48vw, 200px)" }}
              >
                <VideoLightbox
                  videoUrl={dest.video}
                  poster={dest.images?.[0] || ""}
                  name={name}
                />
              </div>
            ) : null}
          </div>
          {!dest.images?.length && !dest.video ? (
            <div className="rounded-xl overflow-hidden border border-line aspect-[4/3] bg-line/40" />
          ) : null}
        </div>

        {/* Info */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div>
            <span className="badge-moss">{t.categories[dest.category]}</span>
            <h1
              className="mt-3 font-display text-[26px] sm:text-4xl leading-tight text-ink"
              data-testid="dest-name"
            >
              {name}
            </h1>
            <div className="mt-2 text-[13px] text-inkSoft flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {dest.location}
            </div>
          </div>

          <div className="card-flat p-4 bg-gradient-to-r from-toba/5 to-brick/5 border-toba/20">
            <div className="text-[11px] tracking-[0.14em] uppercase text-inkSoft mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t.planner.title}
            </div>
            <p className="text-sm text-inkSoft mb-3 leading-relaxed">{t.detail.planFromDestination}</p>
            <button
              onClick={() => navigate(`/planner?dest=${dest.id}&name=${encodeURIComponent(name)}`)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              {t.detail.planVisit}
            </button>
          </div>
          <div className="card-flat p-3.5">
            <div className="text-[11px] tracking-[0.14em] uppercase text-inkSoft mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> {t.detail.category}
            </div>
            <div className="font-display text-[20px] capitalize">
              {t.categories[dest.category]}
            </div>
            {dest.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="destination-tags">
                {dest.tags.map((tag) => <span key={tag} className="chip min-h-0 px-2 py-1 text-[11px]">{tag}</span>)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={toggleWishlist} className={inWishlist ? "btn-outline w-full" : "btn-primary w-full"} data-testid="wishlist-toggle-btn">
              <Heart className={`w-4 h-4 ${inWishlist ? "fill-current text-brick" : ""}`} /> {inWishlist ? t.detail.removeWishlist : t.detail.addWishlist}
            </button>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full" data-testid="directions-btn"><Navigation className="w-4 h-4" /> {t.detail.directions}</a>
            <button onClick={shareDestination} className="btn-outline w-full" data-testid="share-destination-btn"><Share2 className="w-4 h-4" /> {t.detail.share}</button>
          </div>

          <div>
            <h2 className="font-display text-[22px] mb-2">{t.detail.about}</h2>
            <p className="text-[14px] text-inkSoft leading-relaxed" data-testid="dest-description">
              {description}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-cream/60 p-4 text-[12px] text-inkSoft" data-testid="editorial-meta">
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-toba" /><p>{t.detail.dynamicDisclaimer}</p></div>
            {(dest.source_label || reviewedDate) && <div className="mt-3 border-t border-line pt-3 space-y-2">
              {reviewedDate && <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> {t.detail.reviewedAt.replace("{date}", reviewedDate)}</div>}
              {dest.source_label && (dest.source_url ? <a href={dest.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-toba hover:underline"><ExternalLink className="h-3.5 w-3.5" /> {t.detail.source}: {dest.source_label}</a> : <div>{t.detail.source}: {dest.source_label}</div>)}
            </div>}
          </div>
        </div>
      </div>

      {/* Map */}
      <section className="mt-12 sm:mt-16">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="section-title">{t.detail.map}</h2><a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline"><Navigation className="w-4 h-4" /> {t.detail.openNavigation}</a></div>
        <div className="rounded-xl overflow-hidden border border-line h-[280px] sm:h-[400px]">
          <MapContainer
            center={[dest.latitude, dest.longitude]}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[dest.latitude, dest.longitude]}>
              <Popup>{name}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </section>

      <Reviews destinationId={dest.id} />
      <DestinationPartners destinationId={dest.id} />
    </div>
  );
}
