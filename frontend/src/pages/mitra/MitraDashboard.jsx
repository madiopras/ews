import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CircleGauge, Plus, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useLang } from "../../contexts/LanguageContext.jsx";
import Seo from "../../components/Seo.jsx";

export function MitraStatusBadge({ status, t }) {
  const style = { approved: "bg-emerald-100 text-emerald-800", pending: "bg-amber-100 text-amber-900", needs_revision: "bg-orange-100 text-orange-900", rejected: "bg-red-100 text-red-800", draft: "bg-line/60 text-inkSoft" }[status] || "bg-line/60 text-inkSoft";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>{t.mitra.statuses[status] || status}</span>;
}

export default function MitraDashboard() {
  const { t, lang } = useLang();
  const [partners, setPartners] = useState([]);
  const [state, setState] = useState("loading");
  const load = useCallback(() => {
    setState("loading");
    api.get("/mitra/partners").then(({ data }) => { setPartners(data); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="max-w-6xl px-4 sm:px-6 py-7 sm:py-10" data-testid="mitra-dashboard">
      <Seo title={t.mitra.dashboard} description={t.mitra.dashboardSubtitle} path="/mitra" noIndex />
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"><div><div className="eyebrow">{t.mitra.workspace}</div><h1 className="font-display text-[30px] sm:text-[38px] mt-1">{t.mitra.dashboard}</h1><p className="text-[14px] text-inkSoft mt-1">{t.mitra.dashboardSubtitle}</p></div><Link to="/mitra/onboarding" className="btn-primary"><Plus className="w-4 h-4" /> {t.mitra.addBusiness}</Link></header>
      {state === "loading" ? <div className="py-16 text-[13px] text-inkSoft">{t.common.loading}</div> : state === "error" ? <div className="card-flat p-6 text-center"><p className="text-red-700">{t.mitra.loadError}</p><button type="button" onClick={load} className="btn-outline mt-4"><RefreshCw className="w-4 h-4" /> {t.common.retry}</button></div> : partners.length === 0 ? (
        <div className="card-flat py-14 px-5 text-center"><BriefcaseBusiness className="w-10 h-10 text-inkSoft/50 mx-auto" /><h2 className="font-display text-[23px] mt-4">{t.mitra.emptyTitle}</h2><p className="text-[13px] text-inkSoft mt-2 max-w-md mx-auto">{t.mitra.emptyDescription}</p><Link to="/mitra/onboarding" className="btn-primary mt-5">{t.mitra.startOnboarding}</Link></div>
      ) : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{partners.map((partner) => (
        <article key={partner.id} className="card-flat p-5 flex flex-col" data-testid={`mitra-partner-${partner.id}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11px] text-inkSoft">{t.partners.types[partner.type]}</div><h2 className="font-display text-[22px] truncate mt-1">{partner.business_name || t.mitra.unnamedDraft}</h2></div><MitraStatusBadge status={partner.status} t={t} /></div>
          <div className="grid grid-cols-2 gap-3 mt-5 text-[12px]"><div className="rounded-lg bg-cream p-3"><UsersRound className="w-4 h-4 text-toba mb-2" /><div className="text-inkSoft">{t.mitra.access}</div><strong>{t.mitra.roles[partner.membership_role] || partner.membership_role}</strong></div><div className="rounded-lg bg-cream p-3"><ShieldCheck className="w-4 h-4 text-toba mb-2" /><div className="text-inkSoft">{t.mitra.documents}</div><strong>{partner.verification_documents?.length || 0}</strong></div></div>
          {partner.status === "approved" && <div className="mt-3 rounded-lg border border-line p-3"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-inkSoft"><CircleGauge className="h-4 w-4 text-toba" />{lang === "en" ? "Profile completeness" : "Kelengkapan profil"}</span><strong>{partner.profile_completeness}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full bg-toba" style={{ width: `${partner.profile_completeness}%` }} /></div></div>}
          {partner.review_due_at && partner.status === "pending" && <p className="mt-4 flex items-center gap-2 text-[12px] text-inkSoft"><CalendarClock className="w-4 h-4" /> {t.mitra.reviewTarget} {new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", { dateStyle: "medium" }).format(new Date(partner.review_due_at))}</p>}
          {partner.revision_note && <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-[12px] text-orange-950"><strong>{t.mitra.revisionNote}:</strong> {partner.revision_note}</div>}
          <Link to={partner.status === "approved" ? `/mitra/business/${partner.id}` : `/mitra/onboarding/${partner.id}`} className="mt-5 inline-flex items-center justify-between min-h-[44px] border-t border-line pt-4 text-[13px] font-semibold text-toba">{partner.status === "approved" ? (lang === "en" ? "Manage business" : "Kelola usaha") : (["draft", "needs_revision", "rejected"].includes(partner.status) ? t.mitra.continueOnboarding : t.mitra.viewStatus)}<ArrowRight className="w-4 h-4" /></Link>
        </article>
      ))}</div>}
    </div>
  );
}
