import {
  DEFAULT_PLANNER_RESULT_FEATURES,
  PLANNER_RESULT_FORMAT,
  isPlannerResultV2,
  normalizePlannerResultFeatures,
  hydratedDestinationsFromTrip,
  plannerResultForStorage,
  selectPlannerResultMode,
} from "./plannerResultContract.js";

const validResult = () => ({
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 2, budget_style: "mid_range", interests: ["nature"], lang: "id" },
  summary: "Perjalanan alam yang santai.",
  days: [
    {
      day: 1,
      title: "Hari pertama",
      area_label: "Toba",
      description: "Mulai dengan santai.",
      stops: [{ period: "morning", time_label: "Pagi", destination_id: "dest-1", activity: "Menikmati alam.", practical_tip: "Bawa air minum." }],
    },
  ],
  destination_ids: ["dest-1"],
  destinations: [{ id: "dest-1", name: "Danau", name_en: "Lake", location: "Toba", category: "nature", images: [], description: "Alam", description_en: "Nature" }],
  partner_matches: [],
  travel_notes: [],
  travel_tips: [],
  generated_at: "2026-08-29T10:00:00+00:00",
});

describe("Planner Result V2 frontend contract", () => {
  test("accepts a valid structured result", () => {
    const value = validResult();
    value.destinations[0].latitude = 2.61;
    value.destinations[0].longitude = 98.88;
    expect(isPlannerResultV2(value)).toBe(true);
    expect(hydratedDestinationsFromTrip({ structured_result: value })).toBe(value.destinations);
    expect(hydratedDestinationsFromTrip({ content: "legacy" })).toBeNull();
  });

  test("counts Unicode code points like the backend when text contains emoji", () => {
    const value = validResult();
    value.partner_matches = [{
      partner_id: "partner-1", type: "rental", destination_ids: ["dest-1"], offering_ids: [],
      match_reasons: ["Sesuai rute"], relevance_score: 70, match_factor_codes: ["destination_coverage"], placement: "organic",
      partner: {
        id: "partner-1", business_name: "Rental lokal", type: "rental", whatsapp: "628123456789",
        city: "Medan", description: `${"a".repeat(599)}🚗`, image: "", service_tags: [],
        is_premium: false, promotional_disclosure: null, accepting_contacts: true,
      },
    }];

    expect(value.partner_matches[0].partner.description.length).toBe(601);
    expect(Array.from(value.partner_matches[0].partner.description)).toHaveLength(600);
    expect(isPlannerResultV2(value)).toBe(true);

    value.partner_matches[0].partner.description = `${"a".repeat(600)}🚗`;
    expect(isPlannerResultV2(value)).toBe(false);
  });

  test("rejects unknown stop destinations and duplicate days", () => {
    const unknownDestination = validResult();
    unknownDestination.days[0].stops[0].destination_id = "not-allowed";
    expect(isPlannerResultV2(unknownDestination)).toBe(false);

    const duplicateDays = validResult();
    duplicateDays.days.push({ ...duplicateDays.days[0] });
    expect(isPlannerResultV2(duplicateDays)).toBe(false);
  });

  test("defaults all new result features to off", () => {
    expect(normalizePlannerResultFeatures(null)).toEqual(DEFAULT_PLANNER_RESULT_FEATURES);
  });

  test("uses structured mode only for an enabled and valid v2 result", () => {
    const enabled = { planner_structured_results: { enabled: true } };
    expect(selectPlannerResultMode(enabled, validResult())).toBe(PLANNER_RESULT_FORMAT.STRUCTURED);
    expect(selectPlannerResultMode({}, validResult())).toBe(PLANNER_RESULT_FORMAT.LEGACY);
    expect(selectPlannerResultMode(enabled, { version: 2 })).toBe(PLANNER_RESULT_FORMAT.LEGACY);
  });

  test("creates a persistence payload containing IDs but no hydrated contact snapshots", () => {
    const value = validResult();
    value.partner_matches = [{
      partner_id: "partner-1", type: "guide", destination_ids: ["dest-1"], offering_ids: [],
      match_reasons: ["Relevant"], placement: "organic",
      partner: {
        id: "partner-1", business_name: "Private snapshot", type: "guide", whatsapp: "628123456789",
        city: "Toba", description: "Current DB value", image: "", service_tags: [], is_premium: false,
        promotional_disclosure: null, accepting_contacts: true,
      },
    }];
    const stored = plannerResultForStorage(value);
    expect(stored.destination_ids).toEqual(["dest-1"]);
    expect(stored.partner_matches[0]).toEqual(expect.objectContaining({ partner_id: "partner-1" }));
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain("whatsapp");
    expect(serialized).not.toContain("business_name");
    expect(serialized).not.toContain("destinations");
  });
});
