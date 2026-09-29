import { ApiError } from "./errors";
import { dateOnly } from "./validation";

export function validateTimezone(value: string | null, required = true): string {
  if (value === null) {
    if (required) throw new ApiError(400, "BAD_REQUEST", "timezone query parameter is required.", [{ field: "timezone", message: "timezone query parameter is required." }]);
    return "UTC";
  }
  if (value.length > 64) throw new ApiError(400, "BAD_REQUEST", "timezone must be an IANA timezone.", [{ field: "timezone", message: "timezone must be an IANA timezone." }]);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "timezone must be a valid IANA timezone.", [{ field: "timezone", message: "timezone must be a valid IANA timezone." }]);
  }
}

export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/** Convert a wall-clock time in an IANA zone to UTC, including DST transitions. */
export function zonedDateTimeToUtc(date: string, timezone: string, hour = 0): Date {
  dateOnly(date, "date");
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const delta = target - represented;
    guess += delta;
    if (delta === 0) break;
  }
  return new Date(guess);
}

export function startEndForDate(date: string, timezone: string): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(date, timezone),
    end: zonedDateTimeToUtc(addCalendarDays(date, 1), timezone),
  };
}

export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

export function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}
