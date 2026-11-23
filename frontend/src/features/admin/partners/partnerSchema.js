import { z } from "zod";
import { ALL_PARTNER_TYPES, EMPTY_TYPE_FIELDS } from "../../../components/PartnerTypeFields.jsx";

export const PARTNER_TYPES = ALL_PARTNER_TYPES;

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
  ...EMPTY_TYPE_FIELDS,
};

const optionalUrl = z.union([z.literal(""), z.string().trim().url("URL tidak valid")]);
const strList = (maxLen, maxItems) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);

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
  service_tags: strList(40, 20),
  image: optionalUrl,
  instagram_url: optionalUrl,
  google_maps_url: optionalUrl,
  guide_languages: strList(50, 20),
  guide_specialties: strList(80, 20),
  guide_license_number: z.string().trim().max(100),
  guide_experience_years: z.coerce.number().int().min(0).max(80),
  guide_max_group_size: z.coerce.number().int().min(0).max(500),
  rental_vehicle_types: strList(80, 30),
  rental_service_options: strList(60, 15),
  rental_pickup_areas: strList(80, 30),
  rental_driver_available: z.boolean(),
  rental_fleet_size: z.coerce.number().int().min(0).max(10000),
  accommodation_subtype: z.enum(["", "homestay", "hotel", "villa", "resort", "glamping"]),
  homestay_room_types: strList(80, 30),
  homestay_room_count: z.coerce.number().int().min(0).max(10000),
  homestay_max_guests: z.coerce.number().int().min(0).max(500),
  homestay_facilities: strList(80, 30),
  homestay_checkin_info: z.string().trim().max(300),
  souvenir_categories: strList(80, 20),
  souvenir_products: strList(100, 50),
  souvenir_delivery_available: z.boolean(),
  souvenir_packaging_note: z.string().trim().max(300),
  souvenir_shop_hours: z.string().trim().max(200),
  culinary_categories: strList(80, 20),
  culinary_specialties: strList(120, 50),
  culinary_service_modes: strList(50, 10),
  culinary_dietary_tags: strList(50, 20),
  culinary_opening_info: z.string().trim().max(300),
  culinary_reservation_note: z.string().trim().max(300),
  tour_trip_types: strList(80, 20),
  tour_inclusions: strList(80, 30),
  tour_min_pax: z.coerce.number().int().min(0).max(500),
  tour_max_pax: z.coerce.number().int().min(0).max(1000),
  tour_departure_hubs: strList(80, 20),
  tour_license_number: z.string().trim().max(100),
  activity_categories: strList(80, 20),
  activity_difficulty: z.enum(["", "beginner", "moderate", "challenging"]),
  activity_duration_info: z.string().trim().max(200),
  activity_equipment_included: z.boolean(),
  activity_min_age: z.coerce.number().int().min(0).max(100),
  activity_safety_note: z.string().trim().max(300),
});

export function partnerToForm(partner) {
  if (!partner) return { ...PARTNER_DEFAULTS };
  const merged = { ...PARTNER_DEFAULTS };
  Object.keys(merged).forEach((key) => {
    const incoming = partner[key];
    if (Array.isArray(merged[key])) {
      merged[key] = Array.isArray(incoming) ? incoming : [];
    } else if (typeof merged[key] === "boolean") {
      merged[key] = Boolean(incoming);
    } else if (typeof merged[key] === "number") {
      merged[key] = Number(incoming) || 0;
    } else {
      merged[key] = incoming ?? merged[key];
    }
  });
  return merged;
}

const cleanList = (values) =>
  Array.isArray(values) ? [...new Set(values.map((v) => String(v).trim()).filter(Boolean))] : [];

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
    instagram_url: (values.instagram_url || "").trim(),
    google_maps_url: (values.google_maps_url || "").trim(),
    guide_languages: cleanList(values.guide_languages),
    guide_specialties: cleanList(values.guide_specialties),
    guide_license_number: (values.guide_license_number || "").trim(),
    guide_experience_years: Number(values.guide_experience_years) || 0,
    guide_max_group_size: Number(values.guide_max_group_size) || 0,
    rental_vehicle_types: cleanList(values.rental_vehicle_types),
    rental_service_options: cleanList(values.rental_service_options),
    rental_pickup_areas: cleanList(values.rental_pickup_areas),
    rental_driver_available: Boolean(values.rental_driver_available),
    rental_fleet_size: Number(values.rental_fleet_size) || 0,
    accommodation_subtype: values.accommodation_subtype || "",
    homestay_room_types: cleanList(values.homestay_room_types),
    homestay_room_count: Number(values.homestay_room_count) || 0,
    homestay_max_guests: Number(values.homestay_max_guests) || 0,
    homestay_facilities: cleanList(values.homestay_facilities),
    homestay_checkin_info: (values.homestay_checkin_info || "").trim(),
    souvenir_categories: cleanList(values.souvenir_categories),
    souvenir_products: cleanList(values.souvenir_products),
    souvenir_delivery_available: Boolean(values.souvenir_delivery_available),
    souvenir_packaging_note: (values.souvenir_packaging_note || "").trim(),
    souvenir_shop_hours: (values.souvenir_shop_hours || "").trim(),
    culinary_categories: cleanList(values.culinary_categories),
    culinary_specialties: cleanList(values.culinary_specialties),
    culinary_service_modes: cleanList(values.culinary_service_modes),
    culinary_dietary_tags: cleanList(values.culinary_dietary_tags),
    culinary_opening_info: (values.culinary_opening_info || "").trim(),
    culinary_reservation_note: (values.culinary_reservation_note || "").trim(),
    tour_trip_types: cleanList(values.tour_trip_types),
    tour_inclusions: cleanList(values.tour_inclusions),
    tour_min_pax: Number(values.tour_min_pax) || 0,
    tour_max_pax: Number(values.tour_max_pax) || 0,
    tour_departure_hubs: cleanList(values.tour_departure_hubs),
    tour_license_number: (values.tour_license_number || "").trim(),
    activity_categories: cleanList(values.activity_categories),
    activity_difficulty: values.activity_difficulty || "",
    activity_duration_info: (values.activity_duration_info || "").trim(),
    activity_equipment_included: Boolean(values.activity_equipment_included),
    activity_min_age: Number(values.activity_min_age) || 0,
    activity_safety_note: (values.activity_safety_note || "").trim(),
  };
}
