import { useEffect } from "react";

export const SITE_NAME = "Explore Wisata Sumut";
export const SITE_URL = (process.env.REACT_APP_SITE_URL || "https://explorewisatasumut.com").replace(/\/$/, "");
export const DEFAULT_DESCRIPTION = "Jelajahi destinasi Sumatera Utara dan susun perjalanan dengan AI Trip Planner berbasis informasi lokal.";
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/social-share.png`;

function ensureMeta(selector) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    const [key, value] = selector.match(/meta\[([^=]+)="([^"]+)"\]/)?.slice(1) || [];
    if (key) element.setAttribute(key, value);
    element.dataset.seo = "true";
    document.head.appendChild(element);
  }
  return element;
}

function setMeta(selector, value) {
  if (value === undefined || value === null || value === "") {
    document.head.querySelector(selector)?.remove();
    return;
  }
  ensureMeta(selector).setAttribute("content", String(value));
}

function absoluteUrl(value, fallback = SITE_URL) {
  try {
    return new URL(value || "/", fallback).toString();
  } catch {
    return fallback;
  }
}

function cleanDescription(value) {
  const normalized = String(value || DEFAULT_DESCRIPTION).replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157).trim()}…` : normalized;
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = window.location.pathname,
  image = DEFAULT_SHARE_IMAGE,
  imageAlt,
  imageWidth,
  imageHeight,
  structuredData = null,
  noIndex = false,
  ogType = "website",
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    const summary = cleanDescription(description);
    const canonical = new URL(path || "/", SITE_URL);
    canonical.search = "";
    canonical.hash = "";
    const canonicalUrl = canonical.toString();
    const language = document.documentElement.lang === "en" ? "en" : "id";
    const locale = language === "en" ? "en_US" : "id_ID";
    const alternateLocale = language === "en" ? "id_ID" : "en_US";
    const resolvedImage = absoluteUrl(image || DEFAULT_SHARE_IMAGE, SITE_URL);
    const isDefaultImage = resolvedImage === DEFAULT_SHARE_IMAGE;
    const resolvedAlt = imageAlt || title || "Logo dan identitas Explore Wisata Sumut";

    document.title = fullTitle;
    document.documentElement.lang = language;
    setMeta('meta[name="description"]', summary);
    setMeta('meta[name="application-name"]', SITE_NAME);
    setMeta('meta[name="author"]', SITE_NAME);
    setMeta('meta[name="robots"]', noIndex
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");

    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', summary);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[property="og:type"]', ogType);
    setMeta('meta[property="og:site_name"]', SITE_NAME);
    setMeta('meta[property="og:locale"]', locale);
    setMeta('meta[property="og:locale:alternate"]', alternateLocale);
    setMeta('meta[property="og:image"]', resolvedImage);
    setMeta('meta[property="og:image:secure_url"]', resolvedImage.startsWith("https://") ? resolvedImage : "");
    setMeta('meta[property="og:image:type"]', resolvedImage.toLowerCase().includes(".png") ? "image/png" : "image/jpeg");
    setMeta('meta[property="og:image:width"]', imageWidth || (isDefaultImage ? 1731 : ""));
    setMeta('meta[property="og:image:height"]', imageHeight || (isDefaultImage ? 909 : ""));
    setMeta('meta[property="og:image:alt"]', resolvedAlt);

    setMeta('meta[name="twitter:card"]', "summary_large_image");
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', summary);
    setMeta('meta[name="twitter:image"]', resolvedImage);
    setMeta('meta[name="twitter:image:alt"]', resolvedAlt);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      canonicalLink.dataset.seo = "true";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    const scriptId = "ews-page-structured-data";
    document.getElementById(scriptId)?.remove();
    if (structuredData) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, image, imageAlt, imageHeight, imageWidth, noIndex, ogType, path, structuredData, title]);

  return null;
}
