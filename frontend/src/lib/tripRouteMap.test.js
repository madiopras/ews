import { buildGoogleMapsRouteUrl, buildRouteDays } from "./tripRouteMap.js";

describe("tripRouteMap helpers", () => {
  const destinations = [
    { id: "d1", name: "Danau Toba", name_en: "Lake Toba", location: "Parapat", latitude: 2.66, longitude: 98.94 },
    { id: "d2", name: "Bukit Holbung", name_en: "Holbung Hill", location: "Samosir", latitude: 2.53, longitude: 98.71 },
    { id: "d3", name: "Tanpa Koordinat", location: "Medan", latitude: null, longitude: null },
  ];

  test("groups valid stops per day and skips stops without coordinates", () => {
    const days = [
      { day: 1, title: "Toba", stops: [{ destination_id: "d1", time_label: "08.00" }, { destination_id: "d3" }] },
      { day: 2, title: "Samosir", stops: [{ destination_id: "d2", time_label: "15.00" }] },
    ];
    const routeDays = buildRouteDays(days, destinations, "en");
    expect(routeDays).toHaveLength(2);
    expect(routeDays[0].stops).toHaveLength(1);
    expect(routeDays[0].stops[0].name).toBe("Lake Toba");
    expect(routeDays[1].stops[0].name).toBe("Holbung Hill");
    expect(routeDays[0].color).not.toBe(routeDays[1].color);
  });

  test("builds Google Maps search and multi-stop directions URLs", () => {
    const single = buildGoogleMapsRouteUrl([destinations[0]]);
    expect(single).toContain("google.com/maps/search/?api=1&query=");
    expect(single).toContain("2.66%2C98.94");

    const multi = buildGoogleMapsRouteUrl([
      destinations[0],
      { id: "d-mid", latitude: 2.6, longitude: 98.8 },
      destinations[1],
    ]);
    expect(multi).toContain("google.com/maps/dir/?");
    expect(multi).toContain("origin=2.66%2C98.94");
    expect(multi).toContain("destination=2.53%2C98.71");
    expect(multi).toContain("waypoints=2.6%2C98.8");
  });
});
