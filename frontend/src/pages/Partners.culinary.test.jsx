import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Partners from "./Partners.jsx";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../lib/api.js", () => ({ api: { get: jest.fn() } }));
jest.mock("../lib/partnerAnalytics.js", () => ({ trackPartnerEvent: jest.fn() }));
jest.mock("../components/PartnerCard.jsx", () => ({ partner }) => <div>{partner.business_name}</div>);
jest.mock("../components/Seo.jsx", () => () => null);

describe("Culinary Partner directory filter", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockResolvedValue({ data: [] });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("filters the public directory with type culinary", async () => {
    await act(async () => {
      root.render(<MemoryRouter><LanguageProvider><Partners /></LanguageProvider></MemoryRouter>);
      await Promise.resolve();
    });
    const filter = document.querySelector('[data-testid="partner-filter-culinary"]');
    expect(filter).not.toBeNull();

    await act(async () => {
      filter.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.get).toHaveBeenCalledWith("/partners", { params: expect.objectContaining({ type: "culinary" }) });
  });
});
