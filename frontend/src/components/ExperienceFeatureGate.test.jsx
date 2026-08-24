import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import ExperienceFeatureGate from "./ExperienceFeatureGate.jsx";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });

jest.mock("../lib/api.js", () => ({ api: { get: jest.fn() } }));
jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({ lang: "id", t: { common: { loading: "Memuat", error: "Gagal", retry: "Coba lagi" } } }),
}));

describe("staged experience feature gate", () => {
  let root;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockReset();
  });
  afterEach(async () => { await act(async () => root.unmount()); });

  test("renders a transparent rollout message when the account is outside rollout", async () => {
    api.get.mockResolvedValue({ data: { mitra_onboarding: { enabled: false, rollout_percentage: 25 } } });
    await act(async () => { root.render(<MemoryRouter><ExperienceFeatureGate feature="mitra_onboarding"><div>Onboarding</div></ExperienceFeatureGate></MemoryRouter>); await Promise.resolve(); });
    expect(document.querySelector('[data-testid="feature-gate-mitra_onboarding"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("Onboarding");
  });

  test("renders the feature when the server decision allows it", async () => {
    api.get.mockResolvedValue({ data: { mitra_dashboard: { enabled: true, rollout_percentage: 100 } } });
    await act(async () => { root.render(<MemoryRouter><ExperienceFeatureGate feature="mitra_dashboard"><div data-testid="dashboard">Dashboard</div></ExperienceFeatureGate></MemoryRouter>); await Promise.resolve(); });
    expect(document.querySelector('[data-testid="dashboard"]')).not.toBeNull();
  });
});
