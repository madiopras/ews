import { useEffect } from "react";

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    const [key, rawValue] = selector.match(/meta\[([^=]+)="([^"]+)"\]/)?.slice(1) || [];
    if (key) element.setAttribute(key, rawValue);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value || "");
}

export default function Seo({ title, description = "Jelajahi destinasi dan rencanakan perjalanan di Sumatera Utara.", path = window.location.pathname, image = "", structuredData = null, noIndex = false }) {
  useEffect(() => {
    const siteName = "Explore Wisata Sumut";
    const fullTitle = title ? `${title} · ${siteName}` : siteName;
    const canonical = new URL(path || "/", window.location.origin);
    canonical.search = "";
    canonical.hash = "";
    const canonicalUrl = canonical.toString();
    const language = document.documentElement.lang === "en" ? "en" : "id";
    document.title = fullTitle;
    document.documentElement.lang = language;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);
    setMeta('meta[property="og:type"]', "content", structuredData ? "place" : "website");
    setMeta('meta[property="og:site_name"]', "content", siteName);
    setMeta('meta[property="og:locale"]', "content", language === "en" ? "en_US" : "id_ID");
    setMeta('meta[name="twitter:card"]', "content", image ? "summary_large_image" : "summary");
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:description"]', "content", description);
    const existingOgImage = document.head.querySelector('meta[property="og:image"]');
    const existingTwitterImage = document.head.querySelector('meta[name="twitter:image"]');
    if (image) {
      const absoluteImage = new URL(image, window.location.origin).toString();
      setMeta('meta[property="og:image"]', "content", absoluteImage);
      setMeta('meta[property="og:image:alt"]', "content", title || siteName);
      setMeta('meta[name="twitter:image"]', "content", absoluteImage);
    } else {
      existingOgImage?.remove();
      existingTwitterImage?.remove();
      document.head.querySelector('meta[property="og:image:alt"]')?.remove();
    }
    setMeta('meta[name="robots"]', "content", noIndex ? "noindex, nofollow" : "index, follow");

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    const scriptId = "ews-structured-data";
    document.getElementById(scriptId)?.remove();
    if (structuredData) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, image, noIndex, path, structuredData, title]);

  return null;
}
