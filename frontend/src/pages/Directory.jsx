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
    <div data-testid="directory-page">
      <header className="bg-toba">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70">
            {t.nav.destinations}
          </div>
          <h1 className="mt-2 font-display text-[26px] sm:text-4xl lg:text-5xl leading-tight text-cream">
            {t.directory.title}
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16">
        {/* Filters — single column on mobile */}
        <div className="card-flat p-4 mb-6 space-y-3">
          <label className="flex items-center gap-3 input-flat">
            <Search className="w-4 h-4 text-inkSoft shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => update("search", e.target.value)}
              placeholder={t.directory.searchPlaceholder}
              className="bg-transparent outline-none flex-1 text-[15px]"
              data-testid="search-input"
            />
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-3 input-flat flex-1">
              <SlidersHorizontal className="w-4 h-4 text-inkSoft shrink-0" />
              <select
                value={maxPrice}
                onChange={(e) => update("max_price", e.target.value)}
                className="bg-transparent outline-none flex-1 text-[15px]"
                data-testid="budget-select"
              >
                <option value="">{t.directory.budget}</option>
                {BUDGET_STEPS.map((b) => (
                  <option key={b} value={b}>
                    {`≤ ${t.common.currency} ${new Intl.NumberFormat(
                      lang === "en" ? "en-US" : "id-ID"
                    ).format(b)}`}
                  </option>
                ))}
              </select>
            </label>

            {hasFilters && (
              <button onClick={reset} className="btn-outline shrink-0" data-testid="reset-filters-btn">
                <X className="w-4 h-4" /> {t.directory.reset}
              </button>
            )}
          </div>

          {/* Category chips — horizontal scroll */}
          <div className="scroll-x pt-1">
            {["all", ...CATEGORY_KEYS].map((cat) => (
              <button
                key={cat}
                onClick={() => update("category", cat)}
                data-testid={`cat-filter-${cat}`}
                className={`chip ${category === cat ? "chip-active" : ""}`}
              >
                {t.categories[cat] || t.directory.all}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
        ) : list.length === 0 ? (
          <div className="card-flat text-center py-16 px-4">
            <div className="font-display text-[22px] mb-4">{t.directory.noResults}</div>
            <button onClick={reset} className="btn-outline" data-testid="no-results-reset">
              {t.directory.reset}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {list.map((d, i) => (
              <DestinationCard key={d.id} dest={d} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
