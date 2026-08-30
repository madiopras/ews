import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home.jsx";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../lib/api.js", () => ({ api: { get: jest.fn() } }));
jest.mock("../components/Seo.jsx", () => () => null);
jest.mock("../components/UlosPattern.jsx", () => () => <span />);

const destination = (id, name) => ({
  id,
  name,
  name_en: name,
  location: "Sumatera Utara",
  category: "nature",
  images: [`https://images.example/${id}.webp`],
});

describe("Home mobile-first discovery layout", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    const first = destination("dest-1", "Danau Toba");
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === "/destinations/trending"
        ? [first, destination("dest-3", "Bukit Lawang")]
        : { data: [first, destination("dest-2", "Pulau Samosir")] },
    }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("prioritizes search and Planner, limits payload, and avoids duplicate trending cards", async () => {
    await act(async () => {
      root.render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('[data-testid="home-search-form"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-planner-banner"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-category-rail"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-partner-services"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-partner-guide"]').getAttribute("href")).toBe("/partners?type=guide");
    expect(document.querySelectorAll('[data-testid="home-destination-dest-1"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="home-destination-dest-3"]')).not.toBeNull();

    expect(api.get).toHaveBeenCalledWith("/destinations", { params: { featured: true, per_page: 6 } });
    expect(api.get).toHaveBeenCalledWith("/destinations/trending", { params: { days: 30, limit: 8 } });
  });
});
