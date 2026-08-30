import { canonicalTripUrl, socialTripUrl } from "./TripShareControls.jsx";

describe("trip canonical share URL", () => {
  test("uses the public frontend route instead of the API preview route", () => {
    expect(canonicalTripUrl("abc123", "https://wisatasumut.example/admin"))
      .toBe("https://wisatasumut.example/trip/abc123");
  });

  test("does not expose a URL before sharing is enabled", () => {
    expect(canonicalTripUrl(null, "https://wisatasumut.example"))
      .toBe("");
  });

  test("uses the backend preview URL for social crawlers", () => {
    expect(socialTripUrl("abc123", "https://api.wisatasumut.example"))
      .toBe("https://api.wisatasumut.example/api/share/abc123");
  });
});
