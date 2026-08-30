import { z } from "zod";

export const PARTNER_TYPES = ["guide", "rental", "homestay", "culinary", "souvenir"];
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
  culinary_categories: [],
  culinary_specialties: [],
  culinary_service_modes: [],
  culinary_dietary_tags: [],
  culinary_opening_info: "",
  culinary_reservation_note: "",
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
  culinary_categories: z.array(z.string().trim().min(1).max(80)).max(20),
  culinary_specialties: z.array(z.string().trim().min(1).max(120)).max(50),
  culinary_service_modes: z.array(z.string().trim().min(1).max(50)).max(10),
  culinary_dietary_tags: z.array(z.string().trim().min(1).max(50)).max(20),
  culinary_opening_info: z.string().trim().max(300),
  culinary_reservation_note: z.string().trim().max(300),
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
    culinary_categories: Array.isArray(partner.culinary_categories) ? partner.culinary_categories : [],
    culinary_specialties: Array.isArray(partner.culinary_specialties) ? partner.culinary_specialties : [],
    culinary_service_modes: Array.isArray(partner.culinary_service_modes) ? partner.culinary_service_modes : [],
    culinary_dietary_tags: Array.isArray(partner.culinary_dietary_tags) ? partner.culinary_dietary_tags : [],
    culinary_opening_info: partner.culinary_opening_info || "",
    culinary_reservation_note: partner.culinary_reservation_note || "",
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
    culinary_categories: values.culinary_categories.map((value) => value.trim()).filter(Boolean),
    culinary_specialties: values.culinary_specialties.map((value) => value.trim()).filter(Boolean),
    culinary_service_modes: values.culinary_service_modes.map((value) => value.trim()).filter(Boolean),
    culinary_dietary_tags: values.culinary_dietary_tags.map((value) => value.trim()).filter(Boolean),
    culinary_opening_info: values.culinary_opening_info.trim(),
    culinary_reservation_note: values.culinary_reservation_note.trim(),
  };
}
