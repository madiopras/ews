export const TRAVEL_STYLES = Object.freeze(["budget", "mid_range", "luxury"]);

const COPY = {
  budget: {
    id: { label: "Hemat", description: "Pengalaman esensial" },
    en: { label: "Budget", description: "Essential experiences" },
  },
  mid_range: {
    id: { label: "Nyaman", description: "Seimbang dan fleksibel" },
    en: { label: "Mid-range", description: "Comfortable balance" },
  },
  luxury: {
    id: { label: "Mewah", description: "Kenyamanan lebih premium" },
    en: { label: "Luxury", description: "More premium comfort" },
  },
};

export function isTravelStyle(value) {
  return TRAVEL_STYLES.includes(value);
}

export function travelStyleOptions(lang = "id") {
  const locale = lang === "en" ? "en" : "id";
  return TRAVEL_STYLES.map((value) => ({ value, ...COPY[value][locale] }));
}

export function travelStyleLabel(value, lang = "id", fallback = "") {
  if (!isTravelStyle(value)) return fallback;
  return COPY[value][lang === "en" ? "en" : "id"].label;
}

// Used only to present itinerary and draft data created before budget_style existed.
export function travelStyleFromLegacyBudget(budget, days) {
  const perDay = Number(budget || 0) / Math.max(1, Number(days) || 1);
  if (perDay <= 500000) return "budget";
  if (perDay <= 1125000) return "mid_range";
  return "luxury";
}
