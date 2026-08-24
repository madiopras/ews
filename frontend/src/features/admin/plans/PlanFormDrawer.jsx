import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { AdminDrawer } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { planSchema, planToForm } from "./planSchema.js";

function Field({ label, error, children }) {
  return <label className="block"><span className="text-[12px] font-semibold text-inkSoft">{label}</span><span className="block mt-2">{children}</span>{error && <span className="block mt-1.5 text-[11px] text-red-700" role="alert">{error.message}</span>}</label>;
}

export default function PlanFormDrawer({ open, plan, onOpenChange, onSave, saving = false }) {
  const { t } = useLang();
  const copy = t.admin.planAdmin;
  const fields = t.admin.planFields;
  const editing = Boolean(plan?.id);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(planSchema), defaultValues: planToForm(plan) });
  useEffect(() => reset(planToForm(plan)), [plan, reset]);
  const close = () => {
    if (!isDirty || window.confirm(copy.unsaved)) onOpenChange(false);
  };
  return (
    <AdminDrawer
      open={open}
      onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}
      title={editing ? copy.editTitle : copy.newTitle}
      description={copy.drawerDescription}
      loading={saving}
      footer={<div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><button type="button" onClick={close} disabled={saving} className="btn-outline">{t.admin.cancel}</button><button type="submit" form="plan-drawer-form" disabled={saving} className="btn-primary">{saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{copy.save}</button></div>}
    >
      <form id="plan-drawer-form" onSubmit={handleSubmit(onSave)} className="space-y-5" noValidate data-testid="plan-form-drawer">
        <Field label={fields.code} error={errors.code}><input {...register("code")} className="input-flat" autoFocus /><span className="block mt-1.5 text-[11px] text-inkSoft">{copy.codeHint}</span></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label={fields.label_id} error={errors.label_id}><input {...register("label_id")} className="input-flat" /></Field><Field label={fields.label_en} error={errors.label_en}><input {...register("label_en")} className="input-flat" /></Field></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label={fields.months} error={errors.months}><input {...register("months", { valueAsNumber: true })} type="number" min="1" max="36" className="input-flat" /></Field><Field label={fields.price} error={errors.price}><input {...register("price", { valueAsNumber: true })} type="number" min="0" step="1000" className="input-flat" /></Field></div>
        <Field label={fields.order} error={errors.order}><input {...register("order", { valueAsNumber: true })} type="number" min="1" max="999" className="input-flat" /></Field>
        <label className="rounded-xl border border-line p-4 flex items-start gap-3 cursor-pointer"><input {...register("active")} type="checkbox" className="mt-0.5 w-5 h-5 accent-[#0F3D3E]" /><span><span className="block text-[13px] font-semibold">{copy.active}</span><span className="block text-[11px] text-inkSoft mt-1">{copy.drawerDescription}</span></span></label>
      </form>
    </AdminDrawer>
  );
}
