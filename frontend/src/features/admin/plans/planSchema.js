import { z } from "zod";

export const PLAN_DEFAULTS = { code: "", label_id: "", label_en: "", months: 1, price: 99000, active: true, order: 1 };

export const planSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi").max(20).regex(/^[a-z0-9][a-z0-9_-]*$/, "Format kode tidak valid"),
  label_id: z.string().trim().min(1, "Nama Indonesia wajib diisi").max(100),
  label_en: z.string().trim().min(1, "Nama Inggris wajib diisi").max(100),
  months: z.coerce.number().int().min(1).max(36),
  price: z.coerce.number().int().min(0),
  active: z.boolean(),
  order: z.coerce.number().int().min(1).max(999),
});

export function planToForm(plan) {
  return plan ? { ...PLAN_DEFAULTS, ...plan } : { ...PLAN_DEFAULTS };
}

export function planToPayload(values) {
  return { ...values, code: values.code.trim(), label_id: values.label_id.trim(), label_en: values.label_en.trim(), months: Number(values.months), price: Number(values.price), order: Number(values.order) };
}
