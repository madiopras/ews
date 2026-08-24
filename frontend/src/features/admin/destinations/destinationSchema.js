import { z } from "zod";

export const DESTINATION_DEFAULTS = {
  name: "",
  name_en: "",
  location: "",
  category: "nature",
  price: null,
  description: "",
  description_en: "",
  tags: [],
  source_label: "Explore Wisata Sumut",
  source_url: "",
  editorial_reviewed_at: "",
  images: [],
  video: "",
  latitude: 2.654,
  longitude: 98.8756,
  featured: false,
  is_active: true,
};

const optionalUrl = z.union([
  z.literal(""),
  z.string().trim().url("URL video tidak valid"),
]);

export const destinationSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(150),
  name_en: z.string().trim().max(150),
  location: z.string().trim().min(2, "Lokasi minimal 2 karakter").max(200),
  category: z.string().min(1, "Kategori wajib dipilih"),
  price: z.union([z.null(), z.coerce.number().min(0)]).optional(),
  description: z.string().trim().min(10, "Deskripsi minimal 10 karakter").max(5000),
  description_en: z.string().trim().max(5000),
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  source_label: z.string().trim().max(200),
  source_url: optionalUrl,
  editorial_reviewed_at: z.string().max(40),
  images: z.array(z.string().url("URL gambar tidak valid")).max(5, "Maksimal 5 gambar"),
  video: optionalUrl,
  latitude: z.coerce.number({ invalid_type_error: "Latitude harus berupa angka" }).min(-90).max(90),
  longitude: z.coerce.number({ invalid_type_error: "Longitude harus berupa angka" }).min(-180).max(180),
  featured: z.boolean(),
  is_active: z.boolean(),
});

export function destinationToForm(destination) {
  if (!destination) return { ...DESTINATION_DEFAULTS };
  return {
    ...DESTINATION_DEFAULTS,
    ...destination,
    images: Array.isArray(destination.images) ? destination.images.slice(0, 5) : [],
    video: destination.video || "",
    tags: Array.isArray(destination.tags) ? destination.tags : [],
    source_label: destination.source_label || "Explore Wisata Sumut",
    source_url: destination.source_url || "",
    editorial_reviewed_at: destination.editorial_reviewed_at?.slice(0, 10) || "",
  };
}

export function destinationToPayload(values) {
  return {
    ...values,
    name: values.name.trim(),
    name_en: values.name_en.trim(),
    location: values.location.trim(),
    description: values.description.trim(),
    description_en: values.description_en.trim(),
    video: values.video.trim(),
    price: values.price === null || values.price === "" || values.price === undefined ? null : Number(values.price),
    tags: [...new Set(values.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    source_label: values.source_label.trim(),
    source_url: values.source_url.trim(),
    editorial_reviewed_at: values.editorial_reviewed_at,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    images: values.images.slice(0, 5),
  };
}
