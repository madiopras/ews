import { api } from "./api.js";
import { ANALYTICS_CONSENT_KEY, trackPlannerEvent } from "./partnerAnalytics.js";

jest.mock("./api.js", () => ({ api: { post: jest.fn() } }));

describe("trackPlannerEvent", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    api.post.mockReset();
    api.post.mockResolvedValue({ data: { accepted: true } });
  });

  test("does nothing without analytics consent", async () => {
    await expect(trackPlannerEvent("planner_step_shown", "story")).resolves.toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });

  test("sends only the whitelisted funnel fields after consent", async () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "granted");

    await expect(trackPlannerEvent("planner_generated", "result")).resolves.toBe(true);

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, payload, options] = api.post.mock.calls[0];
    expect(path).toBe("/analytics/planner-events");
    expect(payload).toEqual({
      event_id: expect.stringMatching(/^[A-Za-z0-9_-]{16,80}$/),
      event_type: "planner_generated",
      step: "result",
      anonymous_session_id: expect.stringMatching(/^[A-Za-z0-9_-]{16,80}$/),
    });
    expect(JSON.stringify(payload)).not.toContain("story");
    expect(options).toEqual({ headers: { "X-Analytics-Consent": "granted" } });
  });
});
