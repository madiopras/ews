import { canonicalTripUrl } from "./TripShareControls.jsx";

describe("trip canonical share URL", () => {
  test("uses the public frontend route instead of the API preview route", () => {
    expect(canonicalTripUrl("abc123", "https://wisatasumut.example/admin"))
      .toBe("https://wisatasumut.example/trip/abc123");
  });

  test("does not expose a URL before sharing is enabled", () => {
    expect(canonicalTripUrl(null, "https://wisatasumut.example"))
      .toBe("");
  });
});
