import { CATEGORY_KEYS } from "./i18n.js";
import { isTravelStyle } from "./travelStyle.js";

export const PLANNER_NEXT_STEP = Object.freeze({
  BASICS: "basics",
  INTERESTS: "interests",
  GENERATE: "generate",
});

const DAY_PATTERNS = [
  /\b(\d{1,2})\s*(?:hari|days?)\b/giu,
  /\b(\d{1,2})\s*-\s*(?:hari|day)\b/giu,
];

const STYLE_TERMS = {
  budget: ["hemat", "irit", "ekonomis", "backpacker", "budget"],
  mid_range: ["nyaman", "sedang", "seimbang", "mid range", "midrange"],
  luxury: ["mewah", "premium", "luxury", "eksklusif"],
};

const INTEREST_TERMS = {
  adventure: ["petualangan", "adventure", "rafting", "arung jeram"],
  beach: ["pantai", "beach", "beaches", "laut", "seaside"],
  camping: ["berkemah", "camping", "camp"],
  culinary: ["kuliner", "makanan", "makan", "kopi", "coffee", "food", "cuisine"],
  culture: ["budaya", "adat", "sejarah", "museum", "culture", "heritage"],
  hotel: ["hotel"],
  hotspring: ["air panas", "pemandian panas", "hot spring", "hotspring"],
  island: ["pulau", "island"],
  lake: ["danau", "lake"],
  mountain: ["gunung", "pendakian", "mendaki", "hiking", "mountain"],
  nature: ["alam", "hutan", "pemandangan", "nature", "scenery"],
  tea: ["perkebunan teh", "kebun teh", "tea plantation", "tea garden"],
  viewpoint: ["titik pandang", "viewpoint", "sunrise", "sunset"],
  waterfall: ["air terjun", "waterfall"],
};

function normalizedText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|\\W)${escaped}(?=$|\\W)`, "iu").test(text);
}

function explicitDays(text) {
  const matches = [];
  DAY_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) matches.push(Number(match[1]));
  });
  const valid = [...new Set(matches.filter((value) => value >= 1 && value <= 14))];
  if (valid.length === 1) return { value: valid[0], confidence: "high" };
  if (valid.length > 1) return { value: null, confidence: "ambiguous" };
  return { value: null, confidence: matches.length ? "invalid" : "none" };
}

function explicitTravelStyle(text) {
  const matches = Object.entries(STYLE_TERMS)
    .filter(([style, terms]) => terms.some((term) => {
      if (style === "budget" && term === "budget" && /\bbudget\s*(?:rp|idr|\d)/iu.test(text)) return false;
      return hasTerm(text, term);
    }))
    .map(([style]) => style);
  if (matches.length === 1) return { value: matches[0], confidence: "high" };
  return { value: null, confidence: matches.length ? "ambiguous" : "none" };
}

function explicitInterests(text) {
  return CATEGORY_KEYS.filter((category) => (
    INTEREST_TERMS[category]?.some((term) => hasTerm(text, term))
  ));
}

export function extractPlannerPreferences(story) {
  const text = normalizedText(story);
  const days = explicitDays(text);
  const budgetStyle = explicitTravelStyle(text);
  const interests = explicitInterests(text);
  return {
    days: days.value,
    budget_style: budgetStyle.value,
    interests,
    confidence: {
      days: days.confidence,
      budget_style: budgetStyle.confidence,
      interests: interests.length ? "high" : "none",
    },
  };
}

export function nextPlannerStep(preferences = {}) {
  const validDays = Number.isInteger(preferences.days) && preferences.days >= 1 && preferences.days <= 14;
  const validStyle = isTravelStyle(preferences.budget_style);
  const interests = Array.isArray(preferences.interests)
    ? preferences.interests.filter((interest) => CATEGORY_KEYS.includes(interest))
    : [];
  if (!validDays || !validStyle) return PLANNER_NEXT_STEP.BASICS;
  if (interests.length === 0) return PLANNER_NEXT_STEP.INTERESTS;
  return PLANNER_NEXT_STEP.GENERATE;
}
