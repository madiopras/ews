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
});
