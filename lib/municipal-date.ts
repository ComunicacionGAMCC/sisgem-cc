export const MUNICIPAL_TIME_ZONE = "America/La_Paz";

const calendarPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MUNICIPAL_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function calendarParts(value: Date) {
  const parts = calendarPartsFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function getMunicipalIsoDate(value = new Date()) {
  const { year, month, day } = calendarParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMunicipalIsoDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Fecha municipal inválida.");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

export function formatMunicipalDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseMunicipalIsoDate(value)
    : new Date(value);
  return new Intl.DateTimeFormat("es-BO", {
    ...options,
    timeZone: MUNICIPAL_TIME_ZONE,
  }).format(date);
}

export function addMunicipalDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function capitalizeDateLabel(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function getMunicipalYear(value = new Date()) {
  return calendarParts(value).year;
}
