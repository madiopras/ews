import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({
    t: {
      nav: {
        home: "Beranda",
        destinations: "Destinasi",
        docs: "Panduan",
        partners: "Mitra",
        profile: "Profil",
        mobileNavigation: "Navigasi utama",
      },
    },
  }),
}));

describe("BottomNav mobile information architecture", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  test("shows Guide instead of AI Planner in the agreed order", async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/"]}><BottomNav /></MemoryRouter>);
    });

    const links = [...document.querySelectorAll('[data-testid^="bottomnav-"]')];
    expect(links.map((link) => link.getAttribute("data-testid"))).toEqual([
      "bottomnav-home",
      "bottomnav-destinations",
      "bottomnav-docs",
      "bottomnav-partners",
      "bottomnav-profile",
    ]);
    expect(document.querySelector('[data-testid="bottomnav-docs"]').getAttribute("href")).toBe("/docs");
    expect(document.querySelector('[data-testid="bottomnav-docs"]').textContent).toContain("Panduan");
    expect(document.querySelector('[data-testid="bottomnav-planner"]')).toBeNull();
  });
});
