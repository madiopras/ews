import { groupPlannerRecommendations } from "./plannerRecommendationGroups.js";

const recommendation = (overrides = {}) => ({
  partner_id: "partner-1",
  type: "guide",
  destination_id: "dest-1",
  destination_name: "Danau Toba",
  match_reasons: ["Melayani destinasi ini"],
  placement: "organic",
  partner: { id: "partner-1", type: "guide", business_name: "Pemandu Toba" },
  ...overrides,
});

describe("Planner recommendation grouping", () => {
  test("deduplicates a partner and merges its destination context", () => {
    const groups = groupPlannerRecommendations([
      recommendation(),
      recommendation({ destination_id: "dest-2", destination_name: "Bukit Holbung", match_reasons: ["Cocok untuk keluarga"] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].destination_ids).toEqual(["dest-1", "dest-2"]);
    expect(groups[0].items[0].destination_names).toEqual(["Danau Toba", "Bukit Holbung"]);
  });

  test("omits empty groups and culinary until its feature is enabled", () => {
    const culinary = recommendation({
      partner_id: "food-1",
      type: "culinary",
      partner: { id: "food-1", type: "culinary", business_name: "Kuliner Lokal" },
    });
    expect(groupPlannerRecommendations([culinary])).toEqual([]);
    expect(groupPlannerRecommendations([culinary], { includeCulinary: true }).map((group) => group.type)).toEqual(["culinary"]);
  });

  test("enforces a maximum of two cards per type and eight globally", () => {
    const types = ["guide", "rental", "homestay", "souvenir"];
    const rows = types.flatMap((type) => Array.from({ length: 3 }, (_, index) => recommendation({
      partner_id: `${type}-${index}`,
      type,
      partner: { id: `${type}-${index}`, type, business_name: `${type} ${index}` },
    })));
    const groups = groupPlannerRecommendations(rows);
    expect(groups.every((group) => group.items.length === 2)).toBe(true);
    expect(groups.flatMap((group) => group.items)).toHaveLength(8);
  });
});
