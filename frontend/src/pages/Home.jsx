import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import { ArrowRight, Compass, Sparkles, TrendingUp } from "lucide-react";
import { CATEGORY_KEYS } from "@/lib/i18n";
import UlosPattern from "@/components/UlosPattern";

export default function Home() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/destinations", { params: { featured: true } }).then((r) => r.data).catch(() => []),
      api.get("/destinations/trending", { params: { days: 30, limit: 4 } }).then((r) => r.data).catch(() => []),
    ]).then(([f, tr]) => {
      setFeatured(f);
      setTrending(tr);
      setLoading(false);
    });
  }, []);

  return (
    <div className="pb-16">
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
        <div className="scroll-x md:grid md:grid-cols-5 md:gap-4 md:overflow-visible">
          {CATEGORY_KEYS.map((cat, i) => (
            <Link
              key={cat}
              to={`/explore?category=${cat}`}
              data-testid={`category-tile-${cat}`}
              className="card-link shrink-0 w-[150px] md:w-auto p-4 flex flex-col justify-between min-h-[112px]"
            >
              <span className="w-8 h-8 rounded-lg bg-cream border border-line flex items-center justify-center text-toba font-display text-base">
                {i + 1}
              </span>
              <div className="mt-3">
                <div className="font-display text-[18px] leading-tight">{t.categories[cat]}</div>
                <div className="text-[12px] text-inkSoft mt-1 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> {lang === "en" ? "Browse" : "Lihat"}
                </div>
              </div>
            </Link>
          ))}
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
              <DestinationCard key={d.id} dest={d} index={i} />
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
            <span className="font-display text-base text-cream">Explore Sumut</span> ·{" "}
            {lang === "en" ? "A tribute to North Sumatra" : "Bumi Sumatera Utara"}
          </div>
          <div>© {new Date().getFullYear()} — Horas!</div>
        </div>
      </footer>
    </div>
  );
}
