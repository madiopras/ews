import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Mail } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import { createEmailTemplate, getEmailTemplate, updateEmailTemplate } from "./settingsApi.js";

const EMPTY = { key: "", name: "", subject_id: "", subject_en: "", body_id: "", body_en: "", enabled: true };
export default function EmailTemplateFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate(); const qc = useQueryClient(); const { t } = useLang(); const copy = t.admin.settings; const [previewLang, setPreviewLang] = useState("id");
  const query = useQuery({ queryKey: ["admin", "email-template", id], queryFn: ({ signal }) => getEmailTemplate(id, signal), enabled: editing });
  const [form, setForm] = useState(EMPTY); const [initial, setInitial] = useState(JSON.stringify(EMPTY));
  useEffect(() => { if (query.data) { setForm(query.data); setInitial(JSON.stringify(query.data)); } }, [query.data]);
  const dirty = JSON.stringify(form) !== initial;
  useEffect(() => { const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const mutation = useMutation({ mutationFn: () => {
    const payload = {
      key: form.key,
      name: form.name,
      subject_id: form.subject_id,
      subject_en: form.subject_en,
      body_id: form.body_id,
      body_en: form.body_en,
      enabled: form.enabled,
    };
    return editing ? updateEmailTemplate(id, payload) : createEmailTemplate(payload);
  }, onSuccess: async () => { setInitial(JSON.stringify(form)); await qc.invalidateQueries({ queryKey: ["admin", "email-templates"] }); toast.success(copy.templateSaved); navigate("/admin/settings/email-templates"); }, onError: (e) => toast.error(formatError(e.response?.data?.detail || copy.saveError)) });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  if (editing && query.isLoading) return <div className="p-8 text-inkSoft">Loading...</div>;
  if (editing && query.isError) return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{copy.loadError}</div>;
  return <div className="app-gutter w-full py-6 pb-16" data-testid="email-template-form-page"><header className="mb-5"><Link to="/admin/settings/email-templates" className="inline-flex gap-2 items-center text-xs text-inkSoft"><ArrowLeft className="w-4 h-4" />{copy.back}</Link><div className="eyebrow mt-4">Admin · Email</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{editing ? copy.edit : copy.addTemplate}</h1></header>
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] gap-5 items-start"><section className="card-flat p-5 sm:p-6 space-y-4"><div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-semibold text-inkSoft">{copy.key}<input className="input-flat mt-1.5" required pattern="[a-z0-9_]+" value={form.key} onChange={(e) => set("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} /></label><label className="text-xs font-semibold text-inkSoft">{copy.templateName}<input className="input-flat mt-1.5" required value={form.name} onChange={(e) => set("name", e.target.value)} /></label></div><label className="block text-xs font-semibold text-inkSoft">{copy.subjectId}<input className="input-flat mt-1.5" required value={form.subject_id} onChange={(e) => set("subject_id", e.target.value)} /></label><label className="block text-xs font-semibold text-inkSoft">{copy.bodyId}<textarea className="input-flat mt-1.5 min-h-[220px] font-mono text-xs" required value={form.body_id} onChange={(e) => set("body_id", e.target.value)} /></label><label className="block text-xs font-semibold text-inkSoft">{copy.subjectEn}<input className="input-flat mt-1.5" required value={form.subject_en} onChange={(e) => set("subject_en", e.target.value)} /></label><label className="block text-xs font-semibold text-inkSoft">{copy.bodyEn}<textarea className="input-flat mt-1.5 min-h-[220px] font-mono text-xs" required value={form.body_en} onChange={(e) => set("body_en", e.target.value)} /></label><label className="flex gap-3 items-center text-sm"><input type="checkbox" className="accent-toba w-4 h-4" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />{copy.enabled}</label><FormActions onCancel={() => dirty && !window.confirm(copy.discardTemplate) ? null : navigate("/admin/settings/email-templates")} saving={mutation.isPending} disabled={!dirty} /></section>
      <aside className="card-flat p-5 xl:sticky xl:top-20"><div className="flex items-center justify-between"><h2 className="font-semibold flex gap-2 items-center"><Eye className="w-4 h-4" />{copy.preview}</h2><div className="flex rounded-lg border border-line p-1"><button type="button" aria-pressed={previewLang === "id"} className={`px-3 py-1 text-xs rounded ${previewLang === "id" ? "bg-toba text-white" : ""}`} onClick={() => setPreviewLang("id")}>ID</button><button type="button" aria-pressed={previewLang === "en"} className={`px-3 py-1 text-xs rounded ${previewLang === "en" ? "bg-toba text-white" : ""}`} onClick={() => setPreviewLang("en")}>EN</button></div></div><div className="mt-5 rounded-xl border border-line overflow-hidden"><div className="bg-line/20 px-4 py-3 flex gap-2 items-center text-xs text-inkSoft"><Mail className="w-4 h-4" />{form.name || copy.templateName}</div><div className="p-4"><div className="font-semibold text-sm">{previewLang === "id" ? form.subject_id : form.subject_en}</div><div className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-inkSoft">{previewLang === "id" ? form.body_id : form.body_en}</div></div></div></aside>
    </form></div>;
}
