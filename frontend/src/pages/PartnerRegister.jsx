import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Handshake, CheckCircle2 } from "lucide-react";

const TYPES = ["guide", "rental", "homestay"];

export default function PartnerRegister() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [dests, setDests] = useState([]);
  const [form, setForm] = useState({
    business_name: "",
    type: "guide",
    whatsapp: "",
    description: "",
    city: "",
    destination_ids: [],
    image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get("/destinations").then(({ data }) => setDests(data));
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
      toast.error("Pilih minimal 1 destinasi");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/partners", form);
      setDone(true);
      toast.success(t.partners.success);
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none";

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 mt-20 pb-24 text-center" data-testid="partner-register-success">
        <div className="w-20 h-20 mx-auto rounded-full shadow-neu-raised flex items-center justify-center text-emerald-500 mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="font-display text-4xl mb-4">{t.partners.success}</h1>
        <button
          onClick={() => navigate("/partners")}
          className="mt-6 px-6 py-3 rounded-full shadow-neu-raised hover:text-sunset font-semibold text-sm"
        >
          {t.partners.title}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-10 pb-24" data-testid="partner-register-page">
      <header className="mb-8">
        <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2 flex items-center gap-2">
          <Handshake className="w-4 h-4" /> {t.nav.partners}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight">
          {t.partners.registerTitle}
        </h1>
        <p className="mt-4 text-muted2">{t.partners.registerSubtitle}</p>
      </header>

      <form onSubmit={submit} className="neu-raised rounded-3xl p-6 sm:p-8 space-y-5">
        <label className="block">
          <span className="text-xs text-muted2 pl-1">{t.partners.fields.business_name}</span>
          <input required value={form.business_name} onChange={upd("business_name")} className={inputCls + " mt-2"} data-testid="partner-name" />
        </label>

        <div>
          <span className="text-xs text-muted2 pl-1 block mb-2">{t.partners.fields.type}</span>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: tp }))}
                className={`px-5 py-2.5 rounded-full text-sm transition-all ${
                  form.type === tp ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
                }`}
                data-testid={`partner-type-${tp}`}
              >
                {t.partners.types[tp]}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-muted2 pl-1">{t.partners.fields.whatsapp}</span>
          <input
            required
            inputMode="numeric"
            value={form.whatsapp}
            onChange={upd("whatsapp")}
            placeholder="6281234567890"
            className={inputCls + " mt-2"}
            data-testid="partner-whatsapp"
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted2 pl-1">{t.partners.fields.city}</span>
          <input required value={form.city} onChange={upd("city")} className={inputCls + " mt-2"} data-testid="partner-city" />
        </label>

        <label className="block">
          <span className="text-xs text-muted2 pl-1">{t.partners.fields.description}</span>
          <textarea
            required
            rows={4}
            minLength={10}
            value={form.description}
            onChange={upd("description")}
            className={inputCls + " mt-2 resize-none"}
            data-testid="partner-description"
          />
        </label>

        <div>
          <span className="text-xs text-muted2 pl-1 block mb-2">{t.partners.fields.destinations}</span>
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 rounded-2xl shadow-neu-inset">
            {dests.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDest(d.id)}
                className={`px-4 py-2 rounded-full text-xs transition-all ${
                  form.destination_ids.includes(d.id)
                    ? "bg-sunset text-sand font-semibold"
                    : "shadow-neu-sm hover:text-sunset"
                }`}
                data-testid={`partner-dest-${d.id}`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-muted2 pl-1">{t.partners.fields.image}</span>
          <input value={form.image} onChange={upd("image")} placeholder="https://..." className={inputCls + " mt-2"} data-testid="partner-image" />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-4 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90 disabled:opacity-50"
          data-testid="partner-submit-btn"
        >
          {submitting ? t.common.loading : t.partners.submit}
        </button>
      </form>
    </div>
  );
}
