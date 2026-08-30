import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatError } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { toast } from "sonner";
import { Handshake, CheckCircle2 } from "lucide-react";

const TYPES = ["guide", "rental", "homestay", "culinary", "souvenir"];
const csv = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

export default function PartnerRegister() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [dests, setDests] = useState([]);
  const [form, setForm] = useState({
    business_name: "",
    type: "guide",
    whatsapp: "",
    email: "",
    address: "",
    description: "",
    city: "",
    destination_ids: [],
    service_tags: "",
    image: "",
    culinary_categories: "",
    culinary_specialties: "",
    culinary_service_modes: "",
    culinary_dietary_tags: "",
    culinary_opening_info: "",
    culinary_reservation_note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/destinations", { params: { per_page: 100 } })
      .then(({ data }) => setDests(Array.isArray(data) ? data : data.data || []))
      .catch(() => setDests([]));
  }, []);

  const upd = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggleDest = (id) => {
    setForm((p) => ({
      ...p,
      destination_ids: p.destination_ids.includes(id)
        ? p.destination_ids.filter((x) => x !== id)
        : [...p.destination_ids, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.destination_ids.length === 0) {
      toast.error(t.partners.selectDestinationError);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/partners", {
        ...form,
        service_tags: form.service_tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 20),
        culinary_categories: form.type === "culinary" ? csv(form.culinary_categories) : [],
        culinary_specialties: form.type === "culinary" ? csv(form.culinary_specialties) : [],
        culinary_service_modes: form.type === "culinary" ? csv(form.culinary_service_modes) : [],
        culinary_dietary_tags: form.type === "culinary" ? csv(form.culinary_dietary_tags) : [],
        email: form.email.trim() || null,
        address: form.address.trim(),
      });
      setDone(true);
      toast.success(t.partners.success);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="app-gutter mx-auto mt-12 max-w-xl text-center sm:mt-16 md:pb-16" data-testid="partner-register-success">
        <div className="w-16 h-16 mx-auto rounded-full bg-moss/20 flex items-center justify-center text-[#4F6047] mb-5">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="font-display text-[26px] sm:text-3xl mb-5">{t.partners.success}</h1>
        <button onClick={() => navigate("/partners")} className="btn-outline">
          {t.partners.title}
        </button>
      </div>
    );
  }

  return (
    <div className="app-gutter mx-auto mt-5 max-w-2xl sm:mt-6 md:pb-16" data-testid="partner-register-page">
      <header className="mb-6">
        <div className="eyebrow flex items-center gap-2">
          <Handshake className="w-4 h-4" /> {t.nav.partners}
        </div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">
          {t.partners.registerTitle}
        </h1>
        <p className="mt-3 text-[14px] text-inkSoft">{t.partners.registerSubtitle}</p>
      </header>

      <form onSubmit={submit} className="card-flat p-4 sm:p-6 space-y-5">
        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.business_name}</span>
          <input
            required
            value={form.business_name}
            onChange={upd("business_name")}
            className="input-flat mt-2"
            data-testid="partner-name"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.serviceTags}</span>
          <input
            value={form.service_tags}
            onChange={upd("service_tags")}
            placeholder={t.partners.fields.serviceTagsPlaceholder}
            className="input-flat mt-2"
            data-testid="partner-service-tags"
          />
        </label>

        <div>
          <span className="text-[13px] text-inkSoft block mb-2">{t.partners.fields.type}</span>
          <div className="scroll-x">
            {TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: tp }))}
                className={`chip ${form.type === tp ? "chip-active" : ""}`}
                data-testid={`partner-type-${tp}`}
              >
                {t.partners.types[tp]}
              </button>
            ))}
          </div>
        </div>

        {form.type === "culinary" && <section className="rounded-xl border border-line bg-cream/40 p-4 space-y-4" data-testid="partner-culinary-fields">
          {[
            ["culinary_categories", t.mitra.fields.culinaryCategories],
            ["culinary_specialties", t.mitra.fields.culinarySpecialties],
            ["culinary_service_modes", t.mitra.fields.culinaryServiceModes],
            ["culinary_dietary_tags", t.mitra.fields.culinaryDietaryTags],
          ].map(([key, label]) => <label key={key} className="block"><span className="text-[13px] text-inkSoft">{label}</span><input required={key === "culinary_specialties"} value={form[key]} onChange={upd(key)} className="input-flat mt-2" /></label>)}
          <label className="block"><span className="text-[13px] text-inkSoft">{t.mitra.fields.culinaryOpeningInfo}</span><input value={form.culinary_opening_info} onChange={upd("culinary_opening_info")} className="input-flat mt-2" /></label>
          <label className="block"><span className="text-[13px] text-inkSoft">{t.mitra.fields.culinaryReservationNote}</span><input value={form.culinary_reservation_note} onChange={upd("culinary_reservation_note")} className="input-flat mt-2" /></label>
        </section>}

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.whatsapp}</span>
          <input
            required
            inputMode="numeric"
            value={form.whatsapp}
            onChange={upd("whatsapp")}
            placeholder="6281234567890"
            className="input-flat mt-2"
            data-testid="partner-whatsapp"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.city}</span>
          <input
            required
            value={form.city}
            onChange={upd("city")}
            className="input-flat mt-2"
            data-testid="partner-city"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.email}</span>
          <input
            type="email"
            value={form.email}
            onChange={upd("email")}
            className="input-flat mt-2"
            data-testid="partner-email"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.address}</span>
          <input
            value={form.address}
            onChange={upd("address")}
            className="input-flat mt-2"
            data-testid="partner-address"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.description}</span>
          <textarea
            required
            rows={4}
            minLength={10}
            value={form.description}
            onChange={upd("description")}
            className="input-flat mt-2 resize-none"
            data-testid="partner-description"
          />
        </label>

        <div>
          <span className="text-[13px] text-inkSoft block mb-2">
            {t.partners.fields.destinations}
          </span>
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-3 rounded-lg border border-line bg-cream">
            {dests.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDest(d.id)}
                className={`chip ${form.destination_ids.includes(d.id) ? "chip-active" : ""}`}
                data-testid={`partner-dest-${d.id}`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-[13px] text-inkSoft">{t.partners.fields.image}</span>
          <input
            value={form.image}
            onChange={upd("image")}
            placeholder="https://..."
            className="input-flat mt-2"
            data-testid="partner-image"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
          data-testid="partner-submit-btn"
        >
          {submitting ? t.common.loading : t.partners.submit}
        </button>
      </form>
    </div>
  );
}
