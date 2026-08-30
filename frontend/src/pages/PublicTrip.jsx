import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { Sparkles, Calendar, Printer, User } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import ItineraryResult from "../components/Planner/ItineraryResult.jsx";
import Seo from "../components/Seo.jsx";
import { travelStyleLabel } from "../lib/travelStyle.js";
import { hydratedDestinationsFromTrip, isPlannerResultV2 } from "../lib/plannerResultContract.js";

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
    const hydratedDestinations = hydratedDestinationsFromTrip(trip);
    if (hydratedDestinations) {
      setDestinations(hydratedDestinations);
      return;
    }
    if (!trip?.destination_ids?.length) {
      setDestinations([]);
      return;
    }
    api.post("/destinations/batch", { ids: trip.destination_ids })
      .then(({ data }) => setDestinations(data))
      .catch(() => setDestinations([]));
  }, [trip]);

  if (loading)
    return <div className="app-gutter mx-auto mt-10 max-w-3xl text-[13px] text-inkSoft">{t.common.loading}</div>;

  if (notFound || !trip)
    return (
      <div className="app-gutter mx-auto mt-12 max-w-md text-center md:pb-16" data-testid="public-trip-notfound">
        <h1 className="font-display text-[24px] mb-3">{t.savedTrips.publicNotFound}</h1>
        <Link to="/planner" className="btn-primary mt-2">
          {t.savedTrips.makeYourOwn}
        </Link>
      </div>
    );

  const hasStructuredResult = isPlannerResultV2(trip.structured_result);
  const structuredDestinations = hasStructuredResult ? trip.structured_result.destinations : [];
  const seoDestinations = destinations.length ? destinations : structuredDestinations;
  const seoDescription = hasStructuredResult
    ? trip.structured_result.summary.slice(0, 180)
    : `${trip.days} ${t.savedTrips.daysLabel} · ${t.savedTrips.publicSeoDescription}`;

  return (
    <div className="print-area" data-testid="public-trip-page">
      <Seo
        title={trip.title}
        description={seoDescription}
        path={`/trip/${slug}`}
        image={seoDestinations[0]?.images?.[0] || ""}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Trip",
          name: trip.title,
          description: seoDescription,
          itinerary: seoDestinations.map((destination) => ({ "@type": "TouristDestination", name: destination.name })),
        }}
      />
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="app-gutter relative mx-auto max-w-3xl py-7 sm:py-12">
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

      <div className="app-gutter mx-auto mt-5 max-w-3xl sm:mt-6 md:pb-16">
        <ItineraryResult trip={trip} t={t} lang={lang} testId="public-trip-content" />
        {!hasStructuredResult && !!destinations.length && (
          <section className="mt-8">
            <h2 className="font-display text-[24px] mb-4">{t.savedTrips.destinationsInTrip}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{destinations.map((destination) => <DestinationCard key={destination.id} dest={destination} />)}</div>
          </section>
        )}
        <div className="print-hidden mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => window.print()} className="btn-outline w-full sm:w-auto">
            <Printer className="h-4 w-4" /> {t.savedTrips.printPdf}
          </button>
          <Link to="/planner" className="btn-primary w-full sm:flex-1" data-testid="public-trip-cta">
            <Sparkles className="w-4 h-4" /> {t.savedTrips.makeYourOwn}
          </Link>
        </div>
      </div>
    </div>
  );
}
