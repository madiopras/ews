import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext.jsx";
import { MapPin, ArrowUpRight, Sparkles } from "lucide-react";

export default function DestinationCard({ dest }) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const name = lang === "en" && dest.name_en ? dest.name_en : dest.name;
  const image =
    dest.images?.[0] ||
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70";

  return (
    <article
      data-testid={`destination-card-${dest.id}`}
      className="group block card-link overflow-hidden"
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

      <div className="p-4 flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[20px] leading-snug text-ink truncate">
            {name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-inkSoft">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{dest.location}</span>
          </div>
        </div>

        {/* CTA Button to AI Planner */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigate(`/planner?dest=${dest.id}&name=${encodeURIComponent(name)}`);
          }}
          className="btn-primary w-full flex items-center justify-center gap-2 group/btn"
        >
          <Sparkles className="w-4 h-4 fill-current group-hover/btn:animate-pulse" />
          {t.detail.planVisit}
        </button>

        <Link
          to={`/destination/${dest.id}`}
          className="flex items-center justify-center gap-1.5 text-[13px] text-inkSoft hover:text-toba transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" /> {t.detail.viewDetails}
        </Link>
      </div>
    </article>
  );
}
