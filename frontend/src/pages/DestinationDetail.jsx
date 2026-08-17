import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Heart, MapPin, Tag, Wallet } from "lucide-react";
import Reviews from "@/components/Reviews";
import DestinationPartners from "@/components/DestinationPartners";
import OfflineBanner from "@/components/OfflineBanner";
import { cacheGet, cacheSet, isOffline } from "@/lib/offline";

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
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [offlineAt, setOfflineAt] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/destinations/${id}`)
      .then(({ data }) => {
        setDest(data);
        setOfflineAt(isOffline() ? Date.now() : null);
        cacheSet(`dest_${id}`, data);
      })
      .catch(() => {
        const cached = cacheGet(`dest_${id}`);
        if (cached) {
          setDest(cached.data);
          setOfflineAt(cached.savedAt);
        } else {
          setDest(null);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

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
      navigate("/login");
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
    } catch (e) {
      toast.error("Error");
    }
  };

  if (loading)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-inkSoft text-[13px]">
        {t.common.loading}
      </div>
    );
  if (!dest)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Link to="/" className="text-toba font-semibold">
          {t.common.backHome}
        </Link>
      </div>
    );

  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const description =
    lang === "en" && dest.description_en ? dest.description_en : dest.description;
  const price = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID").format(dest.price);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 pb-16" data-testid="dest-detail-page">
      <button
        onClick={() => navigate(-1)}
        className="btn-ghost px-2 mb-3 text-[13px]"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> {lang === "en" ? "Back" : "Kembali"}
      </button>

      <OfflineBanner savedAt={offlineAt} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Gallery */}
        <div className="lg:col-span-7">
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
                  <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="card-flat p-3.5">
              <div className="text-[11px] tracking-[0.14em] uppercase text-inkSoft mb-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> {t.detail.price}
              </div>
              <div className="font-display text-[20px]">
                <span className="text-[13px] text-inkSoft mr-1">{t.common.currency}</span>
                {price}
              </div>
            </div>
            <div className="card-flat p-3.5">
              <div className="text-[11px] tracking-[0.14em] uppercase text-inkSoft mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {t.detail.category}
              </div>
              <div className="font-display text-[20px] capitalize">
                {t.categories[dest.category]}
              </div>
            </div>
          </div>

          <button
            onClick={toggleWishlist}
            className={inWishlist ? "btn-outline w-full" : "btn-primary w-full"}
            data-testid="wishlist-toggle-btn"
          >
            <Heart className={`w-4 h-4 ${inWishlist ? "fill-current text-brick" : ""}`} />
            {inWishlist ? t.detail.removeWishlist : t.detail.addWishlist}
          </button>

          <div>
            <h2 className="font-display text-[22px] mb-2">{t.detail.about}</h2>
            <p className="text-[14px] text-inkSoft leading-relaxed" data-testid="dest-description">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <section className="mt-12 sm:mt-16">
        <h2 className="section-title mb-4">{t.detail.map}</h2>
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
