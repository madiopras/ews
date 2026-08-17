import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import PartnerCard from "@/components/PartnerCard";

export default function DestinationPartners({ destinationId }) {
  const { t } = useLang();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/partners", { params: { destination_id: destinationId, status: "approved" } })
      .then(({ data }) => setPartners(data))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  }, [destinationId]);

  if (loading) return null;

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
      {partners.length === 0 ? (
        <div className="text-[13px] text-inkSoft py-6" data-testid="destination-partners-empty">
          {t.partners.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} />
          ))}
        </div>
      )}
    </section>
  );
}
