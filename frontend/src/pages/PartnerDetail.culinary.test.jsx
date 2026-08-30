import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PartnerDetail from "./PartnerDetail.jsx";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../lib/api.js", () => ({ api: { get: jest.fn() }, API: "http://localhost/api" }));
jest.mock("../lib/partnerAnalytics.js", () => ({ trackPartnerEvent: jest.fn() }));
jest.mock("../components/Seo.jsx", () => () => null);
jest.mock("../components/ReportContentButton.jsx", () => () => null);

describe("public culinary Partner detail", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockResolvedValue({ data: {
      id: "culinary-1", business_name: "Dapur Toba", type: "culinary", city: "Samosir",
      description: "Makanan khas lokal.", whatsapp: "628123456789", accepting_contacts: true,
      service_tags: ["keluarga"], is_premium: false, gallery: [], destinations: [], offerings: [],
      type_details: {
        culinary_categories: ["Rumah makan"], culinary_specialties: ["Arsik", "Kopi Lintong"],
        culinary_service_modes: ["Dine-in"], culinary_dietary_tags: ["Tanya bahan langsung"],
        culinary_opening_info: "Buka setiap hari", culinary_reservation_note: "Hubungi untuk rombongan",
      },
    } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("shows factual culinary details without a price section", async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/partners/culinary-1"]}><LanguageProvider><Routes><Route path="/partners/:id" element={<PartnerDetail />} /></Routes></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });

    const details = document.querySelector('[data-testid="culinary-public-details"]');
    expect(details).not.toBeNull();
    expect(details.textContent).toContain("Arsik");
    expect(details.textContent).toContain("Buka setiap hari");
    expect(details.textContent.toLowerCase()).not.toContain("harga");
    expect(details.textContent).not.toContain("Rp");
  });
});
