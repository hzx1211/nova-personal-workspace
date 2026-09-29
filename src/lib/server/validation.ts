import { ApiError } from "./errors";

export type JsonObject = Record<string, unknown>;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function badRequest(message: string, field?: string): never {
  throw new ApiError(400, "BAD_REQUEST", message, field ? [{ field, message }] : undefined);
}

export function validationError(message: string, field?: string): never {
  throw new ApiError(422, "VALIDATION_ERROR", message, field ? [{ field, message }] : undefined);
}

export async function readJsonObject(request: Request, allowed: readonly string[]): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    badRequest("Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) badRequest("Request body must be a JSON object.");
  const object = value as JsonObject;
  const unknown = Object.keys(object).find((key) => !allowed.includes(key));
  if (unknown) badRequest(`Unknown field: ${unknown}.`, unknown);
  return object;
}

export function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    validationError(`${field} must be a non-empty string no longer than ${maxLength} characters.`, field);
  }
  return value.trim();
}

export function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) validationError(`${field} must be a string of at most ${maxLength} characters or null.`, field);
  return value;
}

export function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[], defaultValue?: T): T {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== "string" || !allowed.includes(value as T)) validationError(`${field} must be one of: ${allowed.join(", ")}.`, field);
  return value as T;
}

export function optionalEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  return enumValue(value, field, allowed);
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) validationError(`${field} must be a UUID.`, field);
  return value;
}

export function queryUuid(value: string | null, field: string): string {
  if (value === null || !UUID_RE.test(value)) badRequest(`${field} must be a UUID.`, field);
  return value;
}

export function optionalUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return uuid(value, field);
}

export function isoInstant(value: unknown, field: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    validationError(`${field} must be an RFC 3339 date-time.`, field);
  }
  return new Date(value);
}

export function queryInstant(value: string | null, field: string): Date {
  if (value === null || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    badRequest(`${field} must be an RFC 3339 date-time.`, field);
  }
  return new Date(value);
}

export function dateOnly(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) validationError(`${field} must be an ISO 8601 date (YYYY-MM-DD).`, field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) validationError(`${field} must be a valid calendar date.`, field);
  return value;
}

export function queryDate(value: string | null, field: string): string {
  if (value === null || !DATE_RE.test(value)) badRequest(`${field} must be an ISO 8601 date (YYYY-MM-DD).`, field);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) badRequest(`${field} must be a valid calendar date.`, field);
  return value;
}

export function optionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${dateOnly(value, field)}T00:00:00.000Z`);
}

export function boundedInteger(value: string | null, field: string, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) badRequest(`${field} must be an integer.`, field);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) badRequest(`${field} must be between ${min} and ${max}.`, field);
  return parsed;
}

export type CursorValue = { at: string; id: string };
export function encodeCursor(value: CursorValue): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
export function decodeCursor(value: string | null): CursorValue | undefined {
  if (value === null) return undefined;
  if (value.length > 512) badRequest("cursor exceeds 512 characters.", "cursor");
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") throw new Error("invalid");
    const cursor = decoded as Record<string, unknown>;
    if (typeof cursor.at !== "string" || !Number.isFinite(Date.parse(cursor.at)) || typeof cursor.id !== "string" || !UUID_RE.test(cursor.id)) throw new Error("invalid");
    return { at: new Date(cursor.at).toISOString(), id: cursor.id };
  } catch {
    badRequest("cursor is invalid.", "cursor");
  }
}

export function pageWindow(search: URLSearchParams): { limit: number; cursor?: CursorValue } {
  return { limit: boundedInteger(search.get("limit"), "limit", 20, 1, 100), cursor: decodeCursor(search.get("cursor")) };
}

export function paginationResponse<T extends { id: string; createdAt?: Date | string; updatedAt?: Date | string }>(rows: T[], limit: number, dateField: "createdAt" | "updatedAt"): { data: T[]; pagination: { nextCursor: string | null; hasMore: boolean } } {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  const at = last?.[dateField];
  return {
    data,
    pagination: {
      nextCursor: hasMore && last && at ? encodeCursor({ at: new Date(at).toISOString(), id: last.id }) : null,
      hasMore,
    },
  };
}
