import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlannerResultCards from "./PlannerResultCards.jsx";
import { api } from "../../lib/api.js";

jest.mock("react-router/dom", () => ({
  HydratedRouter: () => null,
  RouterProvider: () => null,
}), { virtual: true });

jest.mock("../../lib/api.js", () => ({
  api: { post: jest.fn() },
}));
jest.mock("../DestinationCard.jsx", () => ({ dest, showPlannerAction }) => (
  <div data-testid={`destination-${dest.id}`} data-planner-action={String(showPlannerAction)}>{dest.name}</div>
));
jest.mock("../PartnerCard.jsx", () => ({ partner }) => (
  <div data-testid={`partner-${partner.id}`}>{partner.business_name}</div>
));

const t = {
  common: { loading: "Memuat", retry: "Coba lagi" },
  partners: { types: { guide: "Pemandu Wisata", rental: "Rental Mobil", homestay: "Homestay", culinary: "Kuliner", souvenir: "Oleh-oleh" } },
  planner: {
    destinationsInTrip: "Destinasi dalam perjalanan",
    destinationsInTripSub: "Destinasi dari katalog",
    destinationCardsLoadError: "Kartu destinasi gagal dimuat.",
    recommendedPartners: "Mitra lokal yang relevan",
    organicMatch: "Dipilih berdasarkan kecocokan.",
    partnerTypes: "Jenis mitra",
    matches: "Cocok untuk",
    featuredDisclosure: "Mitra Unggulan",
    matchReasons: "Alasan kecocokan",
  },
};

const recommendation = (overrides = {}) => ({
  partner_id: "partner-1",
  type: "guide",
  destination_id: "dest-1",
  destination_name: "Danau Toba",
  destination_ids: ["dest-1"],
  destination_names: ["Danau Toba"],
  match_reasons: ["Melayani destinasi ini"],
  placement: "organic",
  partner: { id: "partner-1", type: "guide", business_name: "Pemandu Toba" },
  ...overrides,
});

describe("PlannerResultCards", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("loads unique destinations in itinerary order and disables the nested Planner CTA", async () => {
    api.post.mockResolvedValue({ data: [
      { id: "dest-2", name: "Bukit Holbung" },
      { id: "dest-1", name: "Danau Toba" },
    ] });

    await act(async () => {
      root.render(<PlannerResultCards
        enabled
        ready
        partnerMatchesEnabled={false}
        culinaryEnabled={false}
        destinationIds={["dest-2", "dest-1", "dest-2"]}
        recommendations={[]}
        t={t}
      />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/destinations/batch",
      { ids: ["dest-2", "dest-1"] },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(document.querySelectorAll('[data-testid^="destination-"]')).toHaveLength(2);
    expect(document.querySelector('[data-testid="destination-dest-2"]').getAttribute("data-planner-action")).toBe("false");
  });

  test("omits empty partner tabs and shows match context plus featured disclosure", async () => {
    await act(async () => {
      root.render(<PlannerResultCards
        enabled
        ready
        partnerMatchesEnabled
        culinaryEnabled={false}
        destinationIds={[]}
        recommendations={[recommendation({ placement: "featured" })]}
        t={t}
      />);
    });

    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(document.body.textContent).toContain("Pemandu Wisata");
    expect(document.body.textContent).not.toContain("Rental Mobil");
    expect(document.body.textContent).toContain("Danau Toba");
    expect(document.body.textContent).toContain("Melayani destinasi ini");
    expect(document.body.textContent).toContain("Mitra Unggulan");
  });

  test.each([320, 375, 390, 430])("keeps the mobile destination rail inside a %ipx viewport", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    api.post.mockResolvedValue({ data: [{ id: "dest-1", name: "Danau Toba" }] });

    await act(async () => {
      root.render(<PlannerResultCards
        enabled
        ready
        partnerMatchesEnabled={false}
        culinaryEnabled={false}
        destinationIds={["dest-1"]}
        recommendations={[]}
        t={t}
      />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const rail = document.querySelector('[data-testid="planner-destination-carousel"]');
    expect(rail).not.toBeNull();
    expect(rail.className).toContain("overflow-x-auto");
    expect(rail.firstElementChild.className).toContain("w-[82vw]");
    expect(rail.firstElementChild.className).toContain("max-w-[320px]");
  });

  test("keeps the itinerary usable and retries after a destination request fails", async () => {
    api.post.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: [{ id: "dest-1", name: "Danau Toba" }] });

    await act(async () => {
      root.render(<PlannerResultCards
        enabled
        ready
        partnerMatchesEnabled={false}
        culinaryEnabled={false}
        destinationIds={["dest-1"]}
        recommendations={[]}
        t={t}
      />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      document.querySelector("button").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-testid="destination-dest-1"]')).not.toBeNull();
  });
});
