export const PLANNER_PARTNER_GROUP_ORDER = Object.freeze([
  "guide",
  "homestay",
  "culinary",
  "souvenir",
  "rental",
]);

const stableUnique = (values) => [...new Set(values.filter(Boolean))];

export function groupPlannerRecommendations(recommendations, { includeCulinary = false } = {}) {
  const allowedTypes = new Set(includeCulinary
    ? PLANNER_PARTNER_GROUP_ORDER
    : PLANNER_PARTNER_GROUP_ORDER.filter((type) => type !== "culinary"));
  const merged = new Map();

  for (const recommendation of Array.isArray(recommendations) ? recommendations : []) {
    const partner = recommendation?.partner;
    const partnerId = recommendation?.partner_id || partner?.id;
    const type = recommendation?.type || partner?.type;
    if (!partner || !partnerId || !allowedTypes.has(type)) continue;

    const destinationIds = stableUnique([
      ...(Array.isArray(recommendation.destination_ids) ? recommendation.destination_ids : []),
      recommendation.destination_id,
    ]);
    const destinationNames = stableUnique([
      ...(Array.isArray(recommendation.destination_names) ? recommendation.destination_names : []),
      recommendation.destination_name,
    ]);
    const matchReasons = stableUnique(recommendation.match_reasons || []).slice(0, 3);
    const current = merged.get(partnerId);
    if (current) {
      current.destination_ids = stableUnique([...current.destination_ids, ...destinationIds]);
      current.destination_names = stableUnique([...current.destination_names, ...destinationNames]);
      current.match_reasons = stableUnique([...current.match_reasons, ...matchReasons]).slice(0, 3);
      if (recommendation.placement === "featured") current.placement = "featured";
      continue;
    }

    merged.set(partnerId, {
      ...recommendation,
      partner_id: partnerId,
      type,
      destination_id: destinationIds[0] || null,
      destination_name: destinationNames[0] || "",
      destination_ids: destinationIds,
      destination_names: destinationNames,
      match_reasons: matchReasons,
      placement: recommendation.placement === "featured" ? "featured" : "organic",
      partner,
    });
  }

  const perTypeCounts = new Map();
  const limited = [];
  for (const item of merged.values()) {
    if (limited.length >= 8) break;
    const count = perTypeCounts.get(item.type) || 0;
    if (count >= 2) continue;
    limited.push(item);
    perTypeCounts.set(item.type, count + 1);
  }
  return PLANNER_PARTNER_GROUP_ORDER
    .filter((type) => allowedTypes.has(type))
    .map((type) => ({ type, items: limited.filter((item) => item.type === type) }))
    .filter((group) => group.items.length > 0);
}
