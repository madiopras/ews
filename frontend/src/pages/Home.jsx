import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import { ArrowRight, Compass, Sparkles, TrendingUp, Mountain, MapPin, Droplet, Leaf, Tent, Flame, Search, Loader2 } from "lucide-react";
import { CATEGORY_KEYS } from "../lib/i18n.js";
import UlosPattern from "../components/UlosPattern.jsx";
import Seo from "../components/Seo.jsx";

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
      api.get("/destinations", { params: { featured: true, per_page: 100 } }).then((r) => r.data.data || r.data).catch(() => []),
      api.get("/destinations/trending", { params: { days: 30, limit: 4 } }).then((r) => r.data).catch(() => []),
    ]).then(([f, tr]) => {
        f = Array.isArray(f) ? f : [];
        tr = Array.isArray(tr) ? tr : [];
      setFeatured(f);
      setTrending(tr);
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

  return (
    <div className="pb-16">
      <Seo title={t.hero.title} description={t.hero.subtitle} path="/" />
      {/* HERO — dark teal */}
      <section className="relative bg-toba overflow-hidden" data-testid="home-hero">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-[12px] tracking-[0.18em] uppercase text-cream/70">
              <Compass className="w-4 h-4" /> {t.hero.tagline}
            </span>
            <h1 className="mt-4 font-display text-[30px] sm:text-5xl lg:text-6xl leading-[1.08] text-cream">
              {t.hero.title}
            </h1>
            <p className="mt-4 text-[15px] sm:text-base text-cream/80 leading-relaxed max-w-xl">
              {t.hero.subtitle}
            </p>
            <form onSubmit={submitSearch} className="relative mt-6 max-w-xl" role="search" data-testid="home-search-form">
              <div className="flex min-h-[52px] items-center gap-3 rounded-xl bg-white px-4 shadow-xl">
                <Search className="h-5 w-5 shrink-0 text-toba" />
                <input
                  type="search"
                  value={homeQuery}
                  onChange={(event) => setHomeQuery(event.target.value)}
                  placeholder={t.home.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-inkSoft"
                  aria-label={t.home.searchPlaceholder}
                  aria-autocomplete="list"
                  aria-controls="home-search-suggestions"
                  data-testid="home-search-input"
                />
                {suggesting ? <Loader2 className="h-4 w-4 animate-spin text-toba" /> : <button type="submit" className="text-sm font-semibold text-toba">{t.home.searchButton}</button>}
              </div>
              {(suggestions.length > 0 || (homeQuery.trim().length >= 2 && !suggesting)) && (
                <div id="home-search-suggestions" role="listbox" className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-xl border border-line bg-white text-left shadow-2xl" data-testid="home-search-suggestions">
                  {suggestions.map((item) => (
                    <button key={item.id} type="button" role="option" aria-selected="false" onClick={() => navigate(`/destination/${item.id}`)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-cream">
                      <div className="h-10 w-12 shrink-0 overflow-hidden rounded-lg bg-line/40">{item.image && <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}</div>
                      <div className="min-w-0"><div className="truncate text-sm font-semibold text-ink">{lang === "en" && item.name_en ? item.name_en : item.name}</div><div className="mt-0.5 flex items-center gap-1 text-[11px] text-inkSoft"><MapPin className="h-3 w-3" /> {item.location}</div></div>
                    </button>
                  ))}
                  <button type="submit" className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-toba hover:bg-cream"><Search className="h-4 w-4" /> {t.home.viewAllResults}</button>
                </div>
              )}
            </form>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/explore")}
                className="btn-primary w-full sm:w-auto"
                data-testid="hero-cta-explore"
              >
                {t.hero.cta} <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })
                }
                className="btn-onteal w-full sm:w-auto"
                data-testid="hero-cta-featured"
              >
                {t.hero.secondary}
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-cream/15 aspect-[4/3] lg:aspect-[5/4]">
            <img
              src="https://images.unsplash.com/photo-1592639298199-7b9d01c1cf29?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxsYWtlJTIwdG9iYSUyMGluZG9uZXNpYXxlbnwwfHx8fDE3ODY5Mzk0Njl8MA&ixlib=rb-4.1.0&q=75&w=1200"
              alt="Danau Toba"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* AI PLANNER STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-10">
        <div className="card-flat p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 text-toba">
              <Sparkles className="w-4 h-4" />
              <span className="text-[12px] tracking-[0.18em] uppercase font-semibold">
                {t.planner.tagline}
              </span>
            </div>
            <h2 className="font-display text-[22px] sm:text-2xl mt-1.5">{t.planner.title}</h2>
          </div>
          <Link to="/planner" className="btn-primary w-full sm:w-auto" data-testid="home-planner-cta">
            {t.planner.generate} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
        <h2 className="section-title mb-5">{t.home.categoriesTitle}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {CATEGORY_KEYS.map((cat) => {
            // Icon mapping
            const iconMap = {
              mountain: Mountain,
              lake: MapPin,
              waterfall: Droplet,
              viewpoint: Compass,
              nature: Leaf,
              camping: Tent,
              hotspring: Flame,
            };
            const Icon = iconMap[cat] || Compass;

            // Gradient mapping
            const gradientMap = {
              mountain: "from-green-700/20 to-emerald-600/10",
              lake: "from-cyan-700/20 to-blue-600/10",
              waterfall: "from-blue-600/20 to-cyan-500/10",
              viewpoint: "from-teal-700/20 to-cyan-600/10",
              nature: "from-emerald-700/20 to-green-600/10",
              camping: "from-amber-700/20 to-orange-600/10",
              hotspring: "from-red-600/20 to-orange-500/10",
            };
            const gradient = gradientMap[cat] || "from-toba/20 to-emerald-50/50";

            return (
              <Link
                key={cat}
                to={`/explore?category=${cat}`}
                className={`group relative p-5 rounded-2xl bg-gradient-to-br ${gradient} border border-line/30 hover:border-toba/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden`}
                data-testid={`category-card-${cat}`}
              >
                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-colors"></div>
                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 group-hover:bg-white/30 transition-colors">
                    <Icon className="w-6 h-6 text-toba" />
                  </div>
                  <div className="font-display text-base md:text-lg leading-tight text-ink group-hover:text-toba transition-colors">
                    {t.categories[cat]}
                  </div>
                  <div className="text-[12px] text-inkSoft mt-1 flex items-center gap-1 group-hover:text-ink transition-colors">
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />{" "}
                    {lang === "en" ? "Browse" : "Lihat"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </section>

      {/* TRENDING */}
      {trending.length > 0 && (
        <section
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16"
          data-testid="trending-section"
        >
          <div className="mb-5">
            <div className="flex items-center gap-2 text-toba text-[12px] tracking-[0.18em] uppercase font-semibold">
              <TrendingUp className="w-4 h-4" /> {t.trending.title}
            </div>
            <h2 className="section-title mt-1.5">{t.trending.subtitle}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {trending.map((d, i) => (
              <div key={d.id} className="relative" data-testid={`trending-item-${d.id}`}>
                <span className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-toba text-cream flex items-center justify-center font-display text-sm">
                  {i + 1}
                </span>
                <DestinationCard dest={d} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FEATURED */}
      <section id="featured" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="eyebrow">{lang === "en" ? "Editor's picks" : "Pilihan editor"}</div>
            <h2 className="section-title mt-1.5">{t.home.featured}</h2>
            <p className="text-[13px] sm:text-sm text-inkSoft mt-2 max-w-xl">{t.home.featuredSub}</p>
          </div>
          <Link to="/explore" className="btn-outline hidden sm:inline-flex" data-testid="see-all-link">
            {t.nav.destinations}
          </Link>
        </div>

        {loading ? (
          <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {featured.map((d, i) => (
              <DestinationCard key={d.id || `featured-${i}`} dest={d} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="relative mt-16 bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.06]">
          <UlosPattern />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-wrap items-center justify-between gap-3 text-[13px] text-cream/75">
          <div>
            <span className="font-display text-base text-cream">Explore Wisata Sumut</span> ·{" "}
            {lang === "en" ? "A tribute to North Sumatra" : "Bumi Sumatera Utara"}
          </div>
          <div>© {new Date().getFullYear()} — Horas!</div>
        </div>
      </footer>
    </div>
  );
}
