import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Seo from "./Seo.jsx";

describe("public SEO metadata", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    document.head.querySelectorAll('[data-seo], #ews-page-structured-data').forEach((node) => node.remove());
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  test("writes canonical, Open Graph, robots, and JSON-LD metadata", async () => {
    await act(async () => {
      root.render(<Seo
        title="Danau Toba"
        description="Panduan editorial Danau Toba"
        path="/destination/toba?utm_source=instagram#gallery"
        image="/toba.webp"
        structuredData={{ "@context": "https://schema.org", "@type": "TouristAttraction", name: "Danau Toba" }}
      />);
    });

    expect(document.title).toBe("Danau Toba · Explore Wisata Sumut");
    expect(document.head.querySelector('meta[name="description"]').content).toBe("Panduan editorial Danau Toba");
    expect(document.head.querySelector('meta[property="og:image"]').content).toContain("/toba.webp");
    expect(document.head.querySelector('meta[property="og:image:alt"]').content).toBe("Danau Toba");
    expect(document.head.querySelector('meta[name="twitter:card"]').content).toBe("summary_large_image");
    expect(document.head.querySelector('meta[name="robots"]').content).toContain("index, follow");
    expect(document.head.querySelector('link[rel="canonical"]').href).toMatch(/\/destination\/toba$/);
    expect(document.head.querySelector('meta[property="og:image:secure_url"]').content).toContain("/toba.webp");
    expect(document.head.querySelector('meta[property="og:locale:alternate"]').content).toBe("en_US");
    expect(document.head.querySelector('meta[name="twitter:image:alt"]').content).toBe("Danau Toba");
    expect(document.head.querySelector('meta[name="robots"]').content).toContain("max-image-preview:large");
    expect(JSON.parse(document.getElementById("ews-page-structured-data").textContent)["@type"]).toBe("TouristAttraction");
  });

  test("uses production canonical and branded share image by default", async () => {
    await act(async () => {
      root.render(<Seo title="AI Trip Planner" path="/planner" />);
    });

    expect(document.head.querySelector('link[rel="canonical"]').href).toBe("https://explorewisatasumut.com/planner");
    expect(document.head.querySelector('meta[property="og:image"]').content).toBe("https://explorewisatasumut.com/social-share.png");
    expect(document.head.querySelector('meta[property="og:image:width"]').content).toBe("1731");
    expect(document.head.querySelector('meta[name="twitter:card"]').content).toBe("summary_large_image");
  });
});
