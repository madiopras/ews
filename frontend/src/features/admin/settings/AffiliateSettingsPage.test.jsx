import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AffiliateSettingsPage from "./AffiliateSettingsPage.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGetConfig = jest.fn();
const mockUpdateConfig = jest.fn();
const mockPreviewConfig = jest.fn();
const mockGetAnalytics = jest.fn();

jest.mock("./settingsApi.js", () => ({
  getTiketAffiliateConfig: (...args) => mockGetConfig(...args),
  updateTiketAffiliateConfig: (...args) => mockUpdateConfig(...args),
  previewTiketAffiliateConfig: (...args) => mockPreviewConfig(...args),
  getAffiliateAnalytics: (...args) => mockGetAnalytics(...args),
}));

jest.mock("../../../contexts/LanguageContext.jsx", () => {
  const { ADMIN_SETTINGS_TRANSLATIONS } = require("../../../lib/adminTranslations.js");
  return {
    useLang: () => ({
      lang: "id",
      t: {
        admin: {
          settings: ADMIN_SETTINGS_TRANSLATIONS.id,
          common: { save: "Simpan", cancel: "Batal", saving: "Menyimpan..." },
        },
      },
    }),
  };
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockGetConfig.mockReset();
  mockUpdateConfig.mockReset();
  mockPreviewConfig.mockReset();
  mockGetAnalytics.mockReset();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

test("renders Tiket.com Affiliate settings, analytics, and preview action", async () => {
  mockGetConfig.mockResolvedValue({
    provider: "tiket",
    enabled: false,
    environment: "sandbox",
    mode: "miniapp",
    partner_identifier: "ews-partner",
    partner_slug: "explore-sumut",
    affiliate_id: "",
    campaign_url_template: "",
    miniapp_production_base_url: "",
    products_enabled: { hotel: true, flight: true },
    allowed_redirect_hosts: ["tiket.com", "aff.tiketsandbox.net"],
    has_miniapp_api_key: true,
    has_miniapp_rsa_public_key: false,
    has_hotel_v2_auth: false,
    has_flight_v2_api_key: false,
    api_base_url: "https://api.tiketsandbox.net",
    miniapp_base_url: "https://aff.tiketsandbox.net",
    ready_for_launch: true,
    readiness_notes: [],
    updated_at: "2026-11-23T10:00:00Z",
  });
  mockGetAnalytics.mockResolvedValue({
    days: 30,
    total_clicks: 12,
    by_product: [{ key: "hotel", count: 7 }, { key: "flight", count: 5 }],
    by_zone: [{ key: "toba_samosir", count: 9 }],
    by_source: [],
    by_mode: [],
  });
  mockPreviewConfig.mockResolvedValue({
    mode: "miniapp",
    environment: "sandbox",
    product: "hotel",
    zone: "toba_samosir",
    api_base_url: "https://api.tiketsandbox.net",
    preview_url: "https://aff.tiketsandbox.net/id-ID/miniapps/explore-sumut/hotel?token=<miniapp_jwt_token>",
    sub_id: "ews_planner_toba_samosir_hotel",
    ready: true,
    readiness_notes: [],
    live_test_status: "skipped",
    live_test_message: "",
    card: {
      title: "Hotel & Homestay di Danau Toba, Parapat & Samosir",
      subtitle: "Pilihan hotel, resort, villa & homestay booking instan",
    },
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AffiliateSettingsPage />
      </QueryClientProvider>,
    );
  });
  await flush();

  expect(container.querySelector('[data-testid="affiliate-settings-page"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="affiliate-total-clicks"]').textContent).toBe("12");
  expect(container.textContent).toContain("https://api.tiketsandbox.net");

  const previewBtn = container.querySelector('[data-testid="affiliate-preview-btn"]');
  await act(async () => {
    previewBtn.click();
  });
  await flush();

  expect(mockPreviewConfig).toHaveBeenCalledWith(
    expect.objectContaining({ zone: "toba_samosir", product: "hotel", live_token_test: false }),
  );
  expect(container.querySelector('[data-testid="affiliate-preview-output"]').textContent).toContain(
    "ews_planner_toba_samosir_hotel",
  );
});
