import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ItineraryResult from "./ItineraryResult.jsx";

jest.mock("../../lib/markdown.jsx", () => ({ renderMarkdown: (value) => <div data-testid="legacy-markdown">{value}</div> }));
jest.mock("./StructuredPlannerResult.jsx", () => ({ result }) => <div data-testid="v2-result">{result.summary}</div>);

const structured = {
  version: 2, result_format: "structured",
  request_snapshot: { days: 1, budget_style: "budget", interests: [], lang: "id" },
  summary: "Ringkasan V2",
  days: [{ day: 1, title: "Hari 1", area_label: "", description: "", stops: [{ period: "flexible", time_label: "", destination_id: "dest-1", activity: "Jalan", practical_tip: "" }] }],
  destination_ids: ["dest-1"], destinations: [], partner_matches: [], travel_notes: [], travel_tips: [],
  generated_at: "2026-08-30T10:00:00+00:00",
};

describe("ItineraryResult shared renderer", () => {
  let root;
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")); });
  afterEach(async () => act(async () => root.unmount()));

  test("keeps legacy itinerary content readable", async () => {
    await act(async () => root.render(<ItineraryResult trip={{ content: "## Hari 1", lang: "id" }} t={{}} lang="id" />));
    expect(document.querySelector('[data-testid="legacy-markdown"]')).not.toBeNull();
    expect(document.querySelector("article").getAttribute("data-result-version")).toBe("1");
  });

  test("renders a valid hydrated V2 result", async () => {
    await act(async () => root.render(<ItineraryResult trip={{ content: "fallback", structured_result: structured }} t={{}} lang="id" />));
    expect(document.body.textContent).toContain("Ringkasan V2");
    expect(document.querySelector('[data-testid="legacy-markdown"]')).toBeNull();
    expect(document.querySelector("article").getAttribute("data-result-version")).toBe("2");
  });

  test("falls back to content when the stored V2 payload is invalid", async () => {
    await act(async () => root.render(<ItineraryResult trip={{ content: "Fallback aman", result_version: 2, structured_result: { version: 2 } }} t={{ savedTrips: { structuredFallback: "Kartu bermasalah" } }} lang="id" />));
    expect(document.body.textContent).toContain("Fallback aman");
    expect(document.body.textContent).toContain("Kartu bermasalah");
    expect(document.querySelector("article").getAttribute("data-structured-invalid")).toBe("true");
  });
});
