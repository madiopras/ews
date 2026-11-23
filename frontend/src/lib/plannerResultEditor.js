function rebuildDestinationIds(days) {
  const ids = [];
  const seen = new Set();
  for (const day of days) {
    for (const stop of day.stops || []) {
      if (stop.destination_id && !seen.has(stop.destination_id)) {
        seen.add(stop.destination_id);
        ids.push(stop.destination_id);
      }
    }
  }
  return ids;
}

function normalizePartnerMatches(matches, destinationIdSet) {
  return (Array.isArray(matches) ? matches : [])
    .map((match) => {
      const remaining = (match.destination_ids || []).filter((id) => destinationIdSet.has(id));
      if (!remaining.length) return null;
      return { ...match, destination_ids: remaining };
    })
    .filter(Boolean);
}

function destinationToPlannerCard(dest) {
  return {
    id: String(dest.id),
    name: String(dest.name || "").slice(0, 150),
    name_en: String(dest.name_en || "").slice(0, 150),
    location: String(dest.location || "").slice(0, 200),
    category: String(dest.category || "nature").slice(0, 50),
    images: Array.isArray(dest.images) ? dest.images.filter(Boolean).slice(0, 10) : [],
    description: String(dest.description || "").slice(0, 600),
    description_en: String(dest.description_en || "").slice(0, 600),
    latitude: dest.latitude ?? null,
    longitude: dest.longitude ?? null,
  };
}

export function moveStopInDay(result, dayNumber, stopIndex, direction) {
  if (!result || !Array.isArray(result.days)) return result;
  const days = result.days.map((day) => {
    if (day.day !== dayNumber) return day;
    const stops = [...day.stops];
    const target = stopIndex + direction;
    if (stopIndex < 0 || stopIndex >= stops.length || target < 0 || target >= stops.length) {
      return day;
    }
    const [moved] = stops.splice(stopIndex, 1);
    stops.splice(target, 0, moved);
    return { ...day, stops };
  });
  const destinationIds = rebuildDestinationIds(days);
  return { ...result, days, destination_ids: destinationIds };
}

export function removeStopFromResult(result, dayNumber, stopIndex) {
  if (!result || !Array.isArray(result.days)) return result;
  const targetDay = result.days.find((day) => day.day === dayNumber);
  if (!targetDay || targetDay.stops.length <= 1) return result;

  const days = result.days.map((day) => (
    day.day === dayNumber
      ? { ...day, stops: day.stops.filter((_, idx) => idx !== stopIndex) }
      : day
  ));
  const destinationIds = rebuildDestinationIds(days);
  const destinationIdSet = new Set(destinationIds);
  const destinations = (result.destinations || []).filter((dest) => destinationIdSet.has(dest.id));
  const partnerMatches = normalizePartnerMatches(result.partner_matches, destinationIdSet);

  return {
    ...result,
    days,
    destination_ids: destinationIds,
    destinations,
    partner_matches: partnerMatches,
  };
}

export function swapStopDestination(result, dayNumber, stopIndex, replacement, lang = "id") {
  if (!result || !Array.isArray(result.days) || !replacement?.id) return result;
  const replacementId = String(replacement.id);
  const card = destinationToPlannerCard(replacement);
  const displayName = lang === "en" && card.name_en ? card.name_en : card.name;

  const days = result.days.map((day) => {
    if (day.day !== dayNumber) return day;
    const stops = day.stops.map((stop, idx) => {
      if (idx !== stopIndex) return stop;
      const defaultActivity = lang === "en"
        ? `Explore ${displayName}${card.location ? ` in ${card.location}` : ""}.`
        : `Menjelajahi ${displayName}${card.location ? ` di ${card.location}` : ""}.`;
      return {
        ...stop,
        destination_id: replacementId,
        activity: card.description ? card.description.slice(0, 320) : defaultActivity,
      };
    });
    return { ...day, stops };
  });

  const destinationIds = rebuildDestinationIds(days);
  const destinationIdSet = new Set(destinationIds);
  const existingMap = new Map((result.destinations || []).map((item) => [item.id, item]));
  existingMap.set(replacementId, card);
  const destinations = destinationIds
    .map((id) => existingMap.get(id))
    .filter(Boolean);
  const partnerMatches = normalizePartnerMatches(result.partner_matches, destinationIdSet);

  return {
    ...result,
    days,
    destination_ids: destinationIds,
    destinations,
    partner_matches: partnerMatches,
  };
}

export function structuredResultToPlainMarkdown(result, lang = "id") {
  if (!result) return "";
  const destinationMap = new Map((result.destinations || []).map((item) => [item.id, item]));
  const lines = [result.summary || ""];
  for (const day of result.days || []) {
    lines.push("", `## ${lang === "en" ? "Day" : "Hari"} ${day.day}: ${day.title}`);
    if (day.area_label) lines.push(`**${day.area_label}**`);
    if (day.description) lines.push(day.description);
    for (const stop of day.stops || []) {
      const dest = destinationMap.get(stop.destination_id);
      const name = dest
        ? (lang === "en" && dest.name_en ? dest.name_en : dest.name)
        : stop.destination_id;
      const details = [stop.time_label, dest?.location].filter(Boolean).join(" · ");
      lines.push("", `### ${name}`);
      if (details) lines.push(`*${details}*`);
      if (stop.activity) lines.push(stop.activity);
      if (stop.practical_tip) {
        lines.push(`**${lang === "en" ? "Practical tip" : "Tip praktis"}:** ${stop.practical_tip}`);
      }
    }
  }
  return lines.join("\n").trim();
}
