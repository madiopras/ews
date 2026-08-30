import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  CarFront,
  Instagram,
  Landmark,
  LayoutGrid,
  Loader2,
  MapPin,
  MapPinned,
  Mountain,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
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

function DestinationSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className={`${item > 3 ? "hidden lg:block" : ""} overflow-hidden rounded-2xl border border-line bg-surface`}>
          <div className="aspect-[4/3] animate-pulse bg-line/50" />
          <div className="space-y-2 p-3 sm:p-4"><div className="h-5 w-4/5 animate-pulse rounded bg-line/50" /><div className="h-3 w-3/5 animate-pulse rounded bg-line/40" /><div className="h-11 animate-pulse rounded-xl bg-line/40" /></div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homeQuery, setHomeQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/destinations", { params: { featured: true, per_page: 6 } }).then((response) => response.data.data || response.data).catch(() => []),
      api.get("/destinations/trending", { params: { days: 30, limit: 8 } }).then((response) => response.data).catch(() => []),
    ]).then(([featuredRows, trendingRows]) => {
      const editorial = Array.isArray(featuredRows) ? featuredRows.slice(0, 6) : [];
      const editorialIds = new Set(editorial.map((item) => item.id));
      const popular = (Array.isArray(trendingRows) ? trendingRows : [])
        .filter((item) => !editorialIds.has(item.id))
        .slice(0, 4);
      setFeatured(editorial);
      setTrending(popular);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const search = homeQuery.trim();
    if (search.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSuggesting(true);
      api.get("/destinations/suggestions", { params: { q: search, limit: 6 }, signal: controller.signal })
        .then(({ data }) => setSuggestions(Array.isArray(data) ? data : []))
        .catch((error) => {
          if (error.code !== "ERR_CANCELED") setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [homeQuery]);

  const submitSearch = (event) => {
    event.preventDefault();
    const search = homeQuery.trim();
    navigate(search ? `/explore?q=${encodeURIComponent(search)}` : "/explore");
  };

  const heroImage = featured[0]?.images?.[0] || "/social-share.png";

  return (
    <div className="overflow-x-clip" data-testid="home-page">
      <Seo title={t.hero.title} description={t.hero.subtitle} path="/" />

      <section className="app-gutter mx-auto max-w-7xl pb-2 pt-4 sm:pt-6 lg:pt-8" data-testid="home-hero">
        <form onSubmit={submitSearch} className="relative z-30 mx-auto max-w-3xl lg:mx-0 lg:max-w-2xl" role="search" data-testid="home-search-form">
          <div className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-line/80 bg-surface px-3.5 shadow-[0_8px_28px_rgba(15,61,62,0.10)] sm:min-h-[58px] sm:px-5">
            <Search className="h-5 w-5 shrink-0 text-toba" aria-hidden="true" />
            <input
              type="search"
              value={homeQuery}
              onChange={(event) => setHomeQuery(event.target.value)}
              placeholder={t.home.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-inkSoft/70 sm:text-[15px]"
              aria-label={t.home.searchPlaceholder}
              aria-autocomplete="list"
              aria-controls="home-search-suggestions"
              data-testid="home-search-input"
            />
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin text-toba" aria-hidden="true" /> : (
              <button type="submit" className="min-h-[44px] shrink-0 rounded-xl px-2 text-xs font-semibold text-toba hover:bg-cream sm:px-3 sm:text-sm">{t.home.searchButton}</button>
            )}
          </div>
          {(suggestions.length > 0 || (homeQuery.trim().length >= 2 && !suggesting)) && (
            <div id="home-search-suggestions" role="listbox" className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-2xl border border-line bg-white text-left shadow-2xl sm:top-[64px]" data-testid="home-search-suggestions">
              {suggestions.map((item) => (
                <button key={item.id} type="button" role="option" aria-selected="false" onClick={() => navigate(`/destination/${item.id}`)} className="flex min-h-[58px] w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-cream sm:px-4">
                  <span className="h-10 w-12 shrink-0 overflow-hidden rounded-lg bg-line/40">{item.image && <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{lang === "en" && item.name_en ? item.name_en : item.name}</span><span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-inkSoft"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />{item.location}</span></span>
                </button>
              ))}
              <button type="submit" className="flex min-h-[48px] w-full items-center justify-center gap-2 px-4 text-sm font-semibold text-toba hover:bg-cream"><Search className="h-4 w-4" aria-hidden="true" />{t.home.viewAllResults}</button>
            </div>
          )}
        </form>

        <div className="mt-4 grid overflow-hidden rounded-[1.35rem] bg-toba shadow-[0_16px_38px_rgba(15,61,62,0.20)] lg:mt-6 lg:grid-cols-[1.25fr_0.75fr]" data-testid="home-planner-banner">
          <div className="relative overflow-hidden px-5 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
            <div className="absolute inset-0 text-cream/[0.08]" aria-hidden="true"><UlosPattern /></div>
            <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-brick/70 blur-3xl" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/70 sm:text-xs"><Sparkles className="h-4 w-4" aria-hidden="true" />{t.planner.tagline}</p>
              <h1 className="mt-2.5 font-display text-[27px] leading-[1.08] text-cream sm:text-4xl lg:text-5xl">{t.home.plannerTitle}</h1>
              <p className="mt-3 max-w-xl text-[13px] leading-6 text-cream/80 sm:text-[15px]">{t.home.plannerDescription}</p>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Link to="/planner" className="btn-primary w-full shadow-lg sm:w-auto" data-testid="home-planner-cta">{t.home.planNow}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link to="/explore" className="btn-onteal w-full sm:w-auto" data-testid="hero-cta-explore">{t.hero.cta}</Link>
              </div>
            </div>
          </div>
          <div className="relative hidden min-h-[320px] overflow-hidden lg:block">
            <img src={heroImage} alt="" loading="eager" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-toba via-toba/20 to-transparent" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-9" aria-labelledby="home-categories-title">
        <div className="app-gutter mx-auto max-w-7xl">
          <h2 id="home-categories-title" className="font-display text-xl text-ink sm:text-2xl">{t.home.categoriesTitle}</h2>
        </div>
        <div className="app-gutter mx-auto mt-3 flex max-w-7xl snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3" data-testid="home-category-rail">
          {HOME_CATEGORIES.map(({ key, icon: Icon }) => (
            <Link key={key} to={`/explore?category=${key}`} className="group flex min-h-[72px] min-w-[72px] snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border border-line/80 bg-surface px-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-toba/40 hover:shadow-md sm:min-h-[84px] sm:min-w-[92px]" data-testid={`category-card-${key}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-toba/10 text-toba transition group-hover:bg-toba group-hover:text-cream sm:h-10 sm:w-10"><Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" /></span>
              <span className="text-[10px] font-semibold leading-tight text-ink sm:text-xs">{t.categories[key]}</span>
            </Link>
          ))}
          <Link to="/explore" className="group flex min-h-[72px] min-w-[72px] snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border border-line/80 bg-surface px-2 text-center shadow-sm transition hover:border-toba/40 sm:min-h-[84px] sm:min-w-[92px]" data-testid="category-card-all">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brick/10 text-brick sm:h-10 sm:w-10"><LayoutGrid className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" /></span>
            <span className="text-[10px] font-semibold leading-tight text-ink sm:text-xs">{t.home.allCategories}</span>
          </Link>
        </div>
      </section>

      <section id="featured" className="app-gutter mx-auto mt-8 max-w-7xl sm:mt-12" data-testid="featured-section">
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
      </section>

      {trending.length > 0 && (
        <section className="mt-9 sm:mt-14" data-testid="trending-section">
          <div className="app-gutter mx-auto max-w-7xl">
            <SectionHeading eyebrow={t.trending.title} title={t.trending.subtitle} />
          </div>
          <div className="app-gutter mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-4">
            {trending.map((destination) => <div key={destination.id} className="w-[68vw] max-w-[280px] shrink-0 snap-start sm:w-auto sm:max-w-none"><HomeDestinationCard destination={destination} /></div>)}
          </div>
        </section>
      )}

      <section className="app-gutter mx-auto mt-10 max-w-7xl sm:mt-16" aria-labelledby="home-partners-title" data-testid="home-partner-services">
        <div className="relative overflow-hidden rounded-3xl border border-toba/15 bg-[linear-gradient(135deg,rgba(15,61,62,0.08),rgba(193,154,68,0.10))] p-5 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brick/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-toba sm:text-xs">{t.home.localBusinessEyebrow}</p>
            <h2 id="home-partners-title" className="mt-1 font-display text-[23px] leading-tight text-ink sm:text-3xl">{t.home.partnersTitle}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-inkSoft sm:text-sm">{t.home.partnersSub}</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              {PARTNER_SERVICES.map(({ type, icon: Icon }) => (
                <Link key={type} to={`/partners?type=${type}`} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-toba/30 hover:shadow-md sm:min-h-[88px] sm:flex-col sm:justify-center sm:text-center" data-testid={`home-partner-${type}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-toba text-cream"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span className="text-[11px] font-semibold leading-tight text-ink sm:text-xs">{t.partners.types[type]}</span>
                </Link>
              ))}
            </div>
            <Link to="/partners" className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-toba hover:underline">{t.home.findPartners}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="app-gutter mx-auto mt-10 max-w-7xl sm:mt-16" aria-labelledby="home-trust-title">
        <div className="grid gap-5 rounded-3xl bg-surface p-5 shadow-[0_10px_30px_rgba(15,61,62,0.08)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
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
      </section>

      <footer className="relative mt-12 overflow-hidden bg-toba sm:mt-20">
        <div className="absolute inset-0 text-cream/[0.06]" aria-hidden="true"><UlosPattern /></div>
        <div className="app-gutter relative mx-auto flex max-w-7xl flex-col gap-2 py-8 text-xs text-cream/75 sm:flex-row sm:items-center sm:justify-between sm:py-10 sm:text-[13px]">
          <div><span className="font-display text-base text-cream">Explore Wisata Sumut</span> · {lang === "en" ? "Discover North Sumatra with local insight" : "Jelajahi Sumatera Utara bersama pelaku lokal"}</div>
          <div>© {new Date().getFullYear()} — Horas!</div>
        </div>
      </footer>
    </div>
  );
}
