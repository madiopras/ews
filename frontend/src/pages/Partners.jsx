import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import PartnerCard from "@/components/PartnerCard";
import { toast } from "sonner";
import { Handshake, Plus } from "lucide-react";
import UlosPattern from "@/components/UlosPattern";

const TYPES = ["guide", "rental", "homestay"];

export default function Partners() {
  const { t } = useLang();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = { status: "approved" };
    if (type) params.type = type;
    api
      .get("/partners", { params })
      .then(({ data }) => setPartners(data))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24" data-testid="partners-page">
      <header className="relative rounded-3xl overflow-hidden neu-raised p-8 sm:p-12 mb-10">
        <div className="absolute inset-0 text-jungle/[0.055]">
          <UlosPattern />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2 flex items-center gap-2">
              <Handshake className="w-4 h-4" /> {t.nav.partners}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight max-w-3xl">
              {t.partners.title}
            </h1>
            <p className="mt-4 text-muted2 max-w-2xl">{t.partners.subtitle}</p>
          </div>
          <Link
            to="/partners/register"
            className="px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90 flex items-center gap-2 shrink-0"
            data-testid="partners-register-cta"
          >
            <Plus className="w-4 h-4" /> {t.partners.register}
          </Link>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-8">
        <button
          onClick={() => setType("")}
          className={`px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-all ${
            type === "" ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
          }`}
          data-testid="partner-filter-all"
        >
          {t.partners.typeFilter}
        </button>
        {TYPES.map((tp) => (
          <button
            key={tp}
            onClick={() => setType(tp)}
            className={`px-5 py-2.5 rounded-full text-sm whitespace-nowrap transition-all ${
              type === tp ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
            }`}
            data-testid={`partner-filter-${tp}`}
          >
            {t.partners.types[tp]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20 neu-raised rounded-3xl">
          <div className="font-display text-2xl mb-4">{t.partners.empty}</div>
          <Link
            to="/partners/register"
            className="inline-block px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90"
          >
            {t.partners.register}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} />
          ))}
        </div>
      )}
    </div>
  );
}
