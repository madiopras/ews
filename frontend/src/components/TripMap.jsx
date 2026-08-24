import React from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export default function TripMap({ destinations, center, lang }) {
  return (
    <MapContainer center={center} zoom={7} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {destinations.map((destination) => (
        <Marker key={destination.id} position={[Number(destination.latitude), Number(destination.longitude)]}>
          <Popup>
            <Link to={`/destination/${destination.id}`} className="font-semibold text-toba">
              {lang === "en" && destination.name_en ? destination.name_en : destination.name}
            </Link>
            <div>{destination.location}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
