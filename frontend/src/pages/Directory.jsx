import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import DestinationCard from "../components/DestinationCard.jsx";
import Seo from "../components/Seo.jsx";
import { CATEGORY_KEYS } from "../lib/i18n.js";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, MapPin, ArrowUpDown, RefreshCw } from "lucide-react";

const PAGE_SIZE = 12;

function positivePage(value) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function DirectorySkeleton({ label }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="card-flat overflow-hidden animate-pulse" data-testid="directory-skeleton">
          <div className="aspect-[4/3] bg-line/60" />
          <div className="p-4 space-y-3"><div className="h-5 bg-line/60 rounded w-2/3" /><div className="h-4 bg-line/50 rounded w-1/2" /><div className="h-10 bg-line/50 rounded" /></div>
        </div>
      ))}
    </div>
  );
}

export default function Directory() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || params.get("search") || "";
  const category = params.get("category") || "all";
  const location = params.get("location") || "";
  const sort = params.get("sort") || "updated";
  const page = positivePage(params.get("page"));
  const [searchDraft, setSearchDraft] = useState(query);
  const [result, setResult] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const update = (key, value, resetPage = true) => {
    const next = new URLSearchParams(params);
    next.delete("search");
    if (!value || value === "all" || (key === "sort" && value === "updated")) next.delete(key);
    else next.set(key, String(value));
    if (resetPage) next.delete("page");
    setParams(next);
  };

  useEffect(() => setSearchDraft(query), [query]);

  useEffect(() => {
    if (searchDraft === query) return undefined;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      next.delete("search");
      next.delete("page");
      if (searchDraft.trim()) next.set("q", searchDraft.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, searchDraft, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/destinations/locations", { signal: controller.signal })
      .then(({ data }) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      api.get("/destinations/search", {
        signal: controller.signal,
        params: {
          q: query || undefined,
          category: category === "all" ? undefined : category,
          location: location || undefined,
          sort,
          page,
          page_size: PAGE_SIZE,
        },
      }).then(({ data }) => {
        setResult(data);
        if (page > data.pages) {
          const next = new URLSearchParams(window.location.search);
          if (data.pages > 1) next.set("page", String(data.pages));
          else next.delete("page");
          setParams(next, { replace: true });
        }
      }).catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED" && requestError.name !== "CanceledError") setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, location, page, query, retryKey, setParams, sort]);

  const reset = () => {
    setSearchDraft("");
    setParams(new URLSearchParams());
  };
  const hasFilters = Boolean(query || category !== "all" || location || sort !== "updated");
  const pageNumbers = useMemo(() => Array.from({ length: result.pages }, (_, index) => index + 1)
    .filter((number) => number >= Math.max(1, page - 2) && number <= Math.min(result.pages, page + 2)), [page, result.pages]);

  return (
    <div data-testid="directory-page" className="min-w-0 overflow-x-clip">
      <Seo title={t.directory.title} description={t.directory.seoDescription} path={`/explore${window.location.search}`} />
      <header className="bg-toba overflow-x-clip">
        <div className="app-gutter mx-auto max-w-7xl py-7 sm:py-12">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70">{t.nav.destinations}</div>
          <h1 className="mt-2 font-display text-[26px] sm:text-4xl lg:text-5xl leading-tight text-cream">{t.directory.title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-cream/75">{t.directory.subtitle}</p>
        </div>
      </header>

      <div className="app-gutter mx-auto mt-5 max-w-7xl min-w-0 sm:mt-6 md:pb-16">
        <div className="card-flat p-4 mb-6 space-y-3">
          <label className="flex min-w-0 items-center gap-3 input-flat">
            <Search className="w-4 h-4 text-inkSoft shrink-0" />
            <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t.directory.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" data-testid="search-input" />
          </label>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="flex min-w-0 items-center gap-3 input-flat">
              <MapPin className="w-4 h-4 text-inkSoft shrink-0" />
              <select value={location} onChange={(event) => update("location", event.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" data-testid="location-select">
                <option value="">{t.directory.allLocations}</option>
                {locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-3 input-flat">
              <ArrowUpDown className="w-4 h-4 text-inkSoft shrink-0" />
              <select value={sort} onChange={(event) => update("sort", event.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" data-testid="sort-select">
                <option value="updated">{t.directory.sortUpdated}</option>
                <option value="name">{t.directory.sortNameAsc}</option>
                <option value="-name">{t.directory.sortNameDesc}</option>
                <option value="location">{t.directory.sortLocation}</option>
              </select>
            </label>
            {hasFilters && <button onClick={reset} className="btn-outline shrink-0" data-testid="reset-filters-btn"><X className="w-4 h-4" /> {t.directory.reset}</button>}
          </div>

          <div className="scroll-x pt-1" aria-label={t.directory.category}>
            {["all", ...CATEGORY_KEYS].map((item) => (
              <button key={item} onClick={() => update("category", item)} data-testid={`cat-filter-${item}`} className={`chip ${category === item ? "chip-active" : ""}`}>
                {t.categories[item] || t.directory.all}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-inkSoft" aria-live="polite">{loading ? t.common.loading : t.directory.resultCount.replace("{count}", result.total)}</p>
          <SlidersHorizontal className="w-4 h-4 text-inkSoft" aria-hidden="true" />
        </div>

        {loading ? <DirectorySkeleton label={t.common.loading} /> : error ? (
          <div className="card-flat text-center py-16 px-4" role="alert" data-testid="directory-error">
            <div className="font-display text-[22px] mb-2">{t.directory.loadError}</div>
            <p className="text-sm text-inkSoft mb-5">{t.directory.loadErrorHint}</p>
            <button onClick={() => setRetryKey((value) => value + 1)} className="btn-primary"><RefreshCw className="w-4 h-4" /> {t.common.retry}</button>
          </div>
        ) : result.items.length === 0 ? (
          <div className="card-flat text-center py-16 px-4">
            <div className="font-display text-[22px] mb-4">{t.directory.noResults}</div>
            <button onClick={reset} className="btn-outline" data-testid="no-results-reset">{t.directory.reset}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {result.items.map((destination) => <DestinationCard key={destination.id} dest={destination} />)}
          </div>
        )}

        {!loading && !error && result.pages > 1 && (
          <nav className="flex justify-center items-center gap-1 mt-8 mb-16" aria-label={t.directory.pagination}>
            <button onClick={() => update("page", Math.max(1, page - 1), false)} disabled={page <= 1} className={`p-2 rounded-lg ${page <= 1 ? "text-inkSoft/50 cursor-not-allowed" : "text-inkSoft hover:bg-line/40"}`} aria-label={t.common.previousPage}><ChevronLeft className="w-4 h-4" /></button>
            {pageNumbers.map((number) => <button key={number} onClick={() => update("page", number, false)} aria-current={page === number ? "page" : undefined} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${page === number ? "bg-toba text-cream" : "text-inkSoft hover:bg-line/40"}`}>{number}</button>)}
            <button onClick={() => update("page", Math.min(result.pages, page + 1), false)} disabled={page >= result.pages} className={`p-2 rounded-lg ${page >= result.pages ? "text-inkSoft/50 cursor-not-allowed" : "text-inkSoft hover:bg-line/40"}`} aria-label={t.common.nextPage}><ChevronRight className="w-4 h-4" /></button>
          </nav>
        )}
      </div>
    </div>
  );
}
