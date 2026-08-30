import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import PartnerCard from "../components/PartnerCard.jsx";

export default function DestinationPartners({ destinationId }) {
  const { t } = useLang();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api
      .get("/partners", { params: { destination_id: destinationId, status: "approved" } })
      .then(({ data }) => {
        if (data && Array.isArray(data.data)) {
          setPartners(data.data);
        } else {
          setPartners(data || []);
        }
      })
      .catch(() => {
        setPartners([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [destinationId, retryKey]);

  const groups = ["guide", "rental", "homestay", "culinary", "souvenir"]
    .map((type) => ({ type, items: partners.filter((partner) => partner.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="mt-12 sm:mt-16" data-testid="destination-partners-section">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <h2 className="section-title">{t.partners.onDestPage}</h2>
        <Link
          to="/partners/register"
          className="text-[13px] font-semibold text-toba underline underline-offset-4"
          data-testid="become-partner-link"
        >
          {t.partners.register} →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="card-flat h-40 animate-pulse bg-line/30" /><div className="card-flat h-40 animate-pulse bg-line/30" /></div>
      ) : error ? (
        <div className="card-flat p-5 text-center text-sm text-inkSoft" role="alert">{t.partners.loadError}<button type="button" onClick={() => setRetryKey((value) => value + 1)} className="btn-outline mx-auto mt-3">{t.common.retry}</button></div>
      ) : partners.length === 0 ? (
        <div className="text-[13px] text-inkSoft py-6" data-testid="destination-partners-empty">
          {t.partners.empty}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => <section key={group.type} aria-labelledby={`partner-group-${group.type}`}><h3 id={`partner-group-${group.type}`} className="mb-3 font-display text-xl text-ink">{t.partners.types[group.type]}</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{group.items.map((partner) => <PartnerCard key={partner.id} partner={partner} source="destination" destinationId={destinationId} />)}</div></section>)}
        </div>
      )}
    </section>
  );
}
