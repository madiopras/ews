import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { TRANSLATIONS } from "../lib/i18n.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const previewLang = new URLSearchParams(window.location.search).get("lang");
    const initial = ["id", "en"].includes(previewLang) ? previewLang : (localStorage.getItem("lang") || "id");
    document.documentElement.lang = initial;
    return initial;
  });

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "id" ? "en" : "id";
      localStorage.setItem("lang", next);
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  const setLanguage = useCallback((next) => {
    if (!["id", "en"].includes(next)) return;
    localStorage.setItem("lang", next);
    document.documentElement.lang = next;
    setLang(next);
  }, []);

  const t = TRANSLATIONS[lang];

  return (
    <LanguageContext.Provider value={{ lang, toggle, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
