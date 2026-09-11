import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar.jsx";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({
    lang: "id",
    toggle: jest.fn(),
    t: {
      nav: {
        home: "Beranda",
        destinations: "Destinasi",
        planner: "AI Planner",
        docs: "Panduan",
        partners: "Mitra",
        wishlist: "Tersimpan",
        admin: "Admin",
        mitra: "Workspace Mitra",
        login: "Masuk",
        logout: "Keluar",
      },
      common: { toggleLanguage: "Ganti bahasa" },
    },
  }),
}));
jest.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: false, logout: jest.fn() }),
}));
jest.mock("./NotificationBell.jsx", () => () => null);

describe("Navbar Home visual state", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  async function renderAt(pathname) {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={[pathname]}><Navbar /></MemoryRouter>);
    });
  }

  test("matches the Home hero at the top and becomes solid after scrolling", async () => {
    await renderAt("/");
    const header = document.querySelector('[data-testid="site-header"]');
    expect(header.getAttribute("data-visual-state")).toBe("home-top");
    expect(header.className).toContain("home-hero-surface");
    expect(header.className).toContain("border-transparent");

    await act(async () => {
      window.scrollY = 40;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.getAttribute("data-visual-state")).toBe("solid");
    expect(header.className).toContain("bg-cream/95");
    expect(header.className).toContain("border-line");

    await act(async () => {
      window.scrollY = 0;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.getAttribute("data-visual-state")).toBe("home-top");
  });

  test("uses the solid navbar immediately outside Home", async () => {
    await renderAt("/explore");
    const header = document.querySelector('[data-testid="site-header"]');
    expect(header.getAttribute("data-visual-state")).toBe("solid");
    expect(header.className).not.toContain("home-hero-surface");
    expect(document.querySelector('[data-testid="nav-planner"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="nav-docs"]')).not.toBeNull();
  });
});
