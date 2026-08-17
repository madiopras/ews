import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import { Heart } from "lucide-react";

export default function Wishlist() {
  const { t } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/wishlist")
      .then(({ data }) => setList(data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24" data-testid="wishlist-page">
      <header className="mb-10 flex items-start gap-4">
        <span className="w-14 h-14 rounded-full shadow-neu-raised flex items-center justify-center text-sunset">
          <Heart className="w-6 h-6 fill-current" />
        </span>
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-1">
            {t.nav.wishlist}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight">
            {t.wishlist.title}
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 neu-raised rounded-3xl">
          <div className="font-display text-2xl mb-4">{t.wishlist.empty}</div>
          <Link
            to="/explore"
            className="inline-block px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90"
            data-testid="wishlist-browse-btn"
          >
            {t.wishlist.browse}
          </Link>
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
