import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { buildRouteDays } from "../lib/tripRouteMap.js";

function numberedIcon(order, color) {
  return L.divIcon({
    className: "ews-route-marker",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#FAF6EE;font-weight:700;font-size:12px;border:2px solid #FFFFFF;box-shadow:0 4px 10px rgba(5,31,31,0.28);">${order}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitRouteBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 11, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13, animate: false });
  }, [map, points]);

  return null;
}

export default function TripMap({
  destinations = [],
  days = [],
  activeDay = 0,
  center = [2.95, 99.06],
  lang = "id",
}) {
  const routeDays = useMemo(() => buildRouteDays(days, destinations, lang), [days, destinations, lang]);
  const visibleDays = useMemo(
    () => (activeDay > 0 ? routeDays.filter((item) => item.day === activeDay) : routeDays),
    [activeDay, routeDays],
  );
  const allPoints = useMemo(
    () => visibleDays.flatMap((day) => day.stops.map((stop) => [stop.latitude, stop.longitude])),
    [visibleDays],
  );
  const initialCenter = allPoints[0] || center;

  return (
    <MapContainer center={initialCenter} zoom={8} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitRouteBounds points={allPoints} />
      {visibleDays.map((day) => {
        const positions = day.stops.map((stop) => [stop.latitude, stop.longitude]);
        return (
          <React.Fragment key={`route-day-${day.day}`}>
            {positions.length > 1 && (
              <Polyline
                positions={positions}
                pathOptions={{ color: day.color, weight: 3.5, opacity: 0.85, dashArray: "6 6" }}
              />
            )}
            {day.stops.map((stop) => (
              <Marker
                key={`day-${day.day}-stop-${stop.order}-${stop.id}`}
                position={[stop.latitude, stop.longitude]}
                icon={numberedIcon(stop.order, day.color)}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold text-inkSoft">
                      {lang === "en" ? `Day ${day.day} · Stop ${stop.order}` : `Hari ${day.day} · Stop ${stop.order}`}
                      {stop.timeLabel ? ` · ${stop.timeLabel}` : ""}
                    </div>
                    <Link to={`/destination/${stop.id}`} className="mt-0.5 block font-semibold text-toba underline">
                      {stop.name}
                    </Link>
                    {stop.location && <div className="mt-0.5 text-inkSoft">{stop.location}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
