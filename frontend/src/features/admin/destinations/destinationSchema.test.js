import {
  DESTINATION_DEFAULTS,
  destinationSchema,
  destinationToForm,
  destinationToPayload,
} from "./destinationSchema.js";

describe("destination schema", () => {
  const valid = {
    ...DESTINATION_DEFAULTS,
    name: "Danau Toba",
    location: "Kabupaten Toba",
    description: "Danau vulkanik terbesar dengan panorama yang indah.",
    images: ["https://example.com/toba.webp"],
  };

  test("normalizes numeric and text values for the API", () => {
    const parsed = destinationSchema.parse({ ...valid, price: "15000", latitude: "2.6", longitude: "98.8" });
    const payload = destinationToPayload({ ...parsed, name: "  Danau Toba  " });
    expect(payload.name).toBe("Danau Toba");
    expect(payload.price).toBe(15000);
    expect(payload.latitude).toBe(2.6);
    expect(payload.images).toHaveLength(1);
  });

  test("rejects invalid coordinates, negative prices, and short descriptions", () => {
    const result = destinationSchema.safeParse({ ...valid, price: -1, latitude: 91, description: "singkat" });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["price", "latitude", "description"]));
  });

  test("maps incomplete API data to safe form defaults", () => {
    expect(destinationToForm({ id: "1", name: "Toba", images: null })).toMatchObject({
      name: "Toba",
      category: "nature",
      images: [],
      is_active: true,
    });
  });

  test("allows destinations without a price and normalizes editorial tags", () => {
    const parsed = destinationSchema.parse({
      ...valid,
      price: null,
      tags: ["  Keluarga ", "keluarga", "Pemandangan"],
      source_url: "https://instagram.com/explorewisatasumut",
      editorial_reviewed_at: "2026-08-24",
    });
    const payload = destinationToPayload(parsed);
    expect(payload.price).toBeNull();
    expect(payload.tags).toEqual(["keluarga", "pemandangan"]);
    expect(payload.editorial_reviewed_at).toBe("2026-08-24");
  });
});
