import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import { ArrowRight, Compass, Search, Sparkles } from "lucide-react";
import { CATEGORY_KEYS } from "@/lib/i18n";
import UlosPattern from "@/components/UlosPattern";

export default function Home() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/destinations", { params: { featured: true } })
      .then(({ data }) => setFeatured(data))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-24">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="relative rounded-[2.5rem] overflow-hidden neu-raised p-3">
          <div className="relative rounded-[2rem] overflow-hidden aspect-[16/9] sm:aspect-[16/8]">
            <img
              src="https://images.unsplash.com/photo-1592639298199-7b9d01c1cf29?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxsYWtlJTIwdG9iYSUyMGluZG9uZXNpYXxlbnwwfHx8fDE3ODY5Mzk0Njl8MA&ixlib=rb-4.1.0&q=85"
              alt="Lake Toba"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 lg:p-16">
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm tracking-[0.2em] uppercase text-sand/90 mb-4">
                <Compass className="w-4 h-4" /> {t.hero.tagline}
              </span>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.02] text-sand max-w-4xl">
                {t.hero.title.split(" ").slice(0, -2).join(" ")}{" "}
                <span className="italic text-sunset">
                  {t.hero.title.split(" ").slice(-2).join(" ")}
                </span>
              </h1>
              <p className="mt-6 text-base sm:text-lg text-sand/85 max-w-2xl leading-relaxed">
                {t.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/explore")}
                  className="px-7 py-4 rounded-full bg-sunset text-sand font-semibold text-sm tracking-wide hover:bg-sunset/90 transition-colors flex items-center gap-2"
                  data-testid="hero-cta-explore"
                >
                  {t.hero.cta} <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById("featured")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="px-7 py-4 rounded-full bg-sand/15 backdrop-blur border border-sand/30 text-sand font-semibold text-sm tracking-wide hover:bg-sand/25 transition-colors"
                  data-testid="hero-cta-featured"
                >
                  {t.hero.secondary}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="absolute inset-0 text-jungle/[0.055] -z-0">
          <UlosPattern />
        </div>
        <div className="relative">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <h2 className="font-display text-3xl sm:text-4xl">
              {t.home.categoriesTitle}
            </h2>
            <Link
              to="/planner"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-sunset text-sand text-sm font-semibold hover:bg-sunset/90 transition-colors"
              data-testid="home-planner-cta"
            >
              <Sparkles className="w-4 h-4" /> {t.planner.title}
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {CATEGORY_KEYS.map((cat, i) => (
              <Link
                key={cat}
                to={`/explore?category=${cat}`}
                data-testid={`category-tile-${cat}`}
                className="group aspect-square rounded-3xl bg-sand p-5 shadow-neu-raised hover:shadow-neu-pressed transition-shadow duration-300 flex flex-col justify-between opacity-0 animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center text-sunset text-lg font-display">
                  {i + 1}
                </span>
                <div>
                  <div className="font-display text-xl sm:text-2xl leading-tight">
                    {t.categories[cat]}
                  </div>
                  <div className="text-xs text-muted2 mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3 h-3" /> {lang === "en" ? "Browse" : "Lihat"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section
        id="featured"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24"
      >
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2">
              — {lang === "en" ? "Editor's picks" : "Pilihan editor"}
            </div>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight max-w-2xl">
              {t.home.featured}
            </h2>
            <p className="text-muted2 mt-3 max-w-xl">{t.home.featuredSub}</p>
          </div>
          <Link
            to="/explore"
            className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-full shadow-neu-sm hover:text-sunset transition-all text-sm font-semibold"
            data-testid="see-all-link"
          >
            <Search className="w-4 h-4" /> {t.nav.explore}
          </Link>
        </div>

        {loading ? (
          <div className="text-muted2">{t.common.loading}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featured.map((d, i) => (
              <DestinationCard key={d.id} dest={d} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
        <div className="absolute inset-0 text-jungle/[0.06] -z-0 overflow-hidden">
          <UlosPattern />
        </div>
        <div className="relative border-t border-sandDark/60 pt-10 pb-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted2">
          <div>
            <span className="font-display text-lg text-ink">Explore Sumut</span>{" "}
            · {lang === "en" ? "A tribute to North Sumatra" : "Bumi Sumatera Utara"}
          </div>
          <div>© {new Date().getFullYear()} — Horas!</div>
        </div>
      </footer>
    </div>
  );
}
