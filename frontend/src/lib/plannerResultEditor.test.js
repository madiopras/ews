import {
  moveStopInDay,
  removeStopFromResult,
  structuredResultToPlainMarkdown,
  swapStopDestination,
} from "./plannerResultEditor.js";
import { isPlannerResultV2 } from "./plannerResultContract.js";

const sampleResult = () => ({
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 2, budget_style: "mid_range", interests: ["nature"], lang: "id" },
  summary: "Ringkasan trip Sumut.",
  days: [
    {
      day: 1,
      title: "Hari Toba",
      area_label: "Toba",
      description: "Santai di tepi danau.",
      stops: [
        { period: "morning", time_label: "08.00", destination_id: "d1", activity: "Pagi di Danau Toba.", practical_tip: "" },
        { period: "afternoon", time_label: "14.00", destination_id: "d2", activity: "Sore di Bukit Holbung.", practical_tip: "" },
      ],
    },
    {
      day: 2,
      title: "Hari Berastagi",
      area_label: "Karo",
      description: "Udara sejuk.",
      stops: [
        { period: "morning", time_label: "09.00", destination_id: "d3", activity: "Air Terjun Sipiso-piso.", practical_tip: "" },
      ],
    },
  ],
  destination_ids: ["d1", "d2", "d3"],
  destinations: [
    { id: "d1", name: "Danau Toba", name_en: "Lake Toba", location: "Parapat", category: "lake", images: [], description: "Danau.", description_en: "" },
    { id: "d2", name: "Bukit Holbung", name_en: "Holbung Hill", location: "Samosir", category: "viewpoint", images: [], description: "Bukit.", description_en: "" },
    { id: "d3", name: "Sipiso-piso", name_en: "Sipiso-piso", location: "Karo", category: "waterfall", images: [], description: "Air terjun.", description_en: "" },
  ],
  partner_matches: [
    {
      partner_id: "p1",
      type: "guide",
      destination_ids: ["d2"],
      offering_ids: [],
      match_reasons: ["Melayani destinasi ini"],
      placement: "organic",
      partner: {
        id: "p1",
        business_name: "Guide Holbung",
        type: "guide",
        whatsapp: "628123456789",
        city: "Samosir",
        description: "Pemandu lokal.",
        image: "",
        service_tags: [],
        is_premium: false,
        promotional_disclosure: null,
        accepting_contacts: true,
      },
    },
  ],
  travel_notes: ["Bawa jaket."],
  travel_tips: ["Berangkat pagi."],
  generated_at: "2026-11-23T08:00:00+00:00",
});

describe("plannerResultEditor", () => {
  test("reorders stops within a day while keeping valid V2 contract", () => {
    const moved = moveStopInDay(sampleResult(), 1, 0, 1);
    expect(moved.days[0].stops.map((s) => s.destination_id)).toEqual(["d2", "d1"]);
    expect(moved.destination_ids).toEqual(["d2", "d1", "d3"]);
    expect(isPlannerResultV2(moved)).toBe(true);
  });

  test("removes a stop, prunes orphaned destinations and partner matches, and refuses removing last stop", () => {
    const removed = removeStopFromResult(sampleResult(), 1, 1);
    expect(removed.days[0].stops).toHaveLength(1);
    expect(removed.destination_ids).toEqual(["d1", "d3"]);
    expect(removed.partner_matches).toEqual([]);
    expect(isPlannerResultV2(removed)).toBe(true);

    const unchanged = removeStopFromResult(removed, 2, 0);
    expect(unchanged.days[1].stops).toHaveLength(1);
  });

  test("swaps a stop destination with a catalog alternative and generates matching markdown", () => {
    const swapped = swapStopDestination(
      sampleResult(),
      1,
      1,
      {
        id: "d4",
        name: "Bukit Sibea-bea",
        name_en: "Sibea-bea Hill",
        location: "Samosir",
        category: "viewpoint",
        images: [],
        description: "Jalan berkelok dengan panorama Danau Toba.",
        latitude: 2.55,
        longitude: 98.66,
      },
      "id",
    );
    expect(swapped.days[0].stops[1].destination_id).toBe("d4");
    expect(swapped.destination_ids).toEqual(["d1", "d4", "d3"]);
    expect(isPlannerResultV2(swapped)).toBe(true);
    const md = structuredResultToPlainMarkdown(swapped, "id");
    expect(md).toContain("Bukit Sibea-bea");
    expect(md).not.toContain("Bukit Holbung");
  });
});
