import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import DocsContent from "./DocsContent.jsx";
import DocsSidebar from "./DocsSidebar.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../../lib/markdown.jsx", () => ({ renderMarkdown: (markdown) => markdown }));

describe("Partner documentation navigation", () => {
  let root;
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test("groups the complete partner guide in the sidebar", async () => {
    const onMenuChange = jest.fn();
    await act(async () => {
      root.render(
        <LanguageProvider>
          <DocsSidebar activeMenu="mitra-workspace" onMenuChange={onMenuChange} />
        </LanguageProvider>,
      );
    });

    expect(document.body.textContent).toContain("Untuk Mitra");
    expect(document.body.textContent).toContain("Cara Mendaftar");
    expect(document.body.textContent).toContain("Verifikasi & Persetujuan");
    expect(document.body.textContent).toContain("Workspace Mitra");
    expect(document.body.textContent).toContain("Jasa & Produk");
    expect(document.body.textContent).toContain("FAQ Mitra");

    const active = document.querySelector('[aria-current="page"]');
    expect(active.textContent).toContain("Workspace Mitra");

    const faq = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("FAQ Mitra"));
    await act(async () => faq.click());
    expect(onMenuChange).toHaveBeenCalledWith("mitra-faq");
  });

  test("loads the matching markdown and shows sequential navigation and actions", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue("## Mengelola profil\n\nPanduan workspace."),
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <LanguageProvider>
            <DocsContent title="Workspace Mitra" activeMenu="mitra-workspace" />
          </LanguageProvider>
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith("/docs/mitra-workspace.md");
    expect(document.body.textContent).toContain("Panduan workspace.");
    expect(document.querySelector('a[href="/docs?section=mitra-verifikasi"]')).not.toBeNull();
    expect(document.querySelector('a[href="/docs?section=mitra-produk-jasa"]')).not.toBeNull();
    expect(document.querySelector('a[href="/partners/register"]')).not.toBeNull();
    expect(document.querySelector('a[href="/mitra"]')).not.toBeNull();
    expect(document.querySelector('a[href="/docs?section=kontak"]')).not.toBeNull();
  });
});
