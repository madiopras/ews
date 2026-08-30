import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlannerResultGate from "./PlannerResultGate.jsx";

const result = {
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 1, budget_style: "budget", interests: [], lang: "id" },
  summary: "Perjalanan singkat.",
  days: [{ day: 1, title: "Hari 1", area_label: "", description: "", stops: [{ period: "flexible", time_label: "", destination_id: "dest-1", activity: "Berwisata", practical_tip: "" }] }],
  destination_ids: ["dest-1"],
  destinations: [],
  partner_matches: [],
  travel_notes: [],
  travel_tips: [],
  generated_at: "2026-08-29T10:00:00+00:00",
};

describe("PlannerResultGate", () => {
  let root;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });
  afterEach(async () => { await act(async () => root.unmount()); });

  test("keeps the legacy renderer when the feature is off", async () => {
    await act(async () => {
      root.render(<PlannerResultGate features={{}} result={result} renderStructured={() => <div>Structured</div>}><div>Legacy</div></PlannerResultGate>);
    });
    expect(document.body.textContent).toContain("Legacy");
    expect(document.querySelector('[data-planner-result-mode="legacy"]')).not.toBeNull();
  });

  test("renders v2 only when the feature, contract, and renderer are ready", async () => {
    await act(async () => {
      root.render(<PlannerResultGate features={{ planner_structured_results: { enabled: true } }} result={result} renderStructured={(value) => <div>{value.summary}</div>}><div>Legacy</div></PlannerResultGate>);
    });
    expect(document.body.textContent).toContain("Perjalanan singkat.");
    expect(document.body.textContent).not.toContain("Legacy");
    expect(document.querySelector('[data-planner-result-mode="structured"]')).not.toBeNull();
  });

  test("falls back to legacy if a structured renderer is not implemented yet", async () => {
    await act(async () => {
      root.render(<PlannerResultGate features={{ planner_structured_results: { enabled: true } }} result={result}><div>Legacy safe fallback</div></PlannerResultGate>);
    });
    expect(document.body.textContent).toContain("Legacy safe fallback");
  });
});
