import { PARTNER_DEFAULTS, partnerSchema, partnerToForm, partnerToPayload } from "./partnerSchema.js";

describe("partner schema", () => {
  const valid = {
    ...PARTNER_DEFAULTS,
    business_name: "Horas Tour",
    whatsapp: "+62 812-3456-7890",
    city: "Medan",
    description: "Menyediakan layanan pemandu wisata profesional.",
  };

  test("normalizes contact and optional email for the API", () => {
    const parsed = partnerSchema.parse(valid);
    expect(partnerToPayload(parsed)).toMatchObject({ whatsapp: "6281234567890", email: null, service_tags: [] });
  });

  test("rejects short contact and description values", () => {
    const result = partnerSchema.safeParse({ ...valid, whatsapp: "123", description: "pendek" });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["whatsapp", "description"]));
  });

  test("maps nullable API fields to controlled form values", () => {
    expect(partnerToForm({ business_name: "Test", email: null, destination_ids: null })).toMatchObject({ email: "", destination_ids: [], type: "guide" });
  });

  test("accepts and normalizes the independent culinary partner type", () => {
    const parsed = partnerSchema.parse({
      ...valid,
      type: "culinary",
      culinary_categories: [" Rumah makan "],
      culinary_specialties: [" Arsik ", "Kopi Lintong"],
      culinary_service_modes: ["Dine-in", "Takeaway"],
      culinary_dietary_tags: ["Tanya bahan langsung"],
      culinary_opening_info: " Buka setiap hari ",
      culinary_reservation_note: " Hubungi untuk rombongan ",
    });
    expect(partnerToPayload(parsed)).toMatchObject({
      type: "culinary",
      culinary_categories: ["Rumah makan"],
      culinary_specialties: ["Arsik", "Kopi Lintong"],
      culinary_opening_info: "Buka setiap hari",
    });
  });

  test("keeps culinary and souvenir as separate partner types", () => {
    expect(partnerSchema.parse({ ...valid, type: "culinary" }).type).toBe("culinary");
    expect(partnerSchema.parse({ ...valid, type: "souvenir" }).type).toBe("souvenir");
  });
});
