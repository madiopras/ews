import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import PartnerCard from "../components/PartnerCard.jsx";
import AffiliateBookingSection from "../components/AffiliateBookingSection.jsx";
import { ALL_PARTNER_TYPES } from "../components/PartnerTypeFields.jsx";
import { ChevronLeft, ChevronRight, Handshake, MapPin, Plus, Search } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import Seo from "../components/Seo.jsx";

const TYPES = ALL_PARTNER_TYPES;

export default function Partners() {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [partners, setPartners] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const urlType = TYPES.includes(params.get("type")) ? params.get("type") : "";
  const urlQuery = params.get("q") || "";
  const urlCity = params.get("city") || "";
  const [type, setType] = useState(urlType);
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [queryText, setQueryText] = useState(urlQuery);
  const [city, setCity] = useState(urlCity);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const urlPage = params.get("page");
  useEffect(() => {
    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p >= 1) setPage(p);
    }
  }, [urlPage]);

  useEffect(() => {
    setType(urlType);
  }, [urlType]);

  useEffect(() => {
    api.get("/partners/cities").then(({ data }) => {
      if (Array.isArray(data)) setCities(data);
    }).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const reqParams = { status: "approved" };
    if (type) reqParams.type = type;
    if (queryText.trim()) reqParams.q = queryText.trim();
    if (city.trim()) reqParams.city = city.trim();
    reqParams.page = page;
    reqParams.per_page = 9;

    api
      .get("/partners", { params: reqParams })
      .then(({ data }) => {
        if (data && Array.isArray(data.data) && data.pagination) {
          setPartners(data.data);
          setTotalPages(data.pagination.pages || 1);
        } else if (Array.isArray(data)) {
          const start = (page - 1) * 9;
          setPartners(data.slice(start, start + 9));
          setTotalPages(Math.max(1, Math.ceil(data.length / 9)));
        } else {
          setPartners([]);
          setTotalPages(1);
        }
      })
      .catch(() => {
        setPartners([]);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [type, queryText, city, page]);
  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
    setPage(nextPage);
  };
  const selectType = (nextType) => {
    const next = new URLSearchParams(params);
    if (nextType) next.set("type", nextType);
    else next.delete("type");
    next.delete("page");
    setParams(next);
    setType(nextType);
    setPage(1);
  };
  const applySearch = (event) => {
    event.preventDefault();
    const cleaned = searchInput.trim();
    const next = new URLSearchParams(params);
    if (cleaned) next.set("q", cleaned);
    else next.delete("q");
    next.delete("page");
    setParams(next);
    setQueryText(cleaned);
    setPage(1);
  };
  const selectCity = (nextCity) => {
    const next = new URLSearchParams(params);
    if (nextCity) next.set("city", nextCity);
    else next.delete("city");
    next.delete("page");
    setParams(next);
    setCity(nextCity);
    setPage(1);
  };

  return (
    <div data-testid="partners-page">
      <Seo title={t.partners.title} description={t.partners.subtitle} path="/partners" />
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="app-gutter relative mx-auto max-w-7xl py-7 sm:py-12">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70 flex items-center gap-2">
            <Handshake className="w-4 h-4" /> {t.nav.partners}
          </div>
          <h1 className="mt-3 font-display text-[26px] sm:text-4xl lg:text-5xl leading-tight text-cream">
            {t.partners.title}
          </h1>
          <p className="mt-3 text-[14px] sm:text-base text-cream/80 max-w-2xl leading-relaxed">
            {t.partners.subtitle}
          </p>
          <Link
            to="/partners/register"
            className="btn-primary mt-6 w-full sm:w-auto"
            data-testid="partners-register-cta"
          >
            <Plus className="w-4 h-4" /> {t.partners.register}
          </Link>
        </div>
      </header>

      <div className="app-gutter mx-auto mt-5 max-w-7xl sm:mt-6 md:pb-16">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={applySearch} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-inkSoft" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (!event.target.value.trim() && queryText) {
                  setQueryText("");
                  const next = new URLSearchParams(params);
                  next.delete("q");
                  next.delete("page");
                  setParams(next);
                  setPage(1);
                }
              }}
              placeholder={
                lang === "en"
                  ? "Search Hiace, villa, guide, Medan, Lake Toba..."
                  : "Cari Hiace, family room, rental KNO, homestay Toba..."
              }
              className="input-flat pl-10"
              data-testid="partner-search-input"
            />
          </form>
          {cities.length > 0 && (
            <label className="relative flex items-center sm:w-56">
              <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-inkSoft" />
              <select
                value={city}
                onChange={(event) => selectCity(event.target.value)}
                className="input-flat pl-9"
                aria-label={lang === "en" ? "Filter by city" : "Filter kota"}
                data-testid="partner-city-filter"
              >
                <option value="">{lang === "en" ? "All cities / regencies" : "Semua kota / kabupaten"}</option>
                {cities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="scroll-x mb-6">
          <button
            type="button"
            onClick={() => selectType("")}
            className={`chip ${type === "" ? "chip-active" : ""}`}
            data-testid="partner-filter-all"
          >
            {t.partners.typeFilter}
          </button>
          {TYPES.map((tp) => (
            <button
              type="button"
              key={tp}
              onClick={() => selectType(tp)}
              className={`chip ${type === tp ? "chip-active" : ""}`}
              data-testid={`partner-filter-${tp}`}
            >
              {t.partners.types[tp]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
        ) : partners.length === 0 ? (
          <div className="card-flat text-center py-16 px-4">
            <div className="font-display text-[22px] mb-4">{t.partners.empty}</div>
            <Link to="/partners/register" className="btn-primary">
              {t.partners.register}
            </Link>
          </div>
        ) : <section><p className="mb-4 text-[12px] text-inkSoft">{lang === "en" ? "Featured listings are paid and labelled. All listings rotate so regular partners remain discoverable." : "Listing Unggulan berbayar selalu diberi label. Semua listing dirotasi agar Mitra reguler tetap mudah ditemukan."}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{partners.map((partner) => <PartnerCard key={partner.id} partner={partner} source="directory" />)}</div></section>}

       {totalPages > 1 && (
         <div className="app-gutter mx-auto mb-4 flex max-w-7xl justify-center md:mb-16">
           <div className="flex items-center gap-1">
             <button
               type="button"
               onClick={() => goToPage(Math.max(1, page - 1))}
               disabled={page <= 1}
               className={`p-2 rounded-lg ${page <= 1 ? "text-inkSoft/50 cursor-not-allowed" : "text-inkSoft hover:bg-line/40"}`}
               aria-label={t.common.previousPage}
             >
               <ChevronLeft className="w-4 h-4" />
             </button>
             {Array.from({ length: totalPages }, (_, i) => i + 1)
               .filter((n) => {
                 const start = Math.max(1, page - 2);
                 const end = Math.min(totalPages, page + 2);
                 return n >= start && n <= end;
               })
               .map((n) => (
                 <button
                   type="button"
                   key={n}
                   onClick={() => goToPage(n)}
                   className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                     page === n ? "bg-toba text-cream" : "text-inkSoft hover:bg-line/40"
                   }`}
                 >
                   {n}
                 </button>
               ))}
             <button
               type="button"
               onClick={() => goToPage(Math.min(totalPages, page + 1))}
               disabled={page >= totalPages}
               className={`p-2 rounded-lg ${page >= totalPages ? "text-inkSoft/50 cursor-not-allowed" : "text-inkSoft hover:bg-line/40"}`}
               aria-label={t.common.nextPage}
             >
               <ChevronRight className="w-4 h-4" />
             </button>
           </div>
         </div>
       )}

        <AffiliateBookingSection
          source="partners"
          variant="strip"
          heading={lang === "en" ? "Need instant flights or hotels?" : "Butuh tiket pesawat atau hotel instan?"}
          subheading={
            lang === "en"
              ? "Compare flights and hotel availability via tiket.com while booking local car rentals, guides, and homestays directly with North Sumatra partners above."
              : "Cek penerbangan dan hotel instan via tiket.com untuk melengkapi rental mobil, pemandu, dan homestay dari Mitra Lokal Sumut di atas."
          }
        />

      </div>

    </div>
  );
}
