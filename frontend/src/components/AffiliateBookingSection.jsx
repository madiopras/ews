import React, { useEffect, useMemo, useState } from "react";
import { BedDouble, ExternalLink, Plane, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, formatError } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";

const BACKEND_ORIGIN = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

function buildRedirectHref(goUrl) {
  if (!goUrl || typeof goUrl !== "string") return "#";
  if (goUrl.startsWith("/api/")) return `${BACKEND_ORIGIN}${goUrl}`;
  return goUrl;
}

function useSafeLang(explicitLang) {
  let ctxLang = "id";
  try {
    const ctx = useLang();
    if (ctx?.lang) ctxLang = ctx.lang;
  } catch {
    ctxLang = "id";
  }
  return explicitLang || ctxLang;
}

export default function AffiliateBookingSection({
  enabled,
  zones = [],
  destinationIds = [],
  startingPoint = "",
  source = "planner",
  heading = "",
  subheading = "",
  variant = "cards",
  lang: explicitLang = "",
}) {
  const lang = useSafeLang(explicitLang);
  const [payload, setPayload] = useState(null);
  const [launchingKey, setLaunchingKey] = useState("");

  const zonesKey = useMemo(
    () => (Array.isArray(zones) ? zones.filter(Boolean).join(",") : ""),
    [zones],
  );
  const destIdsKey = useMemo(
    () => (Array.isArray(destinationIds) ? destinationIds.filter(Boolean).join(",") : ""),
    [destinationIds],
  );

  useEffect(() => {
    if (enabled === false) {
      setPayload(null);
      return undefined;
    }
    let active = true;
    const params = { source, lang };
    if (zonesKey) params.zones = zonesKey;
    if (destIdsKey) params.destination_ids = destIdsKey;
    if (startingPoint) params.starting_point = startingPoint;

    api
      .get("/affiliates/recommendations", { params })
      .then(({ data }) => {
        if (!active) return;
        if (data?.enabled && Array.isArray(data.items) && data.items.length > 0) {
          setPayload(data);
        } else {
          setPayload(null);
        }
      })
      .catch(() => {
        if (active) setPayload(null);
      });

    return () => {
      active = false;
    };
  }, [enabled, zonesKey, destIdsKey, startingPoint, source, lang]);

  if (enabled === false || !payload?.enabled || !payload.items?.length) {
    return null;
  }

  const handleMiniAppLaunch = async (card) => {
    const key = `${card.product}-${card.zone}`;
    setLaunchingKey(key);
    try {
      const { data } = await api.post("/affiliates/tiket/miniapp-session", {
        product: card.product,
        zone: card.zone,
        source,
        lang,
      });
      if (data?.launch_url) {
        window.open(data.launch_url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(
        formatError(
          error.response?.data?.detail ||
            (lang === "en"
              ? "Unable to open tiket.com booking session right now."
              : "Sesi pemesanan tiket.com sedang tidak dapat dibuka."),
        ),
      );
    } finally {
      setLaunchingKey("");
    }
  };

  const titleText =
    heading ||
    (lang === "en"
      ? "Book Flights & Stays via tiket.com"
      : "Pesan Tiket Pesawat & Penginapan di tiket.com");
  const subText =
    subheading ||
    (lang === "en"
      ? "Matched automatically to your North Sumatra route so you can check instant flight and hotel options alongside local partners."
      : "Disesuaikan otomatis dengan rute Sumatera Utara Anda untuk melengkapi layanan Mitra Lokal.");

  return (
    <section
      className={
        variant === "strip"
          ? "mt-8 rounded-2xl border border-line bg-cream/70 p-4 sm:p-5"
          : "mt-8 border-t border-line pt-6"
      }
      aria-labelledby={`affiliate-booking-title-${source}`}
      data-testid={`affiliate-booking-section-${source}`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-toba/10 p-2 text-toba shrink-0">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id={`affiliate-booking-title-${source}`} className="font-display text-xl text-ink">
            {titleText}
          </h3>
          <p className="mt-1 text-[12px] text-inkSoft leading-relaxed">{subText}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {payload.items.map((card) => {
          const Icon = card.product === "flight" ? Plane : BedDouble;
          const cardKey = `${card.product}-${card.zone}`;
          const isLaunching = launchingKey === cardKey;
          return (
            <div
              key={cardKey}
              className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-soft"
              data-testid={`affiliate-card-${card.product}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-toba">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {card.badge}
                  </span>
                  {card.airport_code && (
                    <span className="rounded-md bg-toba/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-toba">
                      {card.airport_code}
                    </span>
                  )}
                </div>
                <h4 className="mt-3 font-display text-lg text-ink leading-snug">{card.title}</h4>
                <p className="mt-1 text-[12px] text-inkSoft leading-relaxed">{card.subtitle}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-line/70 flex items-center justify-between gap-3">
                {card.launch_type === "miniapp_session" ? (
                  <button
                    type="button"
                    disabled={isLaunching}
                    onClick={() => handleMiniAppLaunch(card)}
                    className="btn-primary text-xs min-h-[40px] w-full sm:w-auto justify-center"
                    data-testid={`affiliate-launch-${card.product}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    {isLaunching
                      ? lang === "en"
                        ? "Opening tiket.com..."
                        : "Membuka tiket.com..."
                      : card.cta_label}
                  </button>
                ) : (
                  <a
                    href={buildRedirectHref(card.go_url)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="btn-primary text-xs min-h-[40px] w-full sm:w-auto justify-center"
                    data-testid={`affiliate-link-${card.product}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    {card.cta_label}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {payload.disclosure && (
        <p className="mt-3 text-[11px] text-inkSoft" data-testid="affiliate-disclosure">
          {payload.disclosure}
        </p>
      )}
    </section>
  );
}
