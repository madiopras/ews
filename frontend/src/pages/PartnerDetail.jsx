import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Crown, MapPin, MessageCircle, PackageOpen } from "lucide-react";
import { api } from "../lib/api.js";
import { API } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";
import Seo from "../components/Seo.jsx";
import ReportContentButton from "../components/ReportContentButton.jsx";

function assetUrl(value) {
  if (!value || /^https?:\/\//.test(value)) return value;
  if (value.startsWith("/api/")) return `${API.replace(/\/api$/, "")}${value}`;
  return value;
}

export default function PartnerDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const [partner, setPartner] = useState(null);
  const [state, setState] = useState("loading");
  const adminPreview = new URLSearchParams(window.location.search).get("preview") === "admin";
  useEffect(() => {
    setState("loading");
    api.get(adminPreview ? `/admin/governance/preview/partners/${id}` : `/partners/${id}/public`).then(({ data }) => { setPartner(data); setState("ready"); }).catch(() => setState("error"));
  }, [id, adminPreview]);
  useEffect(() => { if (partner?.id && !adminPreview) trackPartnerEvent("profile_view", partner.id, "partner_detail"); }, [partner?.id, adminPreview]);
  const copy = useMemo(() => lang === "en" ? {
    back: "Back to partners", notFound: "This partner profile is unavailable.", services: "Services & products",
    coverage: "Service destinations", verified: "Approved local partner", updated: "Information reviewed",
    contact: "Contact on WhatsApp", unavailable: "This partner is temporarily not accepting contacts.",
    featured: "Paid featured partner", availability: "Availability", tags: "Suitable for",
  } : {
    back: "Kembali ke daftar Mitra", notFound: "Profil Mitra ini tidak tersedia.", services: "Jasa & produk",
    coverage: "Destinasi layanan", verified: "Mitra lokal terverifikasi", updated: "Informasi ditinjau",
    contact: "Hubungi lewat WhatsApp", unavailable: "Mitra ini sementara tidak menerima kontak.",
    featured: "Mitra Unggulan berbayar", availability: "Ketersediaan", tags: "Cocok untuk",
  }, [lang]);
  if (state === "loading") return <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-inkSoft">{t.common.loading}</div>;
  if (state === "error" || !partner) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><p>{copy.notFound}</p><Link to="/partners" className="btn-outline mt-5">{copy.back}</Link></div>;
  const waUrl = partner.whatsapp ? `https://wa.me/${partner.whatsapp}?text=${encodeURIComponent(`Halo ${partner.business_name}, saya menemukan profil Anda di Explore Sumut.`)}` : null;
  return <div className="mx-auto max-w-6xl px-4 sm:px-6 py-7 sm:py-10" data-testid="partner-public-detail">
    <Seo title={partner.business_name} description={partner.description} path={`/partners/${partner.id}`} />
    {adminPreview && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950">Admin preview · {lang.toUpperCase()}</div>}
    <Link to="/partners" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-toba"><ArrowLeft className="h-4 w-4" />{copy.back}</Link>
    <header className="card-flat mt-3 overflow-hidden">
      {partner.gallery?.length > 0 && <div className="grid h-56 grid-cols-3 gap-1 bg-line sm:h-80">{partner.gallery.slice(0, 3).map((image, index) => <img key={image.id} src={assetUrl(image.url)} alt={`${partner.business_name} ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" className={`${index === 0 ? "col-span-2 row-span-2" : ""} h-full w-full object-cover`} />)}</div>}
      <div className="p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="badge-moss">{t.partners.types[partner.type]}</span>{partner.is_premium && <span className="inline-flex items-center gap-1 rounded-full bg-toba px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cream"><Crown className="h-3 w-3" />{copy.featured}</span>}</div><h1 className="mt-3 font-display text-3xl sm:text-4xl">{partner.business_name}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-inkSoft"><MapPin className="h-4 w-4" />{partner.city}</p></div><div className="shrink-0">{waUrl && partner.accepting_contacts ? <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackPartnerEvent("whatsapp_click", partner.id, "partner_detail")} className="btn-primary"><MessageCircle className="h-4 w-4" />{copy.contact}</a> : <div className="max-w-xs rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{copy.unavailable}</div>}</div></div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4 text-xs text-inkSoft"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-700" />{copy.verified}</span>{partner.last_profile_reviewed_at && <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{copy.updated}: {new Date(partner.last_profile_reviewed_at).toLocaleDateString(lang === "en" ? "en-US" : "id-ID")}</span>}{!adminPreview && <ReportContentButton targetType="partner" targetId={partner.id} compact />}</div>
      </div>
    </header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><section className="card-flat p-5 sm:p-6"><p className="whitespace-pre-line text-sm leading-7 text-inkSoft">{partner.description}</p>{partner.service_tags?.length > 0 && <div className="mt-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-inkSoft">{copy.tags}</h2><div className="mt-2 flex flex-wrap gap-2">{partner.service_tags.map(tag => <span key={tag} className="chip">{tag}</span>)}</div></div>}</section><aside className="card-flat p-5 sm:p-6"><h2 className="font-display text-xl">{copy.coverage}</h2><div className="mt-3 space-y-2">{partner.destinations.map(destination => <Link key={destination.id} to={`/destination/${destination.id}`} className="block rounded-lg border border-line p-3 text-sm hover:border-toba"><strong>{lang === "en" && destination.name_en ? destination.name_en : destination.name}</strong><span className="mt-0.5 block text-xs text-inkSoft">{destination.location}</span></Link>)}</div></aside></div>
    <section className="mt-6"><div className="mb-3 flex items-center gap-2"><PackageOpen className="h-5 w-5 text-toba" /><h2 className="font-display text-2xl">{copy.services}</h2></div>{partner.offerings.length === 0 ? <div className="card-flat p-5 text-sm text-inkSoft">—</div> : <div className="grid gap-4 md:grid-cols-2">{partner.offerings.map(offering => <article key={offering.id} className="card-flat p-5"><span className="text-[10px] font-semibold uppercase tracking-widest text-toba">{offering.kind === "product" ? "Produk" : "Jasa"}</span><h3 className="mt-1 font-display text-xl">{offering.name}</h3>{offering.description && <p className="mt-2 text-sm leading-relaxed text-inkSoft">{offering.description}</p>}{offering.ai_tags?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{offering.ai_tags.map(tag => <span key={tag} className="chip min-h-0 px-2 py-1 text-[10px]">{tag}</span>)}</div>}{offering.availability_note && <p className="mt-3 text-xs text-inkSoft"><strong>{copy.availability}:</strong> {offering.availability_note}</p>}</article>)}</div>}</section>
  </div>;
}
