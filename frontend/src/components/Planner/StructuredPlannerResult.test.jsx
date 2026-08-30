import React, { act } from "react";
import { createRoot } from "react-dom/client";
import StructuredPlannerResult, { PlannerGenerationError, PlannerResultProgress } from "./StructuredPlannerResult.jsx";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock("../DestinationCard.jsx", () => ({ dest, showPlannerAction }) => <div data-testid={`destination-${dest.id}`} data-planner-action={String(showPlannerAction)}>{dest.name}</div>);
jest.mock("../PartnerCard.jsx", () => ({ partner }) => <div data-testid={`partner-${partner.id}`}>{partner.business_name}</div>);

const t = {
  detail: { viewDetails: "Lihat detail" },
  categories: { nature: "Alam", culinary: "Kuliner" },
  partners: { types: { guide: "Pemandu", rental: "Rental", homestay: "Homestay", culinary: "Kuliner", souvenir: "Oleh-oleh" } },
  planner: {
    days: "Berapa hari?", travelStyle: "Gaya", interests: "Minat",
    tripOverview: "Ringkasan perjalanan", structuredSummary: "Rencana untuk Anda",
    dailyPlan: "Rencana per hari", dailyPlanSub: "Buka satu hari.", practicalTip: "Tip praktis",
    periods: { morning: "Pagi", afternoon: "Siang", evening: "Malam", flexible: "Fleksibel" },
    destinationUnavailable: "Destinasi belum tersedia", destinationsInTrip: "Destinasi perjalanan",
    destinationsInTripSub: "Berasal dari katalog", noDestinationCards: "Kartu belum tersedia",
    partialDestinationCards: "Sebagian kartu belum tersedia", recommendedPartners: "Mitra relevan",
    organicMatch: "Berdasarkan relevansi", noPartnerMatches: "Belum ada Mitra cocok",
    partnerTypes: "Jenis Mitra", matches: "Cocok untuk", tripRoute: "rute ini",
    featuredDisclosure: "Mitra Unggulan", matchReasons: "Alasan kecocokan",
    notesAndTips: "Catatan dan tips", travelNotes: "Catatan", travelTips: "Tips",
    progressTitle: "Menyusun perjalanan", progressPhases: {
      generating: "Memilih rute", validating: "Memeriksa destinasi", hydrating: "Menyiapkan kartu",
    }, cancelGeneration: "Batalkan",
  },
};

const destination = (id, name) => ({
  id, name, name_en: name, location: "Toba", category: "nature",
  images: [], description: "Deskripsi", description_en: "Description",
});

const partner = (id, type, name, premium = false) => ({
  id, type, business_name: name, whatsapp: "628123456789", city: "Toba",
  description: "Usaha lokal", image: "", service_tags: ["keluarga"],
  is_premium: premium, promotional_disclosure: premium ? "unggulan_berbayar" : null,
  accepting_contacts: true,
});

const result = (overrides = {}) => ({
  version: 2,
  result_format: "structured",
  request_snapshot: { days: 2, budget_style: "mid_range", interests: ["nature"], lang: "id" },
  summary: "Perjalanan alam dengan ritme santai.",
  days: [
    { day: 1, title: "Danau dan budaya", area_label: "Toba", description: "Hari santai", stops: [{ period: "morning", time_label: "08.00", destination_id: "dest-1", activity: "Menikmati panorama.", practical_tip: "Bawa air." }] },
    { day: 2, title: "Bukit dan desa", area_label: "Samosir", description: "Hari kedua", stops: [{ period: "afternoon", time_label: "14.00", destination_id: "dest-2", activity: "Berjalan santai.", practical_tip: "Gunakan alas kaki nyaman." }] },
  ],
  destination_ids: ["dest-1", "dest-2"],
  destinations: [destination("dest-1", "Danau Toba"), destination("dest-2", "Bukit Holbung")],
  partner_matches: [
    { partner_id: "partner-1", type: "guide", destination_ids: ["dest-1"], offering_ids: [], match_reasons: ["Melayani kawasan ini"], placement: "featured", partner: partner("partner-1", "guide", "Pemandu Toba", true) },
    { partner_id: "partner-2", type: "homestay", destination_ids: ["dest-2"], offering_ids: [], match_reasons: ["Dekat dengan rute"], placement: "organic", partner: partner("partner-2", "homestay", "Homestay Samosir") },
  ],
  travel_notes: ["Waktu tempuh dapat berubah."],
  travel_tips: ["Periksa cuaca."],
  generated_at: "2026-08-30T10:00:00+00:00",
  ...overrides,
});

describe("StructuredPlannerResult", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => { await act(async () => root.unmount()); });

  const renderResult = async (value = result(), props = {}) => {
    await act(async () => root.render(<StructuredPlannerResult result={value} lang="id" t={t} destinationCardsEnabled partnerMatchesEnabled culinaryEnabled {...props} />));
  };

  test("renders summary and keeps only the first itinerary day open initially", async () => {
    await renderResult();
    expect(document.body.textContent).toContain("Perjalanan alam dengan ritme santai.");
    const dayButtons = document.querySelectorAll('[data-testid^="structured-day-"] h4 button');
    expect(dayButtons).toHaveLength(2);
    expect(dayButtons[0].getAttribute("aria-expanded")).toBe("true");
    expect(dayButtons[1].getAttribute("aria-expanded")).toBe("false");

    await act(async () => dayButtons[1].click());
    expect(dayButtons[0].getAttribute("aria-expanded")).toBe("false");
    expect(dayButtons[1].getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("Gunakan alas kaki nyaman.");
  });

  test("links valid stops and preserves activities when a destination card is missing", async () => {
    const partial = result({ destinations: [destination("dest-1", "Danau Toba")] });
    await renderResult(partial);
    expect(document.querySelector('a[href="/destination/dest-1"]')).not.toBeNull();
    await act(async () => document.querySelector('[data-testid="structured-day-2"] h4 button').click());
    expect(document.body.textContent).toContain("Destinasi belum tersedia");
    expect(document.body.textContent).toContain("Berjalan santai.");
    expect(document.body.textContent).toContain("Sebagian kartu belum tersedia");
  });

  test.each([320, 375, 390, 430])("uses a bounded horizontal destination rail at %ipx", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    await renderResult();
    const rail = document.querySelector('[data-testid="structured-destination-rail"]');
    expect(rail.className).toContain("overflow-x-auto");
    expect(rail.firstElementChild.className).toContain("w-[82vw]");
    expect(rail.firstElementChild.className).toContain("max-w-[320px]");
    expect(document.querySelector('[data-testid="destination-dest-1"]').getAttribute("data-planner-action")).toBe("false");
  });

  test("supports keyboard partner tabs, match reasons, and featured disclosure", async () => {
    await renderResult();
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    tabs[0].focus();
    await act(async () => tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    expect(document.body.textContent).toContain("Melayani kawasan ini");
    expect(document.body.textContent).toContain("Mitra Unggulan");
  });

  test("shows notes, tips, and a useful empty partner state", async () => {
    await renderResult(result({ partner_matches: [] }));
    expect(document.body.textContent).toContain("Belum ada Mitra cocok");
    expect(document.body.textContent).toContain("Waktu tempuh dapat berubah.");
    expect(document.body.textContent).toContain("Periksa cuaca.");
  });

  test("renders accessible progress phases and cancel action", async () => {
    const onCancel = jest.fn();
    await act(async () => root.render(<PlannerResultProgress phase="validating" t={t} onCancel={onCancel} />));
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Memeriksa destinasi");
    await act(async () => document.querySelector("button").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("renders a retryable timeout error", async () => {
    const onRetry = jest.fn();
    await act(async () => root.render(<PlannerGenerationError message="Pembuatan terlalu lama." retryLabel="Coba lagi" onRetry={onRetry} />));
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => document.querySelector('[data-testid="planner-retry-btn"]').click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
