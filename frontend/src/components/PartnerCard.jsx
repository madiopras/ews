import React from "react";
import { useLang } from "@/contexts/LanguageContext";
import { MessageCircle, MapPin, User, Car, Home } from "lucide-react";

const ICONS = {
  guide: User,
  rental: Car,
  homestay: Home,
};

export default function PartnerCard({ partner, showBadge = false }) {
  const { t } = useLang();
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
      className="card-flat p-4 sm:p-5 flex gap-4 items-start"
      data-testid={`partner-card-${partner.id}`}
    >
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

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 btn-outline w-full sm:w-auto"
          data-testid={`partner-wa-btn-${partner.id}`}
        >
          <MessageCircle className="w-4 h-4 text-toba" />
          {t.partners.contactWA}
        </a>
      </div>
    </article>
  );
}
