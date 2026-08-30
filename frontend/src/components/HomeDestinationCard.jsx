import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Sparkles } from "lucide-react";
import { useLang } from "../contexts/LanguageContext.jsx";

export default function HomeDestinationCard({ destination, priority = false }) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const name = lang === "en" && destination.name_en ? destination.name_en : destination.name;
  const image = destination.images?.[0] || "/social-share.png";

  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-line/80 bg-surface shadow-[0_8px_24px_rgba(15,61,62,0.08)]" data-testid={`home-destination-${destination.id}`}>
      <Link to={`/destination/${destination.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-toba" aria-label={`${name} · ${t.detail.viewDetails}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-line/40">
          <img
            src={image}
            alt={name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/social-share.png";
            }}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-surface/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-toba backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:text-[10px]">
            {t.categories[destination.category] || destination.category}
          </span>
        </div>
        <div className="px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-[16px] leading-5 text-ink sm:min-h-0 sm:text-lg">{name}</h3>
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] text-inkSoft sm:text-xs">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{destination.location}</span>
          </p>
        </div>
      </Link>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <button
          type="button"
          onClick={() => navigate(`/planner?dest=${destination.id}&name=${encodeURIComponent(name)}`)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-toba px-2 text-[11px] font-semibold text-cream transition hover:bg-tobaDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick sm:text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t.home.planDestination}
        </button>
      </div>
    </article>
  );
}
