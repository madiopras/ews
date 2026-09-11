import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  CarFront,
  Instagram,
  Landmark,
  LayoutGrid,
  MapPin,
  MapPinned,
  Mountain,
  ShieldCheck,
  ShoppingBag,
  Trees,
  Umbrella,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import HomeDestinationCard from "../components/HomeDestinationCard.jsx";
import UlosPattern from "../components/UlosPattern.jsx";
import Seo from "../components/Seo.jsx";
import TripPromptComposer from "../components/Planner/TripPromptComposer.jsx";
import { createHomePlannerHandoff } from "../lib/plannerDraft.js";

const HOME_CATEGORIES = [
  { key: "nature", icon: Trees },
  { key: "culture", icon: Landmark },
  { key: "culinary", icon: UtensilsCrossed },
  { key: "beach", icon: Umbrella },
  { key: "mountain", icon: Mountain },
  { key: "waterfall", icon: Waves },
  { key: "lake", icon: MapPin },
];

const PARTNER_SERVICES = [
  { type: "guide", icon: MapPinned },
  { type: "homestay", icon: BedDouble },
  { type: "rental", icon: CarFront },
  { type: "culinary", icon: UtensilsCrossed },
  { type: "souvenir", icon: ShoppingBag },
];

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-toba sm:text-xs">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-[23px] leading-tight text-ink sm:text-3xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-xs leading-5 text-inkSoft sm:text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function RevealSection({ className = "", children, ...props }) {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(() => (
    typeof window === "undefined" || !("IntersectionObserver" in window)
  ));

  useEffect(() => {
    if (visible || !sectionRef.current || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "0px 0px -8%" });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [visible]);

  return <section ref={sectionRef} className={`section-reveal ${visible ? "is-visible" : ""} ${className}`} {...props}>{children}</section>;
}

function DestinationSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className={`${item > 3 ? "hidden lg:block" : ""} surface-content overflow-hidden rounded-2xl shadow-soft-md`}>
          <div className="aspect-[4/3] animate-pulse bg-line/50" />
          <div className="space-y-2 p-3 sm:p-4"><div className="h-5 w-4/5 animate-pulse rounded bg-line/50" /><div className="h-3 w-3/5 animate-pulse rounded bg-line/40" /><div className="h-11 animate-pulse rounded-xl bg-line/40" /></div>
        </div>
      ))}
    </div>
  );
}

function InspirationCard({ destination, priority = false }) {
  const { lang, t } = useLang();
  const name = lang === "en" && destination.name_en ? destination.name_en : destination.name;
  const image = destination.images?.[0] || "/social-share.png";

  return (
    <Link
      to={`/destination/${destination.id}`}
      className="inspiration-card group relative block aspect-[4/3] w-[82vw] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-[22px] bg-toba shadow-[0_12px_30px_rgba(15,61,62,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick sm:w-auto sm:max-w-none"
      aria-label={`${name} · ${t.detail.viewDetails}`}
      data-testid={`home-inspiration-${destination.id}`}
    >
      <img
        src={image}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/social-share.png";
        }}
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-toba/95 via-toba/15 to-transparent" aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0 block p-4 text-cream sm:p-5">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/70">
          {t.categories[destination.category] || destination.category}
        </span>
        <span className="mt-1 block font-display text-xl leading-tight sm:text-2xl">{name}</span>
        <span className="mt-2 flex items-center gap-1 text-[11px] text-cream/75">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{destination.location}</span>
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [inspiration, setInspiration] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tripPrompt, setTripPrompt] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/destinations", { params: { featured: true, per_page: 6 } }).then((response) => response.data.data || response.data).catch(() => []),
      api.get("/destinations/trending", { params: { days: 30, limit: 8 } }).then((response) => response.data).catch(() => []),
    ]).then(([featuredRows, trendingRows]) => {
      const editorial = Array.isArray(featuredRows) ? featuredRows.slice(0, 6) : [];
      const editorialIds = new Set(editorial.map((item) => item.id));
      const popular = (Array.isArray(trendingRows) ? trendingRows : [])
        .filter((item) => !editorialIds.has(item.id));
      setFeatured(editorial);
      setInspiration(popular.slice(0, 3));
      setTrending(popular.slice(3, 7));
      setLoading(false);
    });
  }, []);

  const startPlanning = (event) => {
    event.preventDefault();
    const prompt = tripPrompt.trim();
    if (!prompt) return;
    createHomePlannerHandoff(prompt);
    navigate("/planner");
  };

  return (
    <div className="overflow-x-clip" data-testid="home-page">
      <Seo title={t.hero.title} description={t.hero.subtitle} path="/" />

      <section className="home-hero-surface relative isolate overflow-hidden" data-testid="home-hero">
        <div className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-toba/10 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-brick/10 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-0 text-toba/[0.035]" aria-hidden="true"><UlosPattern /></div>
        <div className="app-gutter relative mx-auto flex min-h-[430px] max-w-7xl flex-col items-center justify-center py-10 text-center sm:min-h-[570px] sm:py-20 lg:min-h-[600px]">
          <h1 className="max-w-4xl text-balance font-display text-[clamp(1.375rem,6.5vw,2rem)] font-bold leading-[1.08] text-toba sm:text-5xl lg:text-[48px]" data-testid="home-hero-heading">
            {t.home.plannerTitle}<span className="mt-1 block text-brick">{t.home.plannerHeadlineAccent}</span>
          </h1>
          <form onSubmit={startPlanning} className="mt-7 w-full max-w-[820px] text-left sm:mt-9" data-testid="home-planner-form">
            <TripPromptComposer
              value={tripPrompt}
              onChange={setTripPrompt}
              placeholder={t.home.plannerPromptPlaceholder}
              animatedPlaceholders={t.home.plannerPromptExamples}
              submitLabel={t.home.startPlanning}
              lang={lang}
              testIdPrefix="home-planner-prompt"
            />
          </form>
        </div>
      </section>

      {(loading || inspiration.length > 0) && (
        <RevealSection className="surface-brand-soft py-9 sm:py-14" aria-labelledby="home-inspiration-title" data-testid="home-inspiration-section">
          <div className="app-gutter mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.home.inspirationEyebrow} title={t.home.inspirationTitle} description={t.home.inspirationSub} />
            {loading ? (
              <div className="flex gap-3 overflow-hidden" aria-hidden="true">
                {[0, 1, 2].map((item) => <div key={item} className="aspect-[4/3] w-[82vw] max-w-[330px] shrink-0 animate-pulse rounded-[22px] bg-toba/15 sm:w-full" />)}
              </div>
            ) : (
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:pb-0" data-testid="home-inspiration-rail">
                {inspiration.map((destination, index) => <InspirationCard key={destination.id} destination={destination} priority={index === 0} />)}
              </div>
            )}
          </div>
        </RevealSection>
      )}

      <RevealSection className="surface-content py-9 sm:py-12" aria-labelledby="home-categories-title">
        <div className="app-gutter mx-auto max-w-7xl">
          <h2 id="home-categories-title" className="font-display text-xl text-ink sm:text-2xl">{t.home.categoriesTitle}</h2>
        </div>
        <div className="app-gutter mx-auto mt-3 flex max-w-7xl snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3" data-testid="home-category-rail">
          {HOME_CATEGORIES.map(({ key, icon: Icon }) => (
            <Link key={key} to={`/explore?category=${key}`} className="interactive-lift group flex min-h-[72px] min-w-[72px] snap-start flex-col items-center justify-center gap-1.5 rounded-2xl bg-cream/75 px-2 text-center shadow-soft sm:min-h-[84px] sm:min-w-[92px]" data-testid={`category-card-${key}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-toba/10 text-toba transition-colors duration-200 group-hover:bg-toba group-hover:text-cream sm:h-10 sm:w-10"><Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" /></span>
              <span className="text-[10px] font-semibold leading-tight text-ink sm:text-xs">{t.categories[key]}</span>
            </Link>
          ))}
          <Link to="/explore" className="interactive-lift group flex min-h-[72px] min-w-[72px] snap-start flex-col items-center justify-center gap-1.5 rounded-2xl bg-cream/75 px-2 text-center shadow-soft sm:min-h-[84px] sm:min-w-[92px]" data-testid="category-card-all">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brick/10 text-brick sm:h-10 sm:w-10"><LayoutGrid className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" /></span>
            <span className="text-[10px] font-semibold leading-tight text-ink sm:text-xs">{t.home.allCategories}</span>
          </Link>
        </div>
      </RevealSection>

      <RevealSection id="featured" className="surface-sage py-10 sm:py-16" data-testid="featured-section">
        <div className="app-gutter mx-auto max-w-7xl">
          <SectionHeading
          eyebrow={t.home.editorialEyebrow}
          title={t.home.featured}
          description={t.home.featuredSub}
          action={<Link to="/explore" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-toba hover:underline sm:inline-flex" data-testid="see-all-link">{t.home.seeAll}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
        />
          {loading ? <DestinationSkeletons /> : featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {featured.map((destination, index) => <div key={destination.id} className={index >= 4 ? "hidden lg:block" : "min-w-0"}><HomeDestinationCard destination={destination} priority={index < 2} /></div>)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-inkSoft">{t.home.noFeatured}</div>
        )}
          <Link to="/explore" className="btn-outline mt-4 w-full sm:hidden">{t.home.seeAll}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </RevealSection>

      {trending.length > 0 && (
        <RevealSection className="bg-cream py-10 sm:py-16" data-testid="trending-section">
          <div className="app-gutter mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.trending.title} title={t.trending.subtitle} />
          </div>
          <div className="app-gutter mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-4">
            {trending.map((destination) => <div key={destination.id} className="w-[68vw] max-w-[280px] shrink-0 snap-start sm:w-auto sm:max-w-none"><HomeDestinationCard destination={destination} /></div>)}
          </div>
        </RevealSection>
      )}

      <RevealSection className="surface-brand-soft relative overflow-hidden py-10 sm:py-16" aria-labelledby="home-partners-title" data-testid="home-partner-services">
        <div className="app-gutter relative mx-auto max-w-7xl">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brick/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-toba sm:text-xs">{t.home.localBusinessEyebrow}</p>
            <h2 id="home-partners-title" className="mt-1 font-display text-[23px] leading-tight text-ink sm:text-3xl">{t.home.partnersTitle}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-inkSoft sm:text-sm">{t.home.partnersSub}</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              {PARTNER_SERVICES.map(({ type, icon: Icon }) => (
                <Link key={type} to={`/partners?type=${type}`} className="interactive-lift surface-content flex min-h-[76px] items-center gap-3 rounded-2xl px-3 py-3 text-left shadow-soft-md sm:min-h-[88px] sm:flex-col sm:justify-center sm:text-center" data-testid={`home-partner-${type}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-toba text-cream"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span className="text-[11px] font-semibold leading-tight text-ink sm:text-xs">{t.partners.types[type]}</span>
                </Link>
              ))}
            </div>
            <Link to="/partners" className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-toba hover:underline">{t.home.findPartners}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="surface-content py-10 sm:py-16" aria-labelledby="home-trust-title">
        <div className="app-gutter mx-auto grid max-w-7xl gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-toba sm:text-xs"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t.home.trustEyebrow}</p>
            <h2 id="home-trust-title" className="mt-2 font-display text-[23px] leading-tight text-ink sm:text-3xl">{t.home.trustTitle}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-inkSoft sm:text-sm">{t.home.trustDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[290px]">
            <div className="rounded-2xl bg-cream p-4 text-center"><strong className="block font-display text-2xl text-toba">14+</strong><span className="mt-1 block text-[10px] leading-tight text-inkSoft sm:text-xs">{t.home.yearsCurating}</span></div>
            <a href="https://www.instagram.com/explorewisatasumut/" target="_blank" rel="noreferrer" className="rounded-2xl bg-cream p-4 text-center transition hover:bg-line/40"><strong className="flex items-center justify-center gap-1 font-display text-2xl text-toba"><Instagram className="h-5 w-5" aria-hidden="true" />500K</strong><span className="mt-1 block text-[10px] leading-tight text-inkSoft sm:text-xs">{t.home.instagramCommunity}</span></a>
          </div>
        </div>
      </RevealSection>

      <footer className="relative overflow-hidden bg-toba">
        <div className="absolute inset-0 text-cream/[0.06]" aria-hidden="true"><UlosPattern /></div>
        <div className="app-gutter relative mx-auto flex max-w-7xl flex-col gap-2 py-8 text-xs text-cream/75 sm:flex-row sm:items-center sm:justify-between sm:py-10 sm:text-[13px]">
          <div><span className="font-display text-base text-cream">Explore Wisata Sumut</span> · {lang === "en" ? "Discover North Sumatra with local insight" : "Jelajahi Sumatera Utara bersama pelaku lokal"}</div>
          <div>© {new Date().getFullYear()} — Horas!</div>
        </div>
      </footer>
    </div>
  );
}
