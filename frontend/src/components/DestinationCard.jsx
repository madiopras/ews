import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { MapPin, ArrowUpRight } from "lucide-react";

export default function DestinationCard({ dest, index = 0 }) {
  const { lang, t } = useLang();
  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const image =
    dest.images?.[0] ||
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";

  const price = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID").format(
    dest.price
  );

  return (
    <Link
      to={`/destination/${dest.id}`}
      data-testid={`destination-card-${dest.id}`}
      className="group block rounded-3xl bg-sand p-4 shadow-neu-raised hover:shadow-neu-raised-lg transition-shadow duration-500 opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative overflow-hidden rounded-2xl aspect-[4/5]">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 bg-sand/95 backdrop-blur px-3 py-1 rounded-full text-[11px] tracking-widest uppercase font-semibold text-jungle shadow-neu-sm">
          {t.categories[dest.category] || dest.category}
        </span>
      </div>

      <div className="pt-5 px-1 pb-1 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl leading-tight text-ink truncate">
            {name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{dest.location}</span>
          </div>
          <div className="mt-3 text-sm">
            <span className="text-muted2">{t.common.currency}</span>{" "}
            <span className="text-ink font-semibold">{price}</span>
          </div>
        </div>
        <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-neu-sm text-sunset group-hover:shadow-neu-pressed transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
