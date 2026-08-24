import { PLAN_DEFAULTS, planSchema, planToPayload } from "./planSchema.js";

describe("plan schema", () => {
  test("normalizes valid numeric plan fields", () => {
    const parsed = planSchema.parse({ ...PLAN_DEFAULTS, code: "trial_1m", label_id: "Coba 1 Bulan", label_en: "Trial 1 Month", months: "1", price: "99000", order: "2" });
    expect(planToPayload(parsed)).toMatchObject({ code: "trial_1m", months: 1, price: 99000, order: 2 });
  });

  test("rejects unsafe codes and invalid duration", () => {
    const result = planSchema.safeParse({ ...PLAN_DEFAULTS, code: "Invalid Code", label_id: "Paket", label_en: "Plan", months: 0 });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["code", "months"]));
  });
});
