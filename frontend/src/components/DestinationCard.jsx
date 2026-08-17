import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { MapPin, ArrowUpRight } from "lucide-react";

export default function DestinationCard({ dest, index = 0 }) {
  const { lang, t } = useLang();
  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const image =
    dest.images?.[0] ||
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70";

  const price = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID").format(
    dest.price
  );

  return (
    <Link
      to={`/destination/${dest.id}`}
      data-testid={`destination-card-${dest.id}`}
      className="group block card-link overflow-hidden opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="relative overflow-hidden aspect-[4/3] bg-line/40">
        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute top-3 left-3 bg-surface/95 px-2.5 py-1 rounded-full text-[11px] tracking-wider uppercase font-semibold text-toba">
          {t.categories[dest.category] || dest.category}
        </span>
      </div>

      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[20px] leading-snug text-ink truncate">
            {name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-inkSoft">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{dest.location}</span>
          </div>
          <div className="mt-2 text-[13px]">
            <span className="text-inkSoft">{t.common.currency}</span>{" "}
            <span className="text-ink font-semibold">{price}</span>
          </div>
        </div>
        <span className="w-9 h-9 shrink-0 rounded-lg border border-line flex items-center justify-center text-toba group-hover:bg-toba group-hover:text-cream transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
