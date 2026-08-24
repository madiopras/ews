import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Download, FileCheck2, ImagePlus, LoaderCircle, Save, Send, Trash2, UploadCloud, UserMinus, UserPlus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API, api, formatError } from "../../lib/api.js";
import { useLang } from "../../contexts/LanguageContext.jsx";
import { MitraStatusBadge } from "./MitraDashboard.jsx";
import Seo from "../../components/Seo.jsx";

const TYPES = ["guide", "rental", "homestay", "souvenir"];
const DOCUMENT_TYPES = ["ktp", "siup", "npwp", "other"];
const EMPTY_FORM = {
  business_name: "", type: "guide", whatsapp: "", description: "", city: "", email: "", address: "",
  destination_ids: [], service_tags: [], current_step: 1,
  guide_languages: [], guide_license_number: "", guide_experience_years: 0,
  rental_vehicle_types: [], rental_driver_available: false, rental_fleet_size: 0,
  homestay_room_count: 0, homestay_facilities: [], homestay_checkin_info: "",
  souvenir_products: [], souvenir_delivery_available: false, souvenir_shop_hours: "",
};

function toForm(data) {
  const next = { ...EMPTY_FORM };
  Object.keys(next).forEach((key) => { if (data?.[key] !== undefined && data?.[key] !== null) next[key] = data[key]; });
  return next;
}

function assetUrl(value) {
  if (!value || /^https?:\/\//i.test(value)) return value || "";
  const backendOrigin = API.replace(/\/api\/?$/, "");
  return new URL(value, `${backendOrigin}/`).toString();
}

export default function MitraOnboarding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [partner, setPartner] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [destinations, setDestinations] = useState([]);
  const [step, setStep] = useState(1);
  const [state, setState] = useState(id ? "loading" : "ready");
  const [saveState, setSaveState] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState("ktp");
  const [staffEmail, setStaffEmail] = useState("");
  const dirtyRef = useRef(false);
  const initializedRef = useRef(false);

  const editable = !partner || ["draft", "needs_revision", "rejected"].includes(partner.status);
  const isOwner = partner?.membership_role === "owner" || partner?.membership_role === "admin";

  const load = useCallback(async () => {
    if (!id) return;
    setState("loading");
    try {
      const { data } = await api.get(`/mitra/partners/${id}`);
      setPartner(data);
      setForm(toForm(data));
      setStep(Math.max(1, Math.min(4, data.current_step || 1)));
      dirtyRef.current = false;
      initializedRef.current = true;
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/destinations").then(({ data }) => setDestinations(Array.isArray(data) ? data : data?.items || [])).catch(() => setDestinations([]));
  }, []);

  const update = (key, value) => {
    dirtyRef.current = true;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveDraft = useCallback(async (values = form, quiet = false) => {
    if (!id || !editable) return partner;
    setSaveState("saving");
    try {
      const { data } = await api.put(`/mitra/partners/${id}/draft`, { ...values, email: values.email.trim() || null });
      setPartner(data);
      setSaveState("saved");
      dirtyRef.current = false;
      if (!quiet) toast.success(t.mitra.saved);
      return data;
    } catch (error) {
      setSaveState("error");
      if (!quiet) toast.error(formatError(error.response?.data?.detail) || t.common.saveError);
      throw error;
    }
  }, [editable, form, id, partner, t.common.saveError, t.mitra.saved]);

  useEffect(() => {
    if (!id || !editable || !initializedRef.current || !dirtyRef.current) return undefined;
    const timer = window.setTimeout(() => saveDraft(form, true).catch(() => {}), 900);
    return () => window.clearTimeout(timer);
  }, [editable, form, id, saveDraft]);

  const start = async (type) => {
    setBusy(true);
    try {
      const { data } = await api.post("/mitra/onboarding", { type });
      navigate(`/mitra/onboarding/${data.id}`, { replace: true });
    } catch { toast.error(t.common.error); setBusy(false); }
  };

  const moveStep = async (next) => {
    const bounded = Math.max(1, Math.min(4, next));
    const nextForm = { ...form, current_step: bounded };
    update("current_step", bounded);
    setStep(bounded);
    if (id && editable) await saveDraft(nextForm, true).catch(() => {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setBusy(true);
    try {
      await saveDraft({ ...form, current_step: 4 }, true);
      const endpoint = ["needs_revision", "rejected"].includes(partner.status) ? "resubmit" : "submit";
      const { data } = await api.post(`/mitra/partners/${id}/${endpoint}`);
      setPartner(data);
      setForm(toForm(data));
      toast.success(endpoint === "resubmit" ? t.mitra.resubmitted : t.mitra.submitted);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const missing = detail?.fields?.map((field) => t.mitra.fieldNames[field] || field).join(", ");
      toast.error(missing ? `${t.mitra.incomplete}: ${missing}` : formatError(detail) || t.common.error);
    } finally { setBusy(false); }
  };

  const uploadDocument = async (file) => {
    if (!file) return;
    setBusy(true);
    const payload = new FormData(); payload.append("document_type", documentType); payload.append("file", file);
    try { await api.post(`/partners/${id}/upload-docs`, payload); await load(); toast.success(t.mitra.documentUploaded); }
    catch (error) { toast.error(formatError(error.response?.data?.detail) || t.common.error); }
    finally { setBusy(false); }
  };

  const uploadGallery = async (file) => {
    if (!file) return;
    setBusy(true);
    const payload = new FormData(); payload.append("file", file);
    try { const { data } = await api.post(`/mitra/partners/${id}/gallery`, payload); setPartner(data); toast.success(t.mitra.galleryUploaded); }
    catch (error) { toast.error(formatError(error.response?.data?.detail) || t.common.error); }
    finally { setBusy(false); }
  };

  const removeDocument = async (documentId) => {
    if (!window.confirm(t.mitra.confirmDeleteDocument)) return;
    setBusy(true);
    try { await api.delete(`/partners/${id}/documents/${documentId}`); await load(); }
    catch { toast.error(t.common.error); }
    finally { setBusy(false); }
  };

  const downloadDocument = async (document) => {
    try {
      const response = await api.get(`/mitra/partners/${id}/documents/${document.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = document.filename; anchor.click(); URL.revokeObjectURL(url);
    } catch { toast.error(t.common.error); }
  };

  const removeGallery = async (imageId) => {
    if (!window.confirm(t.mitra.confirmDeleteImage)) return;
    setBusy(true);
    try { const { data } = await api.delete(`/mitra/partners/${id}/gallery/${imageId}`); setPartner(data); }
    catch { toast.error(t.common.error); }
    finally { setBusy(false); }
  };

  const addStaff = async (event) => {
    event.preventDefault();
    if (!staffEmail.trim()) return;
    setBusy(true);
    try { const { data } = await api.post(`/mitra/partners/${id}/members`, { email: staffEmail.trim() }); setPartner(data); setStaffEmail(""); toast.success(t.mitra.staffAdded); }
    catch (error) { toast.error(formatError(error.response?.data?.detail) || t.common.error); }
    finally { setBusy(false); }
  };

  const removeStaff = async (userId) => {
    if (!window.confirm(t.mitra.confirmRemoveStaff)) return;
    setBusy(true);
    try { const { data } = await api.delete(`/mitra/partners/${id}/members/${userId}`); setPartner(data); }
    catch { toast.error(t.common.error); }
    finally { setBusy(false); }
  };

  const selectedDestinationNames = useMemo(() => destinations.filter((item) => form.destination_ids.includes(item.id)), [destinations, form.destination_ids]);

  if (!id) return (
    <div className="max-w-5xl px-4 sm:px-6 py-8" data-testid="mitra-onboarding-start">
      <Seo title={t.mitra.startOnboarding} description={t.mitra.startDescription} path="/mitra/onboarding" noIndex />
      <Link to="/mitra" className="inline-flex items-center gap-2 text-[13px] text-inkSoft"><ArrowLeft className="w-4 h-4" /> {t.mitra.dashboard}</Link>
      <div className="mt-6"><div className="eyebrow">{t.mitra.step} 1</div><h1 className="font-display text-[30px] sm:text-[38px] mt-1">{t.mitra.chooseBusinessType}</h1><p className="text-[14px] text-inkSoft mt-2">{t.mitra.startDescription}</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">{TYPES.map((type) => <button key={type} type="button" disabled={busy} onClick={() => start(type)} className="card-link p-6 text-left min-h-[130px]"><span className="font-display text-[23px]">{t.partners.types[type]}</span><span className="block mt-2 text-[13px] text-inkSoft">{t.mitra.typeDescriptions[type]}</span><span className="inline-flex items-center gap-1 mt-4 text-[12px] font-semibold text-toba">{t.mitra.selectType} <ArrowRight className="w-4 h-4" /></span></button>)}</div>
    </div>
  );

  if (state === "loading") return <div className="p-8 text-[13px] text-inkSoft">{t.common.loading}</div>;
  if (state === "error" || !partner) return <div className="max-w-lg p-8"><div className="card-flat p-6 text-center"><p className="text-red-700">{t.mitra.loadError}</p><button type="button" onClick={load} className="btn-outline mt-4">{t.common.retry}</button></div></div>;

  return (
    <div className="max-w-6xl px-4 sm:px-6 py-7 pb-20" data-testid="mitra-onboarding">
      <Seo title={partner.business_name || t.mitra.onboarding} description={t.mitra.startDescription} path={`/mitra/onboarding/${id}`} noIndex />
      <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/mitra" className="inline-flex items-center gap-2 text-[13px] text-inkSoft"><ArrowLeft className="w-4 h-4" /> {t.mitra.dashboard}</Link><div className="flex items-center gap-3"><MitraStatusBadge status={partner.status} t={t} /><span className={`text-[11px] ${saveState === "error" ? "text-red-700" : "text-inkSoft"}`}>{saveState === "saving" ? t.mitra.saving : saveState === "saved" ? t.mitra.autosaved : saveState === "error" ? t.mitra.saveError : ""}</span></div></div>
      <header className="mt-5"><h1 className="font-display text-[28px] sm:text-[36px]">{partner.business_name || t.mitra.unnamedDraft}</h1><p className="text-[13px] text-inkSoft mt-1">{t.partners.types[partner.type]} · {t.mitra.roles[partner.membership_role] || partner.membership_role}</p></header>
      {partner.revision_note && <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-[13px] text-orange-950"><strong>{t.mitra.revisionNote}</strong><p className="mt-1">{partner.revision_note}</p></div>}
      <div className="mt-6 grid grid-cols-4 gap-1 sm:gap-3" aria-label={t.mitra.progress}>{[1, 2, 3, 4].map((number) => <button type="button" key={number} onClick={() => moveStep(number)} className={`min-h-[52px] rounded-lg border px-2 text-[11px] sm:text-[12px] font-semibold ${step === number ? "bg-toba text-cream border-toba" : number < step ? "bg-moss/15 border-moss/30 text-toba" : "bg-surface border-line text-inkSoft"}`}><span className="hidden sm:inline">{number}. </span>{t.mitra.steps[number - 1]}</button>)}</div>

      {!editable && <div className="card-flat p-5 mt-5"><h2 className="font-display text-[22px]">{t.mitra.applicationLocked}</h2><p className="text-[13px] text-inkSoft mt-2">{partner.status === "pending" ? t.mitra.pendingDescription : t.mitra.approvedDescription}</p>{partner.review_due_at && partner.status === "pending" && <p className="mt-3 text-[12px] flex items-center gap-2"><Clock3 className="w-4 h-4" /> {t.mitra.reviewTarget} {new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", { dateStyle: "long" }).format(new Date(partner.review_due_at))}</p>}</div>}

      <section className="card-flat p-5 sm:p-7 mt-5">
        {step === 1 && <StepIdentity form={form} update={update} t={t} editable={editable} />}
        {step === 2 && <StepCoverage form={form} update={update} t={t} editable={editable} destinations={destinations} />}
        {step === 3 && <StepFiles partner={partner} t={t} editable={editable} busy={busy} documentType={documentType} setDocumentType={setDocumentType} uploadDocument={uploadDocument} uploadGallery={uploadGallery} removeDocument={removeDocument} downloadDocument={downloadDocument} removeGallery={removeGallery} />}
        {step === 4 && <StepReview partner={partner} form={form} selectedDestinationNames={selectedDestinationNames} t={t} isOwner={isOwner} editable={editable} staffEmail={staffEmail} setStaffEmail={setStaffEmail} addStaff={addStaff} removeStaff={removeStaff} />}
        <div className="mt-7 pt-5 border-t border-line flex flex-wrap justify-between gap-2"><button type="button" onClick={() => moveStep(step - 1)} disabled={step === 1} className="btn-outline">{t.common.back}</button><div className="flex flex-wrap gap-2">{editable && <button type="button" onClick={() => saveDraft(form)} disabled={busy || saveState === "saving"} className="btn-outline"><Save className="w-4 h-4" /> {t.mitra.saveDraft}</button>}{step < 4 ? <button type="button" onClick={() => moveStep(step + 1)} className="btn-primary">{t.mitra.next} <ArrowRight className="w-4 h-4" /></button> : editable && isOwner ? <button type="button" onClick={submit} disabled={busy} className="btn-primary">{busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {["needs_revision", "rejected"].includes(partner.status) ? t.mitra.resubmit : t.mitra.submitApplication}</button> : null}</div></div>
      </section>
    </div>
  );
}

function Field({ label, children, wide = false }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="block text-[12px] font-semibold text-inkSoft mb-1.5">{label}</span>{children}</label>; }
function CsvInput({ value, onChange, disabled, placeholder = "" }) { return <input disabled={disabled} className="input-flat" value={(value || []).join(", ")} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder={placeholder} />; }

function StepIdentity({ form, update, t, editable }) {
  return <div><h2 className="font-display text-[24px]">{t.mitra.steps[0]}</h2><p className="text-[13px] text-inkSoft mt-1 mb-5">{t.mitra.identityHint}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label={t.partners.fields.business_name} wide><input disabled={!editable} className="input-flat" value={form.business_name} onChange={(event) => update("business_name", event.target.value)} /></Field><Field label={t.partners.fields.type}><select disabled={!editable} className="input-flat" value={form.type} onChange={(event) => update("type", event.target.value)}>{TYPES.map((type) => <option key={type} value={type}>{t.partners.types[type]}</option>)}</select></Field><Field label={t.partners.fields.description} wide><textarea disabled={!editable} rows="4" className="input-flat resize-y" value={form.description} onChange={(event) => update("description", event.target.value)} /></Field><TypeFields form={form} update={update} t={t} editable={editable} /></div></div>;
}

function TypeFields({ form, update, t, editable }) {
  if (form.type === "guide") return <><Field label={t.mitra.fields.languages}><CsvInput disabled={!editable} value={form.guide_languages} onChange={(value) => update("guide_languages", value)} /></Field><Field label={t.mitra.fields.experienceYears}><input disabled={!editable} type="number" min="0" className="input-flat" value={form.guide_experience_years} onChange={(event) => update("guide_experience_years", Number(event.target.value))} /></Field><Field label={t.mitra.fields.license} wide><input disabled={!editable} className="input-flat" value={form.guide_license_number} onChange={(event) => update("guide_license_number", event.target.value)} /></Field></>;
  if (form.type === "rental") return <><Field label={t.mitra.fields.vehicleTypes}><CsvInput disabled={!editable} value={form.rental_vehicle_types} onChange={(value) => update("rental_vehicle_types", value)} /></Field><Field label={t.mitra.fields.fleetSize}><input disabled={!editable} type="number" min="0" className="input-flat" value={form.rental_fleet_size} onChange={(event) => update("rental_fleet_size", Number(event.target.value))} /></Field><label className="sm:col-span-2 flex items-center gap-3 min-h-[44px]"><input disabled={!editable} type="checkbox" checked={form.rental_driver_available} onChange={(event) => update("rental_driver_available", event.target.checked)} /> <span className="text-[13px]">{t.mitra.fields.driverAvailable}</span></label></>;
  if (form.type === "homestay") return <><Field label={t.mitra.fields.roomCount}><input disabled={!editable} type="number" min="0" className="input-flat" value={form.homestay_room_count} onChange={(event) => update("homestay_room_count", Number(event.target.value))} /></Field><Field label={t.mitra.fields.facilities}><CsvInput disabled={!editable} value={form.homestay_facilities} onChange={(value) => update("homestay_facilities", value)} /></Field><Field label={t.mitra.fields.checkinInfo} wide><input disabled={!editable} className="input-flat" value={form.homestay_checkin_info} onChange={(event) => update("homestay_checkin_info", event.target.value)} /></Field></>;
  return <><Field label={t.mitra.fields.products}><CsvInput disabled={!editable} value={form.souvenir_products} onChange={(value) => update("souvenir_products", value)} /></Field><Field label={t.mitra.fields.shopHours}><input disabled={!editable} className="input-flat" value={form.souvenir_shop_hours} onChange={(event) => update("souvenir_shop_hours", event.target.value)} /></Field><label className="sm:col-span-2 flex items-center gap-3 min-h-[44px]"><input disabled={!editable} type="checkbox" checked={form.souvenir_delivery_available} onChange={(event) => update("souvenir_delivery_available", event.target.checked)} /> <span className="text-[13px]">{t.mitra.fields.deliveryAvailable}</span></label></>;
}

function StepCoverage({ form, update, t, editable, destinations }) {
  const toggleDestination = (id) => update("destination_ids", form.destination_ids.includes(id) ? form.destination_ids.filter((value) => value !== id) : [...form.destination_ids, id]);
  return <div><h2 className="font-display text-[24px]">{t.mitra.steps[1]}</h2><p className="text-[13px] text-inkSoft mt-1 mb-5">{t.mitra.coverageHint}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label={t.partners.fields.whatsapp}><input disabled={!editable} inputMode="numeric" className="input-flat" value={form.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} /></Field><Field label={t.partners.fields.email}><input disabled={!editable} type="email" className="input-flat" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></Field><Field label={t.partners.fields.city}><input disabled={!editable} className="input-flat" value={form.city} onChange={(event) => update("city", event.target.value)} /></Field><Field label={t.partners.fields.address}><input disabled={!editable} className="input-flat" value={form.address} onChange={(event) => update("address", event.target.value)} /></Field><Field label={t.partners.fields.serviceTags} wide><CsvInput disabled={!editable} value={form.service_tags} onChange={(value) => update("service_tags", value)} placeholder={t.partners.fields.serviceTagsPlaceholder} /></Field><div className="sm:col-span-2"><span className="block text-[12px] font-semibold text-inkSoft mb-2">{t.partners.fields.destinations}</span><div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-cream p-3 flex flex-wrap gap-2">{destinations.map((destination) => <button disabled={!editable} key={destination.id} type="button" onClick={() => toggleDestination(destination.id)} className={`chip ${form.destination_ids.includes(destination.id) ? "chip-active" : ""}`}>{destination.name}</button>)}</div></div></div></div>;
}

function StepFiles({ partner, t, editable, busy, documentType, setDocumentType, uploadDocument, uploadGallery, removeDocument, downloadDocument, removeGallery }) {
  return <div><h2 className="font-display text-[24px]">{t.mitra.steps[2]}</h2><p className="text-[13px] text-inkSoft mt-1 mb-5">{t.mitra.filesHint}</p><div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><section className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t.mitra.gallery}</h3><p className="text-[11px] text-inkSoft mt-1">{t.mitra.galleryHint}</p>{editable && <label className="btn-outline mt-4 cursor-pointer"><ImagePlus className="w-4 h-4" /> {t.mitra.uploadImage}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="sr-only" onChange={(event) => { uploadGallery(event.target.files?.[0]); event.target.value = ""; }} /></label>}<div className="grid grid-cols-2 gap-3 mt-4">{(partner.gallery || []).map((image) => <article key={image.id} className="relative rounded-lg overflow-hidden border border-line aspect-square"><img src={assetUrl(image.url)} alt={image.filename} className="w-full h-full object-cover" />{editable && <button type="button" onClick={() => removeGallery(image.id)} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 text-red-700 flex items-center justify-center" aria-label={t.mitra.deleteImage}><Trash2 className="w-4 h-4" /></button>}</article>)}</div>{!partner.gallery?.length && <p className="text-[12px] text-inkSoft mt-5">{t.mitra.noGallery}</p>}</section><section className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t.mitra.documents}</h3><p className="text-[11px] text-inkSoft mt-1">{t.mitra.documentsHint}</p>{editable && <div className="mt-4 flex flex-col sm:flex-row gap-2"><select className="input-flat" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{t.mitra.documentTypes[type]}</option>)}</select><label className="btn-primary cursor-pointer shrink-0"><UploadCloud className="w-4 h-4" /> {t.mitra.uploadDocument}<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} className="sr-only" onChange={(event) => { uploadDocument(event.target.files?.[0]); event.target.value = ""; }} /></label></div>}<div className="divide-y divide-line mt-4">{(partner.verification_documents || []).map((document) => <article key={document.id} className="py-3 flex items-center gap-3"><FileCheck2 className="w-5 h-5 text-toba shrink-0" /><div className="flex-1 min-w-0"><div className="text-[12px] font-semibold truncate">{document.filename}</div><div className="text-[10px] text-inkSoft">{t.mitra.documentTypes[document.document_type] || document.document_type}</div></div><button type="button" onClick={() => downloadDocument(document)} className="w-9 h-9 flex items-center justify-center text-toba" aria-label={t.mitra.downloadDocument}><Download className="w-4 h-4" /></button>{editable && <button type="button" onClick={() => removeDocument(document.id)} className="w-9 h-9 flex items-center justify-center text-red-700" aria-label={t.mitra.deleteDocument}><Trash2 className="w-4 h-4" /></button>}</article>)}</div>{!partner.verification_documents?.length && <p className="text-[12px] text-inkSoft mt-5">{t.mitra.noDocuments}</p>}</section></div></div>;
}

function StepReview({ partner, form, selectedDestinationNames, t, isOwner, editable, staffEmail, setStaffEmail, addStaff, removeStaff }) {
  return <div><h2 className="font-display text-[24px]">{t.mitra.steps[3]}</h2><p className="text-[13px] text-inkSoft mt-1 mb-5">{t.mitra.reviewHint}</p><div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><section className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t.mitra.profileSummary}</h3><dl className="mt-4 space-y-3 text-[12px]"><div><dt className="text-inkSoft">{t.partners.fields.business_name}</dt><dd className="font-semibold">{form.business_name || "—"}</dd></div><div><dt className="text-inkSoft">{t.partners.fields.whatsapp}</dt><dd>{form.whatsapp || "—"}</dd></div><div><dt className="text-inkSoft">{t.partners.fields.destinations}</dt><dd>{selectedDestinationNames.map((item) => item.name).join(", ") || "—"}</dd></div><div><dt className="text-inkSoft">{t.mitra.gallery} / {t.mitra.documents}</dt><dd>{partner.gallery?.length || 0} / {partner.verification_documents?.length || 0}</dd></div></dl></section><section className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t.mitra.team}</h3><p className="text-[11px] text-inkSoft mt-1">{t.mitra.teamHint}</p>{isOwner && editable && <form onSubmit={addStaff} className="mt-4 flex flex-col sm:flex-row gap-2"><input type="email" required value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} className="input-flat" placeholder={t.mitra.staffEmail} /><button type="submit" className="btn-outline shrink-0"><UserPlus className="w-4 h-4" /> {t.mitra.addStaff}</button></form>}<div className="divide-y divide-line mt-4">{(partner.members || []).map((member) => <article key={member.user_id} className="py-3 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="text-[12px] font-semibold truncate">{member.name || member.email}</div><div className="text-[10px] text-inkSoft">{t.mitra.roles[member.role]} · {member.email}</div></div>{isOwner && member.role === "staff" && editable && <button type="button" onClick={() => removeStaff(member.user_id)} className="w-9 h-9 flex items-center justify-center text-red-700" aria-label={t.mitra.removeStaff}><UserMinus className="w-4 h-4" /></button>}</article>)}</div></section></div><section className="rounded-xl border border-line p-4 mt-5"><h3 className="font-semibold">{t.mitra.timeline}</h3>{!partner.approval_history?.length ? <p className="text-[12px] text-inkSoft mt-3">{t.mitra.noTimeline}</p> : <div className="mt-4 space-y-4">{[...partner.approval_history].reverse().map((event, index) => <article key={`${event.reviewed_at}-${index}`} className="flex gap-3"><span className="mt-1 w-3 h-3 rounded-full bg-toba shrink-0" /><div><div className="flex flex-wrap items-center gap-2"><MitraStatusBadge status={event.status} t={t} /><span className="text-[11px] text-inkSoft">{event.reviewed_at ? new Date(event.reviewed_at).toLocaleString() : ""}</span></div>{event.revision_note && <p className="mt-1 text-[12px] text-inkSoft">{event.revision_note}</p>}</div></article>)}</div>}</section>{partner.membership_role === "staff" && editable && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900">{t.mitra.staffSubmitHint}</p>}</div>;
}
