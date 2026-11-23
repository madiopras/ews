export const DAY_ROUTE_COLORS = [
  "#0F3D3E",
  "#B94127",
  "#4F6047",
  "#B8860B",
  "#2C5E8A",
  "#7A3E65",
  "#2E7D6B",
];

export function dayRouteColor(dayNumber = 1) {
  const index = Math.max(0, Number(dayNumber) - 1) % DAY_ROUTE_COLORS.length;
  return DAY_ROUTE_COLORS[index];
}

export function hasValidCoordinates(destination) {
  if (!destination) return false;
  if (
    destination.latitude == null
    || destination.longitude == null
    || destination.latitude === ""
    || destination.longitude === ""
    || typeof destination.latitude === "boolean"
    || typeof destination.longitude === "boolean"
  ) {
    return false;
  }
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function buildRouteDays(days = [], destinations = [], lang = "id") {
  const destinationMap = new Map(
    (Array.isArray(destinations) ? destinations : []).map((item) => [item.id, item]),
  );

  if (Array.isArray(days) && days.length > 0) {
    return days
      .map((day) => {
        const stops = (day.stops || [])
          .map((stop, index) => {
            const destination = destinationMap.get(stop.destination_id);
            if (!hasValidCoordinates(destination)) return null;
            return {
              id: destination.id,
              order: index + 1,
              day: day.day,
              name: lang === "en" && destination.name_en ? destination.name_en : destination.name,
              location: destination.location || "",
              timeLabel: stop.time_label || "",
              latitude: Number(destination.latitude),
              longitude: Number(destination.longitude),
            };
          })
          .filter(Boolean);
        return {
          day: day.day,
          title: day.title || "",
          color: dayRouteColor(day.day),
          stops,
        };
      })
      .filter((day) => day.stops.length > 0);
  }

  const fallbackStops = (Array.isArray(destinations) ? destinations : [])
    .filter(hasValidCoordinates)
    .map((destination, index) => ({
      id: destination.id,
      order: index + 1,
      day: 1,
      name: lang === "en" && destination.name_en ? destination.name_en : destination.name,
      location: destination.location || "",
      timeLabel: "",
      latitude: Number(destination.latitude),
      longitude: Number(destination.longitude),
    }));

  if (!fallbackStops.length) return [];
  return [{ day: 1, title: "", color: dayRouteColor(1), stops: fallbackStops }];
}

export function buildGoogleMapsRouteUrl(stops = []) {
  const valid = (Array.isArray(stops) ? stops : []).filter(hasValidCoordinates);
  if (valid.length === 0) return "";
  if (valid.length === 1) {
    const point = `${valid[0].latitude},${valid[0].longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`;
  }
  const origin = `${valid[0].latitude},${valid[0].longitude}`;
  const destination = `${valid[valid.length - 1].latitude},${valid[valid.length - 1].longitude}`;
  const waypoints = valid
    .slice(1, -1)
    .slice(0, 8)
    .map((stop) => `${stop.latitude},${stop.longitude}`)
    .join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
