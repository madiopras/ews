import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PartnerTypeDetails from "./PartnerTypeDetails.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

test("renders rich Rental Mobil details including fleet, service options, pickup areas, and social links", () => {
  act(() => {
    root.render(
      <PartnerTypeDetails
        lang="id"
        partner={{
          type: "rental",
          instagram_url: "https://instagram.com/tobatrans",
          google_maps_url: "https://maps.google.com/?q=Medan",
          type_details: {
            rental_fleet_size: 8,
            rental_driver_available: true,
            rental_vehicle_types: ["Hiace 14 Seat", "Innova Reborn"],
            rental_service_options: ["Dengan Supir", "Antar-Jemput KNO"],
            rental_pickup_areas: ["Bandara KNO", "Parapat"],
          },
        }}
      />,
    );
  });

  expect(container.textContent).toContain("8 unit");
  expect(container.textContent).toContain("Hiace 14 Seat");
  expect(container.textContent).toContain("Antar-Jemput KNO");
  expect(container.textContent).toContain("Bandara KNO");
  expect(container.querySelector('[data-testid="partner-instagram-link"]').getAttribute("href")).toBe(
    "https://instagram.com/tobatrans",
  );
  expect(container.querySelector('[data-testid="partner-maps-link"]').getAttribute("href")).toBe(
    "https://maps.google.com/?q=Medan",
  );
});

test("renders Homestay Lokal details with subtype, room types, capacity, and facilities", () => {
  act(() => {
    root.render(
      <PartnerTypeDetails
        lang="id"
        partner={{
          type: "homestay",
          type_details: {
            accommodation_subtype: "villa",
            homestay_room_count: 6,
            homestay_max_guests: 18,
            homestay_room_types: ["Deluxe Lake View", "Family Room"],
            homestay_facilities: ["WiFi", "Sarapan", "View Danau"],
            homestay_checkin_info: "Check-in 14:00, Check-out 12:00",
          },
        }}
      />,
    );
  });

  expect(container.textContent).toContain("Villa");
  expect(container.textContent).toContain("6 kamar");
  expect(container.textContent).toContain("18 orang");
  expect(container.textContent).toContain("Deluxe Lake View");
  expect(container.textContent).toContain("Check-in 14:00");
});

test("renders Licensed badge for tour_operator without exposing raw license numbers", () => {
  act(() => {
    root.render(
      <PartnerTypeDetails
        lang="id"
        partner={{
          type: "tour_operator",
          type_details: {
            has_license: true,
            tour_trip_types: ["Open Trip", "Private Tour"],
            tour_inclusions: ["Transport", "Penginapan"],
            tour_min_pax: 2,
            tour_max_pax: 20,
          },
        }}
      />,
    );
  });

  expect(container.querySelector('[data-testid="partner-licensed-badge"]').textContent).toContain("Berlisensi");
  expect(container.textContent).toContain("Open Trip");
  expect(container.textContent).toContain("2–20 orang");
});
