import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import PartnerCard from "../components/PartnerCard.jsx";
import { ChevronLeft, ChevronRight, Handshake, Plus } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";

const TYPES = ["guide", "rental", "homestay", "souvenir"];

export default function Partners() {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const urlPage = params.get("page");
  useEffect(() => {
    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p >= 1) setPage(p);
    }
  }, [urlPage]);

  const load = () => {
    setLoading(true);
    const params = { status: "approved" };
    if (type) params.type = type;
    params.page = page;
    params.per_page = 9;

    api
      .get("/partners", { params })
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

  useEffect(load, [type, page]);
  useEffect(() => {
    partners.forEach(partner => trackPartnerEvent("directory_impression", partner.id, "directory"));
  }, [partners]);

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
    setPage(nextPage);
  };

  return (
    <div data-testid="partners-page">
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16">
        <div className="scroll-x mb-6">
          <button
            type="button"
            onClick={() => { setType(""); goToPage(1); }}
            className={`chip ${type === "" ? "chip-active" : ""}`}
            data-testid="partner-filter-all"
          >
            {t.partners.typeFilter}
          </button>
          {TYPES.map((tp) => (
            <button
              type="button"
              key={tp}
              onClick={() => { setType(tp); goToPage(1); }}
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
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 flex justify-center">
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

      </div>

    </div>
  );
}
