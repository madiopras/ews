import { isTravelStyle, travelStyleFromLegacyBudget, travelStyleLabel, travelStyleOptions } from "./travelStyle.js";

describe("travel style contract", () => {
  test("exposes exactly the supported travel styles with Indonesian copy", () => {
    expect(travelStyleOptions("id")).toEqual([
      { value: "budget", label: "Hemat", description: "Pengalaman esensial" },
      { value: "mid_range", label: "Nyaman", description: "Seimbang dan fleksibel" },
      { value: "luxury", label: "Mewah", description: "Kenyamanan lebih premium" },
    ]);
  });

  test("rejects unsupported values and labels English values", () => {
    expect(isTravelStyle("premium")).toBe(false);
    expect(travelStyleLabel("mid_range", "en")).toBe("Mid-range");
  });

  test("maps legacy numeric budgets only for backwards compatibility", () => {
    expect(travelStyleFromLegacyBudget(500000, 1)).toBe("budget");
    expect(travelStyleFromLegacyBudget(1500000, 2)).toBe("mid_range");
    expect(travelStyleFromLegacyBudget(3000000, 1)).toBe("luxury");
  });
});
