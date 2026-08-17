import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import PartnerCard from "@/components/PartnerCard";
import PremiumDialog from "@/components/PremiumDialog";
import { Handshake, Plus, Crown } from "lucide-react";
import UlosPattern from "@/components/UlosPattern";

const TYPES = ["guide", "rental", "homestay"];

export default function Partners() {
  const { t } = useLang();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [upgrading, setUpgrading] = useState(null);

  const load = () => {
    setLoading(true);
    const params = { status: "approved" };
    if (type) params.type = type;
    api
      .get("/partners", { params })
      .then(({ data }) => setPartners(data))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [type]);

  const premium = partners.filter((p) => p.is_premium);
  const regular = partners.filter((p) => !p.is_premium);

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
            onClick={() => setType("")}
            className={`chip ${type === "" ? "chip-active" : ""}`}
            data-testid="partner-filter-all"
          >
            {t.partners.typeFilter}
          </button>
          {TYPES.map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
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
        ) : (
          <div className="space-y-8">
            {premium.length > 0 && (
              <section data-testid="premium-partners-section">
                <div className="flex items-center gap-2 text-toba mb-3">
                  <Crown className="w-4 h-4" />
                  <span className="text-[12px] tracking-[0.18em] uppercase font-semibold">
                    {t.partners.premium.sectionTitle}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {premium.map((p) => (
                    <PartnerCard key={p.id} partner={p} />
                  ))}
                </div>
              </section>
            )}

            {regular.length > 0 && (
              <section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regular.map((p) => (
                    <PartnerCard key={p.id} partner={p} onUpgrade={setUpgrading} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {upgrading && (
        <PremiumDialog
          partner={upgrading}
          onClose={() => setUpgrading(null)}
          onActivated={() => {
            setUpgrading(null);
            load();
          }}
        />
      )}
    </div>
  );
}
