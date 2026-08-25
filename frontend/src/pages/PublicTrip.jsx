import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { renderMarkdown } from "../lib/markdown.jsx";
import { Sparkles, Calendar, User } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import Seo from "../components/Seo.jsx";
import { travelStyleLabel } from "../lib/travelStyle.js";

export default function PublicTrip() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/public/itineraries/${slug}`)
      .then(({ data }) => setTrip(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!trip?.destination_ids?.length) {
      setDestinations([]);
      return;
    }
    api.post("/destinations/batch", { ids: trip.destination_ids })
      .then(({ data }) => setDestinations(data))
      .catch(() => setDestinations([]));
  }, [trip?.destination_ids]);

  if (loading)
    return <div className="max-w-3xl mx-auto px-4 mt-10 text-inkSoft text-[13px]">{t.common.loading}</div>;

  if (notFound || !trip)
    return (
      <div className="max-w-md mx-auto px-4 mt-12 pb-16 text-center" data-testid="public-trip-notfound">
        <h1 className="font-display text-[24px] mb-3">{t.savedTrips.publicNotFound}</h1>
        <Link to="/planner" className="btn-primary mt-2">
          {t.savedTrips.makeYourOwn}
        </Link>
      </div>
    );

  return (
    <div data-testid="public-trip-page">
      <Seo
        title={trip.title}
        description={`${trip.days} ${t.savedTrips.daysLabel} · ${t.savedTrips.publicSeoDescription}`}
        path={`/trip/${slug}`}
        image={destinations[0]?.images?.[0] || ""}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Trip",
          name: trip.title,
          description: `${trip.days} ${t.savedTrips.daysLabel} · ${t.savedTrips.publicSeoDescription}`,
          itinerary: destinations.map((destination) => ({ "@type": "TouristDestination", name: destination.name })),
        }}
      />
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {t.planner.tagline}
          </div>
          <h1
            className="mt-3 font-display text-[26px] sm:text-4xl leading-tight text-cream"
            data-testid="public-trip-title"
          >
            {trip.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-cream/80">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {t.savedTrips.byAuthor}{" "}
              <strong className="text-cream" data-testid="public-trip-author">
                {trip.author_name || t.savedTrips.anonymous}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {trip.days} {lang === "en" ? "days" : "hari"}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {travelStyleLabel(trip.budget_style, lang, lang === "en" ? "Legacy travel preference" : "Preferensi perjalanan lama")}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 pb-16">
        <article className="card-flat p-4 sm:p-7" data-testid="public-trip-content">
          {renderMarkdown(trip.content)}
        </article>
        {!!destinations.length && (
          <section className="mt-8">
            <h2 className="font-display text-[24px] mb-4">{t.savedTrips.destinationsInTrip}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{destinations.map((destination) => <DestinationCard key={destination.id} dest={destination} />)}</div>
          </section>
        )}
        <Link to="/planner" className="btn-primary w-full mt-5" data-testid="public-trip-cta">
          <Sparkles className="w-4 h-4" /> {t.savedTrips.makeYourOwn}
        </Link>
      </div>
    </div>
  );
}
