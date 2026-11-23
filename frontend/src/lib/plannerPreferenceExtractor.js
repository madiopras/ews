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
  /\b(\d{1,2})\s*[dh]\s*\d{1,2}\s*[nm]\b/giu,
];

const WORD_DAY_TERMS = [
  { value: 1, terms: ["sehari", "satu hari", "one day", "day trip", "daytrip"] },
  { value: 2, terms: ["dua hari", "two days"] },
  { value: 3, terms: ["tiga hari", "three days"] },
  { value: 4, terms: ["empat hari", "four days"] },
  { value: 5, terms: ["lima hari", "five days"] },
  { value: 6, terms: ["enam hari", "six days"] },
  { value: 7, terms: ["tujuh hari", "seminggu", "satu minggu", "seven days", "one week", "a week"] },
];

const STYLE_TERMS = {
  budget: ["hemat", "irit", "ekonomis", "backpacker", "budget", "low budget", "terjangkau"],
  mid_range: ["nyaman", "sedang", "seimbang", "mid range", "midrange", "menengah"],
  luxury: ["mewah", "premium", "luxury", "eksklusif", "exclusive", "vip"],
};

const INTEREST_TERMS = {
  adventure: ["petualangan", "adventure", "rafting", "arung jeram", "orangutan", "surfing", "snorkeling", "diving", "trekking"],
  beach: ["pantai", "beach", "beaches", "laut", "seaside"],
  camping: ["berkemah", "camping", "camp"],
  culinary: ["kuliner", "kulineran", "makanan", "makan", "kopi", "coffee", "food", "cuisine", "cafe", "kafe", "restoran", "restaurant"],
  culture: ["budaya", "adat", "sejarah", "museum", "culture", "heritage", "batak", "ulos", "desa adat"],
  hotel: ["hotel", "staycation", "resort", "penginapan", "homestay", "villa"],
  hotspring: ["air panas", "pemandian panas", "pemandian air panas", "hot spring", "hotspring"],
  island: ["pulau", "island"],
  lake: ["danau", "lake"],
  mountain: ["gunung", "pendakian", "mendaki", "hiking", "mountain"],
  nature: ["alam", "hutan", "pemandangan", "nature", "scenery", "rainforest", "bukit", "lembah"],
  tea: ["perkebunan teh", "kebun teh", "tea plantation", "tea garden"],
  viewpoint: ["titik pandang", "viewpoint", "sunrise", "sunset", "panorama"],
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
  WORD_DAY_TERMS.forEach(({ value, terms }) => {
    if (terms.some((term) => hasTerm(text, term))) matches.push(value);
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

const STARTING_POINT_TERMS = {
  kualanamu: ["kualanamu", "kno"],
  silangit: ["silangit", "dtb"],
  parapat: ["dari parapat", "mulai parapat", "start parapat", "from parapat"],
  medan: ["dari medan", "mulai medan", "mulai dari medan", "start medan", "from medan"],
};

const TRAVEL_PACE_TERMS = {
  relaxed: ["santai", "relaxed", "slow pace", "tidak buru buru", "tanpa buru buru", "pelan"],
  packed: ["padat", "packed", "maksimal", "banyak tempat", "full itinerary"],
};

export function extractPlannerOptionalPreferences(story) {
  const text = normalizedText(story);
  const startingMatches = Object.entries(STARTING_POINT_TERMS)
    .filter(([, terms]) => terms.some((term) => hasTerm(text, term)))
    .map(([hub]) => hub);
  const paceMatches = Object.entries(TRAVEL_PACE_TERMS)
    .filter(([, terms]) => terms.some((term) => hasTerm(text, term)))
    .map(([pace]) => pace);

  return {
    starting_point: startingMatches.length === 1 ? startingMatches[0] : null,
    travel_pace: paceMatches.length === 1 ? paceMatches[0] : null,
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
