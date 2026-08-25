import React, { useEffect, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { useLang } from "../contexts/LanguageContext.jsx";
import { analyticsConsent, setAnalyticsConsent } from "../lib/partnerAnalytics.js";

export default function AnalyticsConsent() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!analyticsConsent()), []);
  if (!visible) return null;
  const copy = lang === "en" ? {
    title: "Help us improve partner recommendations",
    body: "With your permission, we count anonymous feature use, partner views, and contact clicks. We never store your IP address, AI trip story, or contact message.",
    allow: "Allow analytics", decline: "Not now", close: "Close",
  } : {
    title: "Bantu kami memperbaiki rekomendasi Mitra",
    body: "Dengan izin Anda, kami menghitung penggunaan fitur, tayangan Mitra, dan klik kontak secara anonim. Kami tidak menyimpan alamat IP, isi cerita AI, atau isi pesan Anda.",
    allow: "Izinkan analitik", decline: "Tidak sekarang", close: "Tutup",
  };
  const choose = (value) => { setAnalyticsConsent(value); setVisible(false); };
  return <aside className="fixed bottom-20 md:bottom-5 left-4 right-4 z-[70] mx-auto max-w-2xl rounded-xl border border-line bg-surface p-4 shadow-xl" role="dialog" aria-label={copy.title} data-testid="analytics-consent">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-toba/10 p-2 text-toba"><BarChart3 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h2 className="font-semibold text-sm">{copy.title}</h2><p className="mt-1 text-[12px] leading-relaxed text-inkSoft">{copy.body}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => choose("granted")} className="btn-primary text-[12px]">{copy.allow}</button><button type="button" onClick={() => choose("denied")} className="btn-outline text-[12px]">{copy.decline}</button></div></div>
      <button type="button" onClick={() => choose("denied")} className="flex h-11 w-11 shrink-0 items-center justify-center text-inkSoft" aria-label={copy.close}><X className="h-4 w-4" /></button>
    </div>
  </aside>;
}
