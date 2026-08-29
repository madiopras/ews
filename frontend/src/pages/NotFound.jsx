import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home, Search } from "lucide-react";
import { useLang } from "../contexts/LanguageContext.jsx";
import Seo from "../components/Seo.jsx";

export default function NotFound() {
  const { t } = useLang();
  return (
    <main className="app-gutter mx-auto flex min-h-[65vh] max-w-2xl items-center py-10 sm:py-12" data-testid="not-found-page">
      <Seo title={t.notFound.title} description={t.notFound.description} noIndex />
      <div className="card-flat w-full p-7 text-center sm:p-10">
        <Compass className="mx-auto h-12 w-12 text-toba" />
        <p className="mt-4 eyebrow">404</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{t.notFound.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-inkSoft">{t.notFound.description}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/explore" className="btn-primary"><Search className="h-4 w-4" /> {t.notFound.explore}</Link>
          <Link to="/" className="btn-outline"><Home className="h-4 w-4" /> {t.common.backHome}</Link>
        </div>
      </div>
    </main>
  );
}
