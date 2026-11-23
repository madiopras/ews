const PERIOD_HOURS = {
  morning: [9, 11],
  afternoon: [13, 16],
  evening: [18, 20],
  flexible: [10, 12],
};

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function pad2(num) {
  return String(num).padStart(2, "0");
}

function formatIcsLocalDateTime(dateObj, hour) {
  const yyyy = dateObj.getFullYear();
  const mm = pad2(dateObj.getMonth() + 1);
  const dd = pad2(dateObj.getDate());
  return `${yyyy}${mm}${dd}T${pad2(hour)}0000`;
}

export function formatItineraryForWhatsapp({
  title = "",
  result = null,
  fallbackContent = "",
  lang = "id",
  origin = "",
} = {}) {
  const isEn = lang === "en";
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");

  if (!result || !Array.isArray(result.days)) {
    const header = title ? `*${title}*\n\n` : "";
    const footer = isEn
      ? "\n\nPlanned with Explore Wisata Sumut AI Trip Planner"
      : "\n\nDisusun dengan AI Trip Planner Explore Wisata Sumut";
    return `${header}${String(fallbackContent || "").trim()}${footer}`.trim();
  }

  const destinationMap = new Map(
    (result.destinations || []).map((item) => [item.id, item]),
  );
  const heading = title || (
    isEn
      ? `${result.request_snapshot?.days || result.days.length}-Day North Sumatra Trip`
      : `Itinerary Wisata Sumut ${result.request_snapshot?.days || result.days.length} Hari`
  );

  const lines = [`*${heading}*`];
  if (result.summary) lines.push("", result.summary);

  for (const day of result.days) {
    const dayLabel = isEn ? `Day ${day.day}` : `Hari ${day.day}`;
    const areaPart = day.area_label ? ` (${day.area_label})` : "";
    lines.push("", `*${dayLabel}: ${day.title}*${areaPart}`);
    for (const stop of day.stops || []) {
      const dest = destinationMap.get(stop.destination_id);
      const name = dest
        ? (isEn && dest.name_en ? dest.name_en : dest.name)
        : stop.destination_id;
      const timePrefix = stop.time_label ? `[${stop.time_label}] ` : "";
      const locSuffix = dest?.location ? ` — ${dest.location}` : "";
      lines.push(`• ${timePrefix}*${name}*${locSuffix}`);
      if (stop.activity) lines.push(`  ${stop.activity}`);
      if (baseOrigin && dest?.id) {
        lines.push(`  ${baseOrigin}/destination/${dest.id}`);
      }
    }
  }

  if (result.travel_tips?.length) {
    lines.push("", isEn ? "*Travel Tips:*" : "*Tips Perjalanan:*");
    for (const tip of result.travel_tips.slice(0, 5)) {
      lines.push(`- ${tip}`);
    }
  }

  lines.push(
    "",
    isEn
      ? "_Planned with Explore Wisata Sumut AI Trip Planner_"
      : "_Disusun dengan AI Trip Planner Explore Wisata Sumut_",
  );
  return lines.join("\n").trim();
}

export function buildItineraryIcs({
  title = "",
  result = null,
  lang = "id",
  startDate = null,
} = {}) {
  if (!result || !Array.isArray(result.days) || result.days.length === 0) return "";
  const isEn = lang === "en";
  const destinationMap = new Map(
    (result.destinations || []).map((item) => [item.id, item]),
  );

  const baseDate = startDate instanceof Date && !Number.isNaN(startDate.getTime())
    ? new Date(startDate.getTime())
    : (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    })();
  const stamp = `${baseDate.getUTCFullYear()}${pad2(baseDate.getUTCMonth() + 1)}${pad2(baseDate.getUTCDate())}T000000Z`;
  const tripPrefix = title || (isEn ? "North Sumatra Trip" : "Wisata Sumut");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Explore Wisata Sumut//AI Trip Planner//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(tripPrefix)}`,
  ];

  for (const day of result.days) {
    const dayDate = new Date(baseDate.getTime());
    dayDate.setDate(baseDate.getDate() + Math.max(0, Number(day.day) - 1));
    (day.stops || []).forEach((stop, index) => {
      const dest = destinationMap.get(stop.destination_id);
      const name = dest
        ? (isEn && dest.name_en ? dest.name_en : dest.name)
        : stop.destination_id;
      const [baseStart, baseEnd] = PERIOD_HOURS[stop.period] || PERIOD_HOURS.flexible;
      const startHour = Math.min(21, baseStart + Math.min(index, 2));
      const endHour = Math.min(22, Math.max(startHour + 1, baseEnd));
      const summary = `${isEn ? "Day" : "Hari"} ${day.day}: ${name}`;
      const descriptionParts = [
        day.title,
        stop.activity,
        stop.practical_tip ? `${isEn ? "Tip" : "Tip"}: ${stop.practical_tip}` : "",
      ].filter(Boolean);

      lines.push(
        "BEGIN:VEVENT",
        `UID:ews-day${day.day}-stop${index + 1}-${stop.destination_id}@explorewisatasumut`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatIcsLocalDateTime(dayDate, startHour)}`,
        `DTEND:${formatIcsLocalDateTime(dayDate, endHour)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `LOCATION:${escapeIcsText(dest?.location || day.area_label || "Sumatera Utara")}`,
        `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
        "END:VEVENT",
      );
    });
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadItineraryIcs(options = {}) {
  const ics = buildItineraryIcs(options);
  if (!ics) return false;
  const filename = `${String(options.title || "explore-wisata-sumut-trip")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "trip"}.ics`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
