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

  useEffect(() => {
    setLoading(true);
    api
      .get(`/destinations/${id}`)
      .then(({ data }) => setDest(data))
      .catch(() => setDest(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user && typeof user === "object") {
      api.get("/wishlist").then(({ data }) => {
        setInWishlist(data.some((d) => d.id === id));
      });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 text-muted2">
        {t.common.loading}
      </div>
    );
  if (!dest)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <Link to="/" className="text-sunset">
          {t.common.backHome}
        </Link>
      </div>
    );

  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const description =
    lang === "en" && dest.description_en ? dest.description_en : dest.description;
  const price = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID").format(
    dest.price
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-24" data-testid="dest-detail-page">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 px-4 py-2 rounded-full shadow-neu-sm text-sm inline-flex items-center gap-2 hover:text-sunset transition-colors"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> {lang === "en" ? "Back" : "Kembali"}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div className="neu-raised rounded-3xl p-3">
            <div className="rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[5/4]">
              <img
                src={dest.images?.[activeImg] || dest.images?.[0]}
                alt={name}
                className="w-full h-full object-cover"
                data-testid="dest-main-image"
              />
            </div>
          </div>
          {dest.images?.length > 1 && (
            <div className="flex gap-3 mt-4">
              {dest.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`rounded-2xl overflow-hidden w-24 h-24 shrink-0 p-1 ${
                    activeImg === i
                      ? "shadow-neu-pressed"
                      : "shadow-neu-sm hover:shadow-neu-raised"
                  }`}
                  data-testid={`dest-thumb-${i}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover rounded-xl" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div>
            <span className="inline-block text-xs tracking-[0.2em] uppercase text-sunset mb-3">
              {t.categories[dest.category]}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl leading-tight text-ink" data-testid="dest-name">
              {name}
            </h1>
            <div className="mt-3 text-muted2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> {dest.location}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 shadow-neu-inset">
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted2 mb-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> {t.detail.price}
              </div>
              <div className="font-display text-2xl">
                <span className="text-sm text-muted2 mr-1">{t.common.currency}</span>
                {price}
              </div>
            </div>
            <div className="rounded-2xl p-4 shadow-neu-inset">
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted2 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {t.detail.category}
              </div>
              <div className="font-display text-2xl capitalize">
                {t.categories[dest.category]}
              </div>
            </div>
          </div>

          <button
            onClick={toggleWishlist}
            className={`px-6 py-4 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
              inWishlist
                ? "bg-sunset text-sand hover:bg-sunset/90"
                : "shadow-neu-raised hover:text-sunset"
            }`}
            data-testid="wishlist-toggle-btn"
          >
            <Heart
              className={`w-4 h-4 ${inWishlist ? "fill-current" : ""}`}
            />
            {inWishlist ? t.detail.removeWishlist : t.detail.addWishlist}
          </button>

          <div>
            <h2 className="font-display text-2xl mb-3">{t.detail.about}</h2>
            <p className="text-muted2 leading-relaxed" data-testid="dest-description">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <section className="mt-16">
        <h2 className="font-display text-3xl mb-6">{t.detail.map}</h2>
        <div className="neu-raised rounded-3xl p-3">
          <div className="rounded-2xl overflow-hidden h-[420px]">
            <MapContainer
              center={[dest.latitude, dest.longitude]}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[dest.latitude, dest.longitude]}>
                <Popup>{name}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <Reviews destinationId={dest.id} />

      {/* Local Partners */}
      <DestinationPartners destinationId={dest.id} />
    </div>
  );
}
