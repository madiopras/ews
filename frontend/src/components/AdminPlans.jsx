import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Crown } from "lucide-react";

const EMPTY = { code: "", label_id: "", label_en: "", months: 1, price: 99000, active: true, order: 1 };

export default function AdminPlans() {
  const { t } = useLang();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/premium/plans")
      .then(({ data }) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const upd = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      months: Number(form.months),
      price: Number(form.price),
      order: Number(form.order),
    };
    try {
      if (editing === "new") await api.post("/admin/premium/plans", payload);
      else await api.put(`/admin/premium/plans/${editing}`, payload);
      toast.success(t.admin.save);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t.admin.confirmDeletePlan)) return;
    try {
      await api.delete(`/admin/premium/plans/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Error");
    }
  };

  return (
    <div data-testid="admin-plans">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 text-toba">
            <Crown className="w-4 h-4" />
            <span className="text-[12px] tracking-[0.18em] uppercase font-semibold">
              {t.partners.premium.badge}
            </span>
          </div>
          <h2 className="font-display text-[22px] mt-1.5">{t.admin.plansTitle}</h2>
        </div>
        <button
          onClick={() => {
            setEditing("new");
            setForm(EMPTY);
          }}
          className="btn-primary w-full sm:w-auto"
          data-testid="plan-add-btn"
        >
          <Plus className="w-4 h-4" /> {t.admin.addPlan}
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="card-flat p-4 sm:p-6 mb-5 space-y-4" data-testid="plan-form">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[19px]">
              {editing === "new" ? t.admin.addPlan : t.admin.edit}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft"
              data-testid="plan-cancel-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.code}</span>
              <input required value={form.code} onChange={upd("code")} className="input-flat mt-2" data-testid="plan-code" />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.months}</span>
              <input type="number" min="1" max="36" required value={form.months} onChange={upd("months")} className="input-flat mt-2" data-testid="plan-months" />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.label_id}</span>
              <input required value={form.label_id} onChange={upd("label_id")} className="input-flat mt-2" data-testid="plan-label-id" />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.label_en}</span>
              <input required value={form.label_en} onChange={upd("label_en")} className="input-flat mt-2" data-testid="plan-label-en" />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.price}</span>
              <input type="number" min="0" step="1000" required value={form.price} onChange={upd("price")} className="input-flat mt-2" data-testid="plan-price" />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft">{t.admin.planFields.order}</span>
              <input type="number" min="1" required value={form.order} onChange={upd("order")} className="input-flat mt-2" data-testid="plan-order" />
            </label>
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" checked={form.active} onChange={upd("active")} className="w-5 h-5 accent-[#0F3D3E]" data-testid="plan-active" />
              <span className="text-sm">{t.admin.planFields.active}</span>
            </label>
          </div>

          <button type="submit" disabled={saving} className="btn-primary" data-testid="plan-save-btn">
            {saving ? t.common.loading : t.admin.save}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="card-flat p-4 flex items-center gap-3" data-testid={`plan-row-${p.code}`}>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[18px] truncate">{p.label_id}</div>
                <div className="text-[12px] text-inkSoft">
                  {p.code} · {p.months} bln · Rp {new Intl.NumberFormat("id-ID").format(p.price)} ·{" "}
                  {p.active ? "aktif" : "nonaktif"}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditing(p.id);
                  setForm(p);
                }}
                className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-toba"
                data-testid={`plan-edit-${p.code}`}
                aria-label="edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(p.id)}
                className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-red-500"
                data-testid={`plan-delete-${p.code}`}
                aria-label="delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
