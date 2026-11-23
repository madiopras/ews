import { buildItineraryIcs, formatItineraryForWhatsapp } from "./itineraryExport.js";

const structuredTrip = {
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 2, budget_style: "mid_range", interests: ["nature"], lang: "id" },
  summary: "Perjalanan santai menikmati Danau Toba.",
  days: [
    {
      day: 1,
      title: "Tepi Danau Toba",
      area_label: "Parapat",
      description: "Hari pertama.",
      stops: [
        {
          period: "morning",
          time_label: "09.00",
          destination_id: "d1",
          activity: "Menikmati panorama danau, foto santai.",
          practical_tip: "Bawa jaket.",
        },
      ],
    },
  ],
  destination_ids: ["d1"],
  destinations: [
    {
      id: "d1",
      name: "Danau Toba",
      name_en: "Lake Toba",
      location: "Parapat, Simalungun",
      category: "lake",
      images: [],
      description: "Danau vulkanik.",
      description_en: "Volcanic lake.",
    },
  ],
  partner_matches: [],
  travel_notes: [],
  travel_tips: ["Berangkat lebih pagi."],
  generated_at: "2026-11-23T08:00:00+00:00",
};

describe("itineraryExport helpers", () => {
  test("formats structured itinerary cleanly for WhatsApp with links", () => {
    const text = formatItineraryForWhatsapp({
      title: "Liburan Keluarga Toba",
      result: structuredTrip,
      lang: "id",
      origin: "https://explorewisatasumut.id",
    });
    expect(text).toContain("*Liburan Keluarga Toba*");
    expect(text).toContain("*Hari 1: Tepi Danau Toba* (Parapat)");
    expect(text).toContain("• [09.00] *Danau Toba* — Parapat, Simalungun");
    expect(text).toContain("https://explorewisatasumut.id/destination/d1");
    expect(text).toContain("*Tips Perjalanan:*");
  });

  test("builds valid RFC 5545 ICS calendar events with escaped commas", () => {
    const ics = buildItineraryIcs({
      title: "Trip Toba",
      result: structuredTrip,
      lang: "id",
      startDate: new Date("2026-12-01T00:00:00Z"),
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Hari 1: Danau Toba");
    expect(ics).toContain("LOCATION:Parapat\\, Simalungun");
    expect(ics).toContain("END:VCALENDAR");
  });
});
