import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import { CATEGORY_KEYS } from "@/lib/i18n";
import { Search, SlidersHorizontal, X } from "lucide-react";

const BUDGET_STEPS = [50000, 100000, 250000, 500000, 1000000];

export default function Directory() {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const category = params.get("category") || "all";
  const search = params.get("search") || "";
  const maxPrice = params.get("max_price") || "";

  useEffect(() => {
    setLoading(true);
    const q = {};
    if (category !== "all") q.category = category;
    if (search) q.search = search;
    if (maxPrice) q.max_price = maxPrice;
    api
      .get("/destinations", { params: q })
      .then(({ data }) => setList(data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [category, search, maxPrice]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const reset = () => setParams(new URLSearchParams());

  const hasFilters = category !== "all" || !!search || !!maxPrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24">
      <header className="mb-10">
        <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2">
          — {t.nav.explore}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight">
          {t.directory.title}
        </h1>
      </header>

      {/* Filter bar */}
      <div className="neu-raised rounded-3xl p-4 sm:p-6 mb-10">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <label className="flex-1 flex items-center gap-3 rounded-2xl shadow-neu-inset px-5 py-3 bg-sand">
            <Search className="w-4 h-4 text-muted2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => update("search", e.target.value)}
              placeholder={t.directory.searchPlaceholder}
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted2"
              data-testid="search-input"
            />
          </label>

          <div className="flex items-center gap-3 shrink-0 rounded-2xl shadow-neu-inset px-4 py-2 bg-sand">
            <SlidersHorizontal className="w-4 h-4 text-muted2" />
            <select
              value={maxPrice}
              onChange={(e) => update("max_price", e.target.value)}
              className="bg-transparent outline-none text-sm py-1 pr-4"
              data-testid="budget-select"
            >
              <option value="">{t.directory.budget}</option>
              {BUDGET_STEPS.map((b) => (
                <option key={b} value={b}>
                  ≤ {t.common.currency}{" "}
                  {new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID").format(b)}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={reset}
              className="shrink-0 px-4 py-2 rounded-2xl shadow-neu-sm text-sm flex items-center gap-2 hover:text-sunset transition-colors"
              data-testid="reset-filters-btn"
            >
              <X className="w-4 h-4" /> {t.directory.reset}
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pt-5 -mx-1 px-1 pb-1">
          {["all", ...CATEGORY_KEYS].map((cat) => (
            <button
              key={cat}
              onClick={() => update("category", cat)}
              data-testid={`cat-filter-${cat}`}
              className={`px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-all duration-300 ${
                category === cat
                  ? "shadow-neu-pressed text-sunset font-semibold"
                  : "shadow-neu-sm hover:text-sunset"
              }`}
            >
              {t.categories[cat] || t.directory.all}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-24">
          <div className="font-display text-2xl mb-2">{t.directory.noResults}</div>
          <button
            onClick={reset}
            className="mt-4 px-6 py-3 rounded-full shadow-neu-raised hover:text-sunset text-sm font-semibold"
            data-testid="no-results-reset"
          >
            {t.directory.reset}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {list.map((d, i) => (
            <DestinationCard key={d.id} dest={d} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
