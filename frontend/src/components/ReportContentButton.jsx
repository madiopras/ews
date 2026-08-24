import React, { useState } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";

export default function ReportContentButton({ targetType, targetId, compact = false }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("incorrect");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const copy = lang === "en" ? { report: "Report", title: "Report this content", hint: "Tell our editorial team what should be reviewed.", reasons: { spam: "Spam", incorrect: "Incorrect information", abuse: "Abusive content", unsafe: "Unsafe information", closed: "Business closed", other: "Other" }, details: "Additional details", send: "Send report", sent: "Report sent. Thank you.", close: "Close" } : { report: "Laporkan", title: "Laporkan konten ini", hint: "Beri tahu tim editorial bagian yang perlu diperiksa.", reasons: { spam: "Spam", incorrect: "Informasi tidak tepat", abuse: "Konten kasar", unsafe: "Informasi tidak aman", closed: "Usaha sudah tutup", other: "Lainnya" }, details: "Keterangan tambahan", send: "Kirim laporan", sent: "Laporan terkirim. Terima kasih.", close: "Tutup" };
  const submit = async event => { event.preventDefault(); setSaving(true); try { await api.post("/reports", { target_type: targetType, target_id: targetId, reason, description }); toast.success(copy.sent); setOpen(false); setDescription(""); } catch { toast.error(t.common.error); } finally { setSaving(false); } };
  return <>{<button type="button" onClick={() => setOpen(true)} className={compact ? "inline-flex items-center gap-1 text-[11px] font-semibold text-inkSoft hover:text-red-700" : "btn-outline"}><Flag className="h-3.5 w-3.5" />{copy.report}</button>}{open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby={`report-title-${targetId}`}><form onSubmit={submit} className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id={`report-title-${targetId}`} className="font-display text-2xl">{copy.title}</h2><p className="mt-1 text-xs text-inkSoft">{copy.hint}</p></div><button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center" aria-label={copy.close}><X className="h-4 w-4" /></button></div><label className="mt-5 block text-xs font-semibold text-inkSoft">Alasan<select value={reason} onChange={event => setReason(event.target.value)} className="input-flat mt-1.5">{Object.entries(copy.reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block text-xs font-semibold text-inkSoft">{copy.details}<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={4} className="input-flat mt-1.5" /></label><button disabled={saving} className="btn-primary mt-5 w-full">{saving ? t.common.loading : copy.send}</button></form></div>}</>;
}
