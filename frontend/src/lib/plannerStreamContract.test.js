import { applyPlannerStreamEvent, consumePlannerSseStream, createPlannerStreamState } from "./plannerStreamContract.js";

const result = {
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 1, budget_style: "budget", interests: [], lang: "id" },
  summary: "Perjalanan singkat.",
  days: [{ day: 1, title: "Hari pertama", area_label: "Toba", description: "", stops: [{ period: "morning", time_label: "Pagi", destination_id: "dest-1", activity: "Menikmati alam.", practical_tip: "" }] }],
  destination_ids: ["dest-1"],
  destinations: [{ id: "dest-1", name: "Danau Toba", name_en: "Lake Toba", location: "Toba", category: "nature", images: [], description: "", description_en: "" }],
  partner_matches: [], travel_notes: [], travel_tips: [], generated_at: "2026-08-30T10:00:00+00:00",
};
const bytes = (value) => Uint8Array.from([...value].map((character) => character.charCodeAt(0)));

describe("Planner SSE V2 contract", () => {
  test("reduces progress, compatibility text, structured result, and done events", () => {
    let state = createPlannerStreamState();
    state = applyPlannerStreamEvent(state, { progress: { phase: "validating" } });
    state = applyPlannerStreamEvent(state, { text: "## Hari 1" });
    state = applyPlannerStreamEvent(state, { destination_ids: ["dest-1"], recommendations: [], result, result_format: "structured" });
    state = applyPlannerStreamEvent(state, { done: true, result_format: "structured" });
    expect(state).toMatchObject({
      progressPhase: "validating", output: "## Hari 1", destinationIds: ["dest-1"],
      result, resultFormat: "structured", completed: true, error: "",
    });
  });

  test("keeps a malformed or explicit fallback event in legacy mode", () => {
    let state = applyPlannerStreamEvent(createPlannerStreamState(), { result: { version: 2 }, result_format: "structured" });
    expect(state.resultFormat).toBe("legacy");
    state = applyPlannerStreamEvent(state, { text: "Legacy plan", result_format: "legacy", fallback: true });
    expect(state).toMatchObject({ output: "Legacy plan", result: null, resultFormat: "legacy" });
  });

  test("captures safe timeout and cancellation errors without accepting unknown progress", () => {
    let state = applyPlannerStreamEvent(createPlannerStreamState(), { progress: { phase: "provider-secret-step" } });
    state = applyPlannerStreamEvent(state, { error: "Trip generation took too long.", code: "planner_timeout" });
    expect(state.progressPhase).toBe("generating");
    expect(state.errorCode).toBe("planner_timeout");
    expect(state.error).toBe("Trip generation took too long.");
  });

  test("parses slow fragmented CRLF frames and the final frame without a delimiter", async () => {
    const chunks = [
      'data: {"text":"## Ha',
      'ri 1"}\r\n\r\n',
      'data: {"progress":{"phase":"validating"}}\n\n',
      'data: {"done":true,"result_format":"legacy"}',
    ].map(bytes);
    const reader = {
      read: jest.fn(async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true }),
      releaseLock: jest.fn(),
    };
    let state = createPlannerStreamState();
    const outcome = await consumePlannerSseStream({ getReader: () => reader }, (event) => {
      state = applyPlannerStreamEvent(state, event);
    });

    expect(outcome).toEqual({ completed: true, eventCount: 3 });
    expect(state).toMatchObject({ output: "## Hari 1", progressPhase: "validating", completed: true });
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  test("reports an incomplete stream without automatically reconnecting", async () => {
    const chunks = [bytes('data: {"text":"Partial itinerary"}\n\n')];
    const reader = {
      read: jest.fn(async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true }),
      releaseLock: jest.fn(),
    };
    const events = [];
    const outcome = await consumePlannerSseStream({ getReader: () => reader }, (event) => events.push(event));
    expect(outcome).toEqual({ completed: false, eventCount: 1 });
    expect(events[0].text).toBe("Partial itinerary");
    expect(reader.read).toHaveBeenCalledTimes(2);
  });
});
