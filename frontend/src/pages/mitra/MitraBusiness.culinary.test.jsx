import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MitraBusiness from "./MitraBusiness.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { api } from "../../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../../lib/api.js", () => ({
  api: { get: jest.fn(), put: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../lib/midtrans.js", () => ({ loadSnap: jest.fn() }));
jest.mock("../../components/Seo.jsx", () => () => null);
jest.mock("../../components/PremiumDialog.jsx", () => () => null);

const business = {
  id: "culinary-1", business_name: "Dapur Toba", type: "culinary", status: "approved",
  membership_role: "staff", whatsapp: "628123456789", description: "Makanan khas lokal.",
  city: "Samosir", email: "", address: "", destination_ids: [], service_tags: ["kopi"],
  accepting_contacts: true, contact_status_note: "", gallery: [], members: [], profile_completeness: 80,
  culinary_categories: ["Rumah makan"], culinary_specialties: ["Arsik"],
  culinary_service_modes: ["Dine-in"], culinary_dietary_tags: [],
  culinary_opening_info: "Buka setiap hari", culinary_reservation_note: "Hubungi untuk rombongan",
};

describe("Mitra culinary self-service", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockImplementation((url) => {
      if (url === "/mitra/partners/culinary-1") return Promise.resolve({ data: business });
      if (url.endsWith("/insights")) return Promise.resolve({ data: { counts: {} } });
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("renders editable culinary profile fields", async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/mitra/business/culinary-1"]}><LanguageProvider><Routes><Route path="/mitra/business/:id" element={<MitraBusiness />} /></Routes></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Makanan/minuman khas");
    expect([...document.querySelectorAll("input")].some((input) => input.value === "Arsik")).toBe(true);
    expect([...document.querySelectorAll("input")].some((input) => input.value === "Buka setiap hari")).toBe(true);
  });
});
