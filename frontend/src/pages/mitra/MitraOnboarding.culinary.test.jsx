import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MitraOnboarding from "./MitraOnboarding.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { api } from "../../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../../lib/api.js", () => ({
  API: "http://localhost/api",
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  formatError: (value) => String(value || ""),
}));
jest.mock("../../components/Seo.jsx", () => () => null);

describe("Mitra culinary onboarding", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: { id: "culinary-1" } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("offers Culinary as an independent onboarding type", async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/mitra/onboarding"]}><LanguageProvider><Routes><Route path="/mitra/onboarding" element={<MitraOnboarding />} /><Route path="/mitra/onboarding/:id" element={<div />} /></Routes></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
    });
    const culinaryButton = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Kuliner"));
    expect(culinaryButton).not.toBeNull();

    await act(async () => {
      culinaryButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.post).toHaveBeenCalledWith("/mitra/onboarding", { type: "culinary" });
  });
});
