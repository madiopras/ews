import React from "react";
import { useLang } from "@/contexts/LanguageContext";
import { MessageCircle, MapPin, User, Car, Home, Crown } from "lucide-react";

const ICONS = {
  guide: User,
  rental: Car,
  homestay: Home,
};

export default function PartnerCard({ partner, showBadge = false, onUpgrade }) {
  const { t, lang } = useLang();
  const Icon = ICONS[partner.type] || User;

  const waUrl = `https://wa.me/${partner.whatsapp}?text=${encodeURIComponent(
    `Halo ${partner.business_name}, saya menemukan Anda di Explore Sumut dan tertarik dengan layanan Anda.`
  )}`;

  const badge = {
    pending: { label: t.partners.pendingBadge, cls: "bg-amber-100 text-amber-800" },
    approved: { label: t.partners.approvedBadge, cls: "bg-moss/25 text-[#4F6047]" },
    rejected: { label: t.partners.rejectedBadge, cls: "bg-red-100 text-red-700" },
  }[partner.status] || { label: partner.status, cls: "" };

  return (
    <article
      className={`card-flat p-4 sm:p-5 flex gap-4 items-start relative overflow-hidden ${
        partner.is_premium ? "border-toba" : ""
      }`}
      data-testid={`partner-card-${partner.id}`}
    >
      {partner.is_premium && <span className="absolute left-0 top-0 bottom-0 w-1 bg-toba" />}

      <div className="w-14 h-14 shrink-0 rounded-lg border border-line bg-cream flex items-center justify-center text-toba overflow-hidden">
        {partner.image ? (
          <img
            src={partner.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="w-6 h-6" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-[19px] leading-tight truncate">
            {partner.business_name}
          </h3>
          {partner.is_premium && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-toba text-cream font-semibold"
              data-testid={`partner-premium-badge-${partner.id}`}
            >
              <Crown className="w-3 h-3" /> {t.partners.premium.badge}
            </span>
          )}
          {showBadge && (
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="badge-moss">{t.partners.types[partner.type]}</span>
          <span className="flex items-center gap-1 text-[13px] text-inkSoft">
            <MapPin className="w-3.5 h-3.5" /> {partner.city}
          </span>
        </div>
        <p className="mt-3 text-[13px] text-inkSoft leading-relaxed line-clamp-3">
          {partner.description}
        </p>

        {partner.is_premium && partner.premium_until && (
          <p className="mt-2 text-[12px] text-inkSoft" data-testid={`partner-premium-until-${partner.id}`}>
            {t.partners.premium.activeUntil}{" "}
            {new Date(partner.premium_until).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline w-full sm:w-auto"
            data-testid={`partner-wa-btn-${partner.id}`}
          >
            <MessageCircle className="w-4 h-4 text-toba" />
            {t.partners.contactWA}
          </a>
          {onUpgrade && !partner.is_premium && (
            <button
              onClick={() => onUpgrade(partner)}
              className="btn-primary w-full sm:w-auto text-[13px]"
              data-testid={`partner-upgrade-btn-${partner.id}`}
            >
              <Crown className="w-4 h-4" /> {t.partners.premium.upgrade}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
