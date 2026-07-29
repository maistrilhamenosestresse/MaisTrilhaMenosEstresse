const TRAIL_TIME_ZONE = "America/Sao_Paulo";

function datePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value || "";
}

export function getTrailToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TRAIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}`;
}

export function isArchivedTrailDate(date: unknown, now = new Date()) {
  const normalized = String(date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) && normalized < getTrailToday(now);
}
