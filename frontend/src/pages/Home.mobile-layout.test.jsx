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
    sessionStorage.clear();
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

  test("prioritizes the Planner prompt, limits payload, and avoids duplicate trending cards", async () => {
    await act(async () => {
      root.render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('[data-testid="home-search-form"]')).toBeNull();
    expect(document.querySelector('[data-testid="home-planner-form"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-planner-prompt-composer"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-planner-prompt-input"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-hero-heading"]').textContent)
      .toBe("Susun liburan dengan AI.Jelajahi Sumut lebih bermakna.");
    expect(document.body.textContent).not.toContain("Rencanakan liburan sempurna");
    expect(document.body.textContent).not.toContain("Ceritakan perjalanan yang Anda inginkan.");
    expect(document.querySelector('[data-testid="home-category-rail"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-partner-services"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-partner-guide"]').getAttribute("href")).toBe("/partners?type=guide");
    expect(document.querySelectorAll('[data-testid="home-destination-dest-1"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="home-inspiration-section"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-inspiration-rail"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-inspiration-dest-3"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="home-destination-dest-3"]')).toBeNull();
    expect(document.querySelector('[data-testid="home-inspiration-dest-3"] a')).toBeNull();
    expect(document.querySelector('[data-testid="home-destination-dest-1"] a button')).toBeNull();

    expect(api.get).toHaveBeenCalledWith("/destinations", { params: { featured: true, per_page: 6 } });
    expect(api.get).toHaveBeenCalledWith("/destinations/trending", { params: { days: 30, limit: 8 } });
  });

  test("carries the Home prompt into the Planner draft", async () => {
    await act(async () => {
      root.render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
    });

    const input = document.querySelector('[data-testid="home-planner-prompt-input"]');
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    await act(async () => {
      valueSetter.call(input, "Liburan 3 hari bersama keluarga");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector('[data-testid="home-planner-form"]')
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const draft = JSON.parse(sessionStorage.getItem("planner_draft_v2"));
    expect(draft.form.extra_context).toBe("Liburan 3 hari bersama keluarga");
    expect(draft.wizard.step).toBe("story");
    expect(draft.handoff).toMatchObject({ source: "home", autoStart: true, consumedAt: null });
    expect(draft.handoff.id).toEqual(expect.any(String));
  });
});
