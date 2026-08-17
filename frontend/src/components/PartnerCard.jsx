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
    approved: { label: t.partners.approvedBadge, cls: "bg-emerald-100 text-emerald-800" },
    rejected: { label: t.partners.rejectedBadge, cls: "bg-red-100 text-red-700" },
  }[partner.status] || { label: partner.status, cls: "" };

  return (
    <article
      className="rounded-3xl bg-sand shadow-neu-raised p-6 flex gap-5 items-start"
      data-testid={`partner-card-${partner.id}`}
    >
      <div className="w-16 h-16 shrink-0 rounded-2xl shadow-neu-inset flex items-center justify-center text-sunset">
        {partner.image ? (
          <img
            src={partner.image}
            alt=""
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <Icon className="w-7 h-7" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-display text-xl leading-tight truncate">
            {partner.business_name}
          </h3>
          {showBadge && (
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs uppercase tracking-widest text-sunset">
          {t.partners.types[partner.type]}
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm text-muted2">
          <MapPin className="w-3.5 h-3.5" /> {partner.city}
        </div>
        <p className="mt-3 text-sm text-ink/85 leading-relaxed line-clamp-3">
          {partner.description}
        </p>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          data-testid={`partner-wa-btn-${partner.id}`}
        >
          <MessageCircle className="w-4 h-4" />
          {t.partners.contactWA}
        </a>
      </div>
    </article>
  );
}
