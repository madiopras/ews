import { extractPlannerPreferences, nextPlannerStep, PLANNER_NEXT_STEP } from "./plannerPreferenceExtractor.js";

describe("planner preference extractor", () => {
  test("extracts explicit Indonesian trip preferences", () => {
    expect(extractPlannerPreferences("Saya ingin liburan 3 hari yang nyaman, suka alam dan kuliner.")).toEqual({
      days: 3,
      budget_style: "mid_range",
      interests: ["culinary", "nature"],
      confidence: { days: "high", budget_style: "high", interests: "high" },
    });
  });

  test("extracts explicit English trip preferences", () => {
    expect(extractPlannerPreferences("Plan a 4-day luxury trip with beaches and hiking.")).toEqual({
      days: 4,
      budget_style: "luxury",
      interests: ["beach", "mountain"],
      confidence: { days: "high", budget_style: "high", interests: "high" },
    });
  });

  test("keeps partial stories partial instead of inventing details", () => {
    const preferences = extractPlannerPreferences("Weekend santai sambil minum kopi.");
    expect(preferences.days).toBeNull();
    expect(preferences.budget_style).toBeNull();
    expect(preferences.interests).toEqual(["culinary"]);
    expect(nextPlannerStep(preferences)).toBe(PLANNER_NEXT_STEP.BASICS);
  });

  test("does not turn numeric rupiah amounts into a travel style", () => {
    const preferences = extractPlannerPreferences("3 hari dengan budget Rp2.000.000 dan ingin budaya.");
    expect(preferences).toMatchObject({
      days: 3,
      budget_style: null,
      interests: ["culture"],
      confidence: { budget_style: "none" },
    });
    expect(nextPlannerStep(preferences)).toBe(PLANNER_NEXT_STEP.BASICS);
  });

  test("rejects out-of-range or conflicting values as ambiguous input", () => {
    expect(extractPlannerPreferences("15 hari dengan gaya hemat dan suka danau.")).toMatchObject({
      days: null,
      budget_style: "budget",
      interests: ["lake"],
      confidence: { days: "invalid" },
    });
    expect(extractPlannerPreferences("3 hari atau 4 hari, hemat atau nyaman.")).toMatchObject({
      days: null,
      budget_style: null,
      confidence: { days: "ambiguous", budget_style: "ambiguous" },
    });
  });

  test("chooses the next wizard step from only missing required slots", () => {
    expect(nextPlannerStep({ days: 3, budget_style: "budget", interests: [] })).toBe(PLANNER_NEXT_STEP.INTERESTS);
    expect(nextPlannerStep({ days: 3, budget_style: "budget", interests: ["nature"] })).toBe(PLANNER_NEXT_STEP.GENERATE);
  });
});
