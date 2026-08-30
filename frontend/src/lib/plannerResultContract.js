export const PLANNER_RESULT_VERSION = 2;
export const PLANNER_RESULT_FORMAT = Object.freeze({
  LEGACY: "legacy",
  STRUCTURED: "structured",
});

export const DEFAULT_PLANNER_RESULT_FEATURES = Object.freeze({
  planner_result_cards: { enabled: false, rollout_percentage: 0, reason: "default_off" },
  planner_structured_results: { enabled: false, rollout_percentage: 0, reason: "default_off" },
  planner_culinary: { enabled: false, rollout_percentage: 0, reason: "default_off" },
  planner_partner_matches: { enabled: false, rollout_percentage: 0, reason: "default_off" },
});

const TRAVEL_STYLES = new Set(["budget", "mid_range", "luxury"]);
const LANGUAGES = new Set(["id", "en"]);
const PERIODS = new Set(["morning", "afternoon", "evening", "flexible"]);
const PARTNER_TYPES = new Set(["guide", "rental", "homestay", "culinary", "souvenir"]);
const PLACEMENTS = new Set(["organic", "featured"]);
const MATCH_FACTOR_CODES = new Set(["destination_coverage", "requested_service_type", "service_tag_match", "multi_destination_coverage"]);

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
// JSON Schema/Pydantic string limits count Unicode code points. JavaScript's
// native .length counts UTF-16 code units, so emoji could incorrectly make an
// otherwise valid backend payload fail frontend validation.
const unicodeLength = (value) => Array.from(value).length;
const isString = (value, { required = false, max = Infinity } = {}) => (
  typeof value === "string" && unicodeLength(value) <= max && (!required || value.trim().length > 0)
);
const isStringArray = (value, max) => Array.isArray(value) && value.length <= max && value.every((item) => isString(item, { required: true, max: 1000 }));
const isUnique = (values) => new Set(values).size === values.length;

function validSnapshot(snapshot) {
  return isObject(snapshot)
    && Number.isInteger(snapshot.days)
    && snapshot.days >= 1
    && snapshot.days <= 14
    && TRAVEL_STYLES.has(snapshot.budget_style)
    && isStringArray(snapshot.interests, 14)
    && LANGUAGES.has(snapshot.lang);
}

function validStop(stop) {
  return isObject(stop)
    && PERIODS.has(stop.period)
    && isString(stop.time_label, { max: 40 })
    && isString(stop.destination_id, { required: true, max: 64 })
    && isString(stop.activity, { required: true, max: 600 })
    && isString(stop.practical_tip, { max: 300 });
}

function validDay(day, requestedDays) {
  return isObject(day)
    && Number.isInteger(day.day)
    && day.day >= 1
    && day.day <= requestedDays
    && isString(day.title, { required: true, max: 160 })
    && isString(day.area_label, { max: 160 })
    && isString(day.description, { max: 600 })
    && Array.isArray(day.stops)
    && day.stops.length >= 1
    && day.stops.length <= 8
    && day.stops.every(validStop);
}

function validDestination(destination) {
  return isObject(destination)
    && isString(destination.id, { required: true, max: 64 })
    && isString(destination.name, { required: true, max: 150 })
    && isString(destination.name_en, { max: 150 })
    && isString(destination.location, { required: true, max: 200 })
    && isString(destination.category, { required: true, max: 50 })
    && isStringArray(destination.images, 10)
    && isString(destination.description, { max: 600 })
    && isString(destination.description_en, { max: 600 })
    && (destination.latitude == null || (Number.isFinite(destination.latitude) && destination.latitude >= -90 && destination.latitude <= 90))
    && (destination.longitude == null || (Number.isFinite(destination.longitude) && destination.longitude >= -180 && destination.longitude <= 180));
}

function validPartner(partner) {
  return isObject(partner)
    && isString(partner.id, { required: true, max: 64 })
    && isString(partner.business_name, { required: true, max: 120 })
    && PARTNER_TYPES.has(partner.type)
    && (partner.whatsapp == null || /^\d{8,20}$/.test(partner.whatsapp))
    && isString(partner.city, { max: 120 })
    && isString(partner.description, { max: 600 })
    && isString(partner.image, { max: 1000 })
    && isStringArray(partner.service_tags, 20)
    && typeof partner.is_premium === "boolean"
    && (partner.promotional_disclosure == null || partner.promotional_disclosure === "unggulan_berbayar")
    && partner.is_premium === (partner.promotional_disclosure === "unggulan_berbayar")
    && typeof partner.accepting_contacts === "boolean"
    && (partner.accepting_contacts || partner.whatsapp == null);
}

function validPartnerMatch(match, destinationIds) {
  return isObject(match)
    && isString(match.partner_id, { required: true, max: 64 })
    && PARTNER_TYPES.has(match.type)
    && isStringArray(match.destination_ids, 20)
    && match.destination_ids.every((id) => destinationIds.has(id))
    && isStringArray(match.offering_ids, 20)
    && isStringArray(match.match_reasons, 3)
    && (match.relevance_score == null || (Number.isInteger(match.relevance_score) && match.relevance_score >= 0 && match.relevance_score <= 100))
    && (match.match_factor_codes == null || (Array.isArray(match.match_factor_codes) && match.match_factor_codes.length <= 4 && match.match_factor_codes.every((code) => MATCH_FACTOR_CODES.has(code))))
    && PLACEMENTS.has(match.placement)
    && validPartner(match.partner)
    && match.partner.id === match.partner_id
    && match.partner.type === match.type
    && (match.placement !== "featured" || match.partner.is_premium === true);
}

export function isPlannerResultV2(value) {
  if (!isObject(value)
    || value.version !== PLANNER_RESULT_VERSION
    || value.result_format !== PLANNER_RESULT_FORMAT.STRUCTURED
    || !validSnapshot(value.request_snapshot)
    || !isString(value.summary, { required: true, max: 1000 })
    || !Array.isArray(value.days)
    || value.days.length < 1
    || value.days.length > 14
    || !value.days.every((day) => validDay(day, value.request_snapshot.days))
    || !isStringArray(value.destination_ids, 50)
    || value.destination_ids.length < 1
    || !isUnique(value.destination_ids)
    || !Array.isArray(value.destinations)
    || value.destinations.length > 50
    || !value.destinations.every(validDestination)
    || !Array.isArray(value.partner_matches)
    || value.partner_matches.length > 20
    || !isStringArray(value.travel_notes, 10)
    || !isStringArray(value.travel_tips, 10)
    || !isString(value.generated_at, { required: true, max: 40 })) {
    return false;
  }

  const dayNumbers = value.days.map((day) => day.day);
  if (!isUnique(dayNumbers) || dayNumbers.some((day, index) => day !== index + 1)) return false;

  const destinationIds = new Set(value.destination_ids);
  const stopIds = value.days.flatMap((day) => day.stops.map((stop) => stop.destination_id));
  if (stopIds.some((id) => !destinationIds.has(id))) return false;

  const hydratedIds = value.destinations.map((destination) => destination.id);
  if (!isUnique(hydratedIds) || hydratedIds.some((id) => !destinationIds.has(id))) return false;

  const partnerIds = value.partner_matches.map((match) => match.partner_id);
  return isUnique(partnerIds) && value.partner_matches.every((match) => validPartnerMatch(match, destinationIds));
}

export function normalizePlannerResultFeatures(value) {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_PLANNER_RESULT_FEATURES).map(([key, fallback]) => {
    const decision = source[key];
    return [key, isObject(decision) && typeof decision.enabled === "boolean" ? decision : fallback];
  }));
}

export function selectPlannerResultMode(features, result) {
  const normalized = normalizePlannerResultFeatures(features);
  return normalized.planner_structured_results.enabled && isPlannerResultV2(result)
    ? PLANNER_RESULT_FORMAT.STRUCTURED
    : PLANNER_RESULT_FORMAT.LEGACY;
}

export function plannerResultForStorage(result) {
  if (!isPlannerResultV2(result)) return null;
  return {
    version: PLANNER_RESULT_VERSION,
    result_format: PLANNER_RESULT_FORMAT.STRUCTURED,
    request_snapshot: result.request_snapshot,
    summary: result.summary,
    days: result.days,
    destination_ids: result.destination_ids,
    partner_matches: result.partner_matches.map((match) => ({
      partner_id: match.partner_id,
      type: match.type,
      destination_ids: match.destination_ids,
      offering_ids: match.offering_ids,
      match_reasons: match.match_reasons,
      relevance_score: match.relevance_score || 0,
      match_factor_codes: match.match_factor_codes || [],
      placement: match.placement,
    })),
    travel_notes: result.travel_notes,
    travel_tips: result.travel_tips,
    generated_at: result.generated_at,
  };
}

export function hydratedDestinationsFromTrip(trip) {
  return isPlannerResultV2(trip?.structured_result)
    ? trip.structured_result.destinations
    : null;
}
