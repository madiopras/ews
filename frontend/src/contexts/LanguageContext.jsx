import React, { createContext, useContext, useState, useCallback } from "react";
import { TRANSLATIONS } from "@/lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "id");

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "id" ? "en" : "id";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  const t = TRANSLATIONS[lang];

  return (
    <LanguageContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
