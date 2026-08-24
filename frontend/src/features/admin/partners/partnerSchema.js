import { z } from "zod";

export const PARTNER_TYPES = ["guide", "rental", "homestay", "souvenir"];
export const PARTNER_DEFAULTS = {
  business_name: "",
  type: "guide",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  description: "",
  destination_ids: [],
  service_tags: [],
  image: "",
};

export const partnerSchema = z.object({
  business_name: z.string().trim().min(2, "Nama usaha minimal 2 karakter").max(120),
  type: z.enum(PARTNER_TYPES),
  whatsapp: z.string().trim().refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 20;
  }, "Nomor WhatsApp harus berisi 8–20 digit"),
  email: z.union([z.literal(""), z.string().trim().email("Email tidak valid")]),
  address: z.string().trim().max(300),
  city: z.string().trim().min(2, "Kota minimal 2 karakter").max(120),
  description: z.string().trim().min(10, "Deskripsi minimal 10 karakter").max(1000),
  destination_ids: z.array(z.string()).max(100),
  service_tags: z.array(z.string().trim().min(1).max(40)).max(20),
  image: z.union([z.literal(""), z.string().url("URL gambar tidak valid")]),
});

export function partnerToForm(partner) {
  if (!partner) return { ...PARTNER_DEFAULTS };
  return {
    ...PARTNER_DEFAULTS,
    ...partner,
    email: partner.email || "",
    address: partner.address || "",
    image: partner.image || "",
    destination_ids: Array.isArray(partner.destination_ids) ? partner.destination_ids : [],
    service_tags: Array.isArray(partner.service_tags) ? partner.service_tags : [],
  };
}

export function partnerToPayload(values) {
  return {
    business_name: values.business_name.trim(),
    type: values.type,
    whatsapp: values.whatsapp.replace(/\D/g, ""),
    email: values.email.trim() || null,
    address: values.address.trim(),
    city: values.city.trim(),
    description: values.description.trim(),
    destination_ids: values.destination_ids,
    service_tags: [...new Set(values.service_tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    image: values.image.trim(),
  };
}
