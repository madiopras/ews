import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import PartnerCard from "./PartnerCard.jsx";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";

jest.mock("react-router/dom", () => ({
  HydratedRouter: () => null,
  RouterProvider: () => null,
}), { virtual: true });
jest.mock("../lib/partnerAnalytics.js", () => ({ trackPartnerEvent: jest.fn() }));

const partner = (overrides = {}) => ({
  id: "partner-1",
  business_name: "Pemandu Toba",
  type: "guide",
  city: "Samosir",
  description: "Pemandu lokal untuk perjalanan Danau Toba.",
  whatsapp: "628123456789",
  accepting_contacts: true,
  service_tags: ["keluarga"],
  is_premium: false,
  ...overrides,
});

describe("PartnerCard Planner safety", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  const renderCard = async (value) => {
    await act(async () => {
      root.render(<MemoryRouter><LanguageProvider><PartnerCard partner={value} source="planner" destinationId="dest-1" /></LanguageProvider></MemoryRouter>);
    });
  };

  test("labels featured placement but hides WhatsApp when contacts are unavailable", async () => {
    await renderCard(partner({ is_premium: true, accepting_contacts: false }));
    expect(document.querySelector('[data-testid="partner-premium-badge-partner-1"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="partner-wa-btn-partner-1"]')).toBeNull();
  });

  test("shows a safe WhatsApp action and records contact intent", async () => {
    await renderCard(partner());
    const button = document.querySelector('[data-testid="partner-wa-btn-partner-1"]');
    expect(button.href).toMatch(/^https:\/\/wa\.me\/628123456789\?/);

    await act(async () => button.click());
    expect(trackPartnerEvent).toHaveBeenCalledWith("whatsapp_click", "partner-1", "planner", "dest-1", {});
  });
});
