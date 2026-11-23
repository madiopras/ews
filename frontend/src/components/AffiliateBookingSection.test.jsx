import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import AffiliateBookingSection from "./AffiliateBookingSection.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("../lib/api.js", () => ({
  api: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
  formatError: (msg) => String(msg || "Error"),
}));

jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({ lang: "id" }),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockGet.mockReset();
  mockPost.mockReset();
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

test("renders nothing and makes no API request when explicitly disabled", async () => {
  await act(async () => {
    root.render(<AffiliateBookingSection enabled={false} destinationIds={["d1"]} source="planner" />);
  });
  await flush();
  expect(mockGet).not.toHaveBeenCalled();
  expect(container.innerHTML).toBe("");
});

test("renders contextual redirect cards with sponsored rel and disclosure", async () => {
  mockGet.mockResolvedValueOnce({
    data: {
      enabled: true,
      disclosure: "Tautan partner · Pemesanan & harga diproses langsung di tiket.com",
      items: [
        {
          product: "flight",
          zone: "toba_samosir",
          badge: "Tiket.com · Flight",
          title: "Tiket Pesawat ke DTB",
          subtitle: "Bandara Silangit (DTB)",
          airport_code: "DTB",
          cta_label: "Cari pesawat di tiket.com",
          launch_type: "redirect",
          go_url: "/api/affiliates/go?provider=tiket&product=flight&zone=toba_samosir",
        },
      ],
    },
  });

  await act(async () => {
    root.render(<AffiliateBookingSection enabled destinationIds={["d1"]} source="planner" />);
  });
  await flush();

  const link = container.querySelector('[data-testid="affiliate-link-flight"]');
  expect(link).not.toBeNull();
  expect(link.getAttribute("rel")).toBe("noopener noreferrer sponsored");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(container.textContent).toContain("Tiket Pesawat ke DTB");
  expect(container.querySelector('[data-testid="affiliate-disclosure"]').textContent).toContain("tiket.com");
});

test("launches Tiket MiniApp session via backend POST in miniapp mode", async () => {
  const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  mockGet.mockResolvedValueOnce({
    data: {
      enabled: true,
      disclosure: "Tautan partner · Pemesanan & harga diproses langsung di tiket.com",
      items: [
        {
          product: "hotel",
          zone: "toba_samosir",
          badge: "Tiket.com · Hotel",
          title: "Hotel & Homestay di Danau Toba",
          subtitle: "Pilihan hotel & homestay instan",
          cta_label: "Cari penginapan di tiket.com",
          launch_type: "miniapp_session",
          go_url: null,
        },
      ],
    },
  });
  mockPost.mockResolvedValueOnce({
    data: {
      launch_url: "https://aff.tiketsandbox.net/id-ID/miniapps/ews/hotel?token=jwt123",
    },
  });

  await act(async () => {
    root.render(<AffiliateBookingSection enabled zones={["toba_samosir"]} source="planner" />);
  });
  await flush();

  const btn = container.querySelector('[data-testid="affiliate-launch-hotel"]');
  expect(btn).not.toBeNull();
  await act(async () => {
    btn.click();
  });
  await flush();

  expect(mockPost).toHaveBeenCalledWith(
    "/affiliates/tiket/miniapp-session",
    expect.objectContaining({ product: "hotel", zone: "toba_samosir", source: "planner" }),
  );
  expect(openSpy).toHaveBeenCalledWith(
    "https://aff.tiketsandbox.net/id-ID/miniapps/ews/hotel?token=jwt123",
    "_blank",
    "noopener,noreferrer",
  );
  openSpy.mockRestore();
});
