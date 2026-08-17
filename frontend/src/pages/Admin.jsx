import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { CATEGORY_KEYS } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check, XCircle } from "lucide-react";
import ImageDropzone from "@/components/ImageDropzone";
import PartnerCard from "@/components/PartnerCard";

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
  const [section, setSection] = useState("destinations"); // 'destinations' | 'partners'
  const [list, setList] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | id
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
    setForm({
      ...d,
      images: d.images || [],
    });
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

  const inputCls =
    "w-full rounded-2xl px-4 py-3 bg-sand shadow-neu-inset outline-none text-sm";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24" data-testid="admin-page">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-1">
            Admin
          </div>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight">
            {t.admin.title}
          </h1>
        </div>
        {section === "destinations" && (
          <button
            onClick={startNew}
            className="px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90 flex items-center gap-2"
            data-testid="admin-add-btn"
          >
            <Plus className="w-4 h-4" /> {t.admin.add}
          </button>
        )}
      </header>

      {/* Section tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setSection("destinations")}
          className={`px-6 py-3 rounded-full text-sm transition-all ${
            section === "destinations" ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
          }`}
          data-testid="admin-tab-destinations"
        >
          Destinations ({list.length})
        </button>
        <button
          onClick={() => setSection("partners")}
          className={`px-6 py-3 rounded-full text-sm transition-all ${
            section === "partners" ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
          }`}
          data-testid="admin-tab-partners"
        >
          Partners ({partners.length})
        </button>
      </div>

      {section === "partners" ? (
        loading ? (
          <div className="text-muted2">{t.common.loading}</div>
        ) : partners.length === 0 ? (
          <div className="text-muted2 py-10 text-center neu-raised rounded-3xl">No partner applications yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {partners.map((p) => (
              <div key={p.id} className="space-y-3" data-testid={`admin-partner-${p.id}`}>
                <PartnerCard partner={p} showBadge />
                <div className="flex gap-2 pl-2">
                  {p.status !== "approved" && (
                    <button
                      onClick={() => setPartnerStatus(p.id, "approved")}
                      className="px-4 py-2 rounded-full text-xs shadow-neu-sm hover:text-emerald-600 flex items-center gap-1.5"
                      data-testid={`partner-approve-${p.id}`}
                    >
                      <Check className="w-3.5 h-3.5" /> {t.partners.approve}
                    </button>
                  )}
                  {p.status !== "rejected" && (
                    <button
                      onClick={() => setPartnerStatus(p.id, "rejected")}
                      className="px-4 py-2 rounded-full text-xs shadow-neu-sm hover:text-red-500 flex items-center gap-1.5"
                      data-testid={`partner-reject-${p.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5" /> {t.partners.reject}
                    </button>
                  )}
                  <button
                    onClick={() => deletePartner(p.id)}
                    className="px-4 py-2 rounded-full text-xs shadow-neu-sm hover:text-red-500 flex items-center gap-1.5"
                    data-testid={`partner-delete-${p.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>

      {editing && (
        <form
          onSubmit={save}
          className="neu-raised rounded-3xl p-6 sm:p-8 mb-10 space-y-4"
          data-testid="admin-form"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-2xl">
              {editing === "new" ? t.admin.add : t.admin.edit}
            </h2>
            <button
              type="button"
              onClick={cancel}
              className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center hover:text-sunset"
              data-testid="admin-cancel-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.name}</span>
              <input required value={form.name} onChange={upd("name")} className={inputCls} data-testid="f-name" />
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.name_en}</span>
              <input value={form.name_en} onChange={upd("name_en")} className={inputCls} data-testid="f-name-en" />
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.location}</span>
              <input required value={form.location} onChange={upd("location")} className={inputCls} data-testid="f-location" />
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.category}</span>
              <select value={form.category} onChange={upd("category")} className={inputCls} data-testid="f-category">
                {CATEGORY_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {t.categories[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.price}</span>
              <input type="number" min="0" required value={form.price} onChange={upd("price")} className={inputCls} data-testid="f-price" />
            </label>
            <label className="flex items-center gap-3 pl-2 mt-6">
              <input type="checkbox" checked={form.featured} onChange={upd("featured")} data-testid="f-featured" className="w-5 h-5" />
              <span className="text-sm">{t.admin.fields.featured}</span>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs text-muted2 pl-2 block mb-2">{t.admin.fields.images}</span>
              <ImageDropzone
                value={form.images}
                onChange={(imgs) => setForm((p) => ({ ...p, images: imgs }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.latitude}</span>
              <input type="number" step="any" required value={form.latitude} onChange={upd("latitude")} className={inputCls} data-testid="f-latitude" />
            </label>
            <label className="block">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.longitude}</span>
              <input type="number" step="any" required value={form.longitude} onChange={upd("longitude")} className={inputCls} data-testid="f-longitude" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.description}</span>
              <textarea required rows={4} value={form.description} onChange={upd("description")} className={inputCls + " resize-none"} data-testid="f-description" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs text-muted2 pl-2">{t.admin.fields.description_en}</span>
              <textarea rows={4} value={form.description_en} onChange={upd("description_en")} className={inputCls + " resize-none"} data-testid="f-description-en" />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm disabled:opacity-50"
              data-testid="admin-save-btn"
            >
              {saving ? t.common.loading : t.admin.save}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-6 py-3 rounded-full shadow-neu-sm text-sm"
            >
              {t.admin.cancel}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : (
        <div className="space-y-4">
          {list.map((d) => (
            <div
              key={d.id}
              className="neu-raised rounded-2xl p-4 flex items-center gap-4"
              data-testid={`admin-row-${d.id}`}
            >
              <img
                src={d.images?.[0]}
                alt=""
                className="w-20 h-20 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg truncate">{d.name}</div>
                <div className="text-xs text-muted2 truncate">
                  {t.categories[d.category]} · {d.location} · Rp{" "}
                  {new Intl.NumberFormat("id-ID").format(d.price)}
                  {d.featured && " · ★"}
                </div>
              </div>
              <button
                onClick={() => startEdit(d)}
                className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center hover:text-sunset"
                data-testid={`admin-edit-${d.id}`}
                aria-label="edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(d.id)}
                className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center hover:text-red-500"
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
