import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Directory from "./Directory.jsx";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({
  HydratedRouter: () => null,
  RouterProvider: () => null,
}), { virtual: true });

jest.mock("../lib/api.js", () => ({
  api: { get: jest.fn() },
}));
jest.mock("../components/DestinationCard.jsx", () => ({ dest }) => <div>{dest.name}</div>);
jest.mock("../components/Seo.jsx", () => () => null);

describe("guest destination discovery", () => {
  let root;

  beforeEach(() => {
    jest.useFakeTimers();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    window.history.pushState({}, "", "/explore?q=toba&category=lake&location=Samosir&sort=name&page=2");
    document.body.innerHTML = '<div id="root"></div>';
    api.get.mockImplementation((url) => Promise.resolve({
      data: url === "/destinations/locations"
        ? ["Samosir"]
        : { items: [{ id: "1", name: "Danau Toba", category: "lake", location: "Samosir" }], total: 13, page: 2, page_size: 12, pages: 2 },
    }));
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("reads filters from the URL and debounces search back into the URL", async () => {
    await act(async () => {
      root.render(<BrowserRouter><LanguageProvider><Directory /></LanguageProvider></BrowserRouter>);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(130);
      await Promise.resolve();
    });

    expect(api.get).toHaveBeenCalledWith("/destinations/search", expect.objectContaining({
      params: expect.objectContaining({ q: "toba", category: "lake", location: "Samosir", sort: "name", page: 2 }),
    }));

    const input = document.querySelector('[data-testid="search-input"]');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      valueSetter.call(input, "bukit");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      jest.advanceTimersByTime(360);
      await Promise.resolve();
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("q")).toBe("bukit");
    expect(params.get("category")).toBe("lake");
    expect(params.has("page")).toBe(false);
  });
});
