import React, { useEffect, useState } from "react";
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
    <section className="mt-16" data-testid="destination-partners-section">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <h2 className="font-display text-3xl sm:text-4xl">{t.partners.onDestPage}</h2>
        <a
          href="/partners/register"
          className="text-xs uppercase tracking-widest text-sunset hover:underline"
          data-testid="become-partner-link"
        >
          {t.partners.register} →
        </a>
      </div>
      {partners.length === 0 ? (
        <div className="text-sm text-muted2 py-8" data-testid="destination-partners-empty">
          {t.partners.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} />
          ))}
        </div>
      )}
    </section>
  );
}
