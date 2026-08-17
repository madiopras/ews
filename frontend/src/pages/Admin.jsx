import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { CATEGORY_KEYS } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check, XCircle } from "lucide-react";
import ImageDropzone from "@/components/ImageDropzone";
import PartnerCard from "@/components/PartnerCard";
import AdminPlans from "@/components/AdminPlans";

const EMPTY = {
  name: "",
  name_en: "",
  location: "",
  category: "nature",
  price: 0,
  description: "",
  description_en: "",
  images: [],
  latitude: 2.6540,
  longitude: 98.8756,
  featured: false,
};

export default function Admin() {
  const { t } = useLang();
  const [section, setSection] = useState("destinations");
  const [list, setList] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/destinations").then((r) => r.data).catch(() => []),
      api.get("/partners/admin").then((r) => r.data).catch(() => []),
    ]).then(([d, p]) => {
      setList(d);
      setPartners(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const setPartnerStatus = async (id, status) => {
    try {
      await api.patch(`/partners/${id}/status`, { status });
      toast.success(status);
      load();
    } catch {
      toast.error("Error");
    }
  };

  const deletePartner = async (id) => {
    if (!window.confirm("Delete this partner?")) return;
    try {
      await api.delete(`/partners/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Error");
    }
  };

  const startEdit = (d) => {
    setEditing(d.id);
    setForm({ ...d, images: d.images || [] });
  };

  const startNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const cancel = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      images: Array.isArray(form.images) ? form.images : [],
    };
    try {
      if (editing === "new") {
        await api.post("/destinations", payload);
        toast.success("Created");
      } else {
        await api.put(`/destinations/${editing}`, payload);
        toast.success("Updated");
      }
      cancel();
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t.admin.confirmDelete)) return;
    try {
      await api.delete(`/destinations/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error("Error");
    }
  };

  const upd = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16" data-testid="admin-page">
      <header className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">
            {t.admin.title}
          </h1>
        </div>
        {section === "destinations" && (
          <button onClick={startNew} className="btn-primary w-full sm:w-auto" data-testid="admin-add-btn">
            <Plus className="w-4 h-4" /> {t.admin.add}
          </button>
        )}
      </header>

      <div className="scroll-x mb-6">
        <button
          onClick={() => setSection("destinations")}
          className={`chip ${section === "destinations" ? "chip-active" : ""}`}
          data-testid="admin-tab-destinations"
        >
          Destinations ({list.length})
        </button>
        <button
          onClick={() => setSection("partners")}
          className={`chip ${section === "partners" ? "chip-active" : ""}`}
          data-testid="admin-tab-partners"
        >
          Partners ({partners.length})
        </button>
        <button
          onClick={() => setSection("plans")}
          className={`chip ${section === "plans" ? "chip-active" : ""}`}
          data-testid="admin-tab-plans"
        >
          {t.admin.plansTab}
        </button>
      </div>

      {section === "plans" ? (
        <AdminPlans />
      ) : section === "partners" ? (
        loading ? (
          <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
        ) : partners.length === 0 ? (
          <div className="card-flat text-inkSoft py-12 text-center text-[13px]">
            No partner applications yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((p) => (
              <div key={p.id} className="space-y-2" data-testid={`admin-partner-${p.id}`}>
                <PartnerCard partner={p} showBadge />
                <div className="flex flex-wrap gap-2">
                  {p.status !== "approved" && (
                    <button
                      onClick={() => setPartnerStatus(p.id, "approved")}
                      className="btn-outline text-[13px]"
                      data-testid={`partner-approve-${p.id}`}
                    >
                      <Check className="w-4 h-4" /> {t.partners.approve}
                    </button>
                  )}
                  {p.status !== "rejected" && (
                    <button
                      onClick={() => setPartnerStatus(p.id, "rejected")}
                      className="btn-outline text-[13px]"
                      data-testid={`partner-reject-${p.id}`}
                    >
                      <XCircle className="w-4 h-4" /> {t.partners.reject}
                    </button>
                  )}
                  <button
                    onClick={() => deletePartner(p.id)}
                    className="btn-outline text-[13px]"
                    data-testid={`partner-delete-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {editing && (
            <form onSubmit={save} className="card-flat p-4 sm:p-6 mb-6 space-y-4" data-testid="admin-form">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[22px]">
                  {editing === "new" ? t.admin.add : t.admin.edit}
                </h2>
                <button
                  type="button"
                  onClick={cancel}
                  className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-toba"
                  data-testid="admin-cancel-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.name}</span>
                  <input required value={form.name} onChange={upd("name")} className="input-flat mt-2" data-testid="f-name" />
                </label>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.name_en}</span>
                  <input value={form.name_en} onChange={upd("name_en")} className="input-flat mt-2" data-testid="f-name-en" />
                </label>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.location}</span>
                  <input required value={form.location} onChange={upd("location")} className="input-flat mt-2" data-testid="f-location" />
                </label>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.category}</span>
                  <select value={form.category} onChange={upd("category")} className="input-flat mt-2" data-testid="f-category">
                    {CATEGORY_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {t.categories[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.price}</span>
                  <input type="number" min="0" required value={form.price} onChange={upd("price")} className="input-flat mt-2" data-testid="f-price" />
                </label>
                <label className="flex items-center gap-3 min-h-[44px] md:mt-6">
                  <input type="checkbox" checked={form.featured} onChange={upd("featured")} data-testid="f-featured" className="w-5 h-5 accent-[#0F3D3E]" />
                  <span className="text-sm">{t.admin.fields.featured}</span>
                </label>
                <div className="md:col-span-2">
                  <span className="text-[13px] text-inkSoft block mb-2">{t.admin.fields.images}</span>
                  <ImageDropzone
                    value={form.images}
                    onChange={(imgs) => setForm((p) => ({ ...p, images: imgs }))}
                  />
                </div>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.latitude}</span>
                  <input type="number" step="any" required value={form.latitude} onChange={upd("latitude")} className="input-flat mt-2" data-testid="f-latitude" />
                </label>
                <label className="block">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.longitude}</span>
                  <input type="number" step="any" required value={form.longitude} onChange={upd("longitude")} className="input-flat mt-2" data-testid="f-longitude" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.description}</span>
                  <textarea required rows={4} value={form.description} onChange={upd("description")} className="input-flat mt-2 resize-none" data-testid="f-description" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[13px] text-inkSoft">{t.admin.fields.description_en}</span>
                  <textarea rows={4} value={form.description_en} onChange={upd("description_en")} className="input-flat mt-2 resize-none" data-testid="f-description-en" />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary" data-testid="admin-save-btn">
                  {saving ? t.common.loading : t.admin.save}
                </button>
                <button type="button" onClick={cancel} className="btn-outline">
                  {t.admin.cancel}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
          ) : (
            <div className="space-y-3">
              {list.map((d) => (
                <div key={d.id} className="card-flat p-3 flex items-center gap-3" data-testid={`admin-row-${d.id}`}>
                  <img
                    src={d.images?.[0]}
                    alt=""
                    loading="lazy"
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-line"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[17px] truncate">{d.name}</div>
                    <div className="text-[12px] text-inkSoft truncate">
                      {t.categories[d.category]} · {d.location} · Rp{" "}
                      {new Intl.NumberFormat("id-ID").format(d.price)}
                      {d.featured && " · ★"}
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(d)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-toba"
                    data-testid={`admin-edit-${d.id}`}
                    aria-label="edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-red-500"
                    data-testid={`admin-delete-${d.id}`}
                    aria-label="delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
