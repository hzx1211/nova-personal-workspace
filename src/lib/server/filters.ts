import { ApiError } from "./errors";
import { queryDate, queryInstant } from "./validation";
import type { CursorValue } from "./validation";

export function cursorWhere(cursor: CursorValue | undefined, field: "createdAt" | "updatedAt") {
  if (!cursor) return undefined;
  const at = new Date(cursor.at);
  return { OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: cursor.id } }] };
}

export function parseTaskFilters(search: URLSearchParams) {
  const status = search.get("status");
  const statuses = ["todo", "in_progress", "done", "cancelled"];
  if (status !== null && !statuses.includes(status)) throw new ApiError(400, "BAD_REQUEST", "status is not a supported task status.", [{ field: "status", message: "Use todo, in_progress, done, or cancelled." }]);
  const projectId = search.get("projectId");
  if (projectId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) throw new ApiError(400, "BAD_REQUEST", "projectId must be a UUID.", [{ field: "projectId", message: "projectId must be a UUID." }]);
  const dueFrom = search.get("dueFrom");
  const dueTo = search.get("dueTo");
  const from = dueFrom === null ? undefined : queryInstant(dueFrom, "dueFrom");
  const to = dueTo === null ? undefined : queryInstant(dueTo, "dueTo");
  if (from && to && from >= to) throw new ApiError(400, "BAD_REQUEST", "dueTo must be later than dueFrom.");
  const q = search.get("q");
  if (q !== null && q.length > 200) throw new ApiError(400, "BAD_REQUEST", "q must be at most 200 characters.", [{ field: "q", message: "q must be at most 200 characters." }]);
  return {
    ...(status ? { status: status.toUpperCase() } : {}),
    ...(projectId ? { projectId } : {}),
    ...(from || to ? { dueAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
  };
}

export function parseProjectStatus(search: URLSearchParams): string | undefined {
  const status = search.get("status");
  const statuses = ["active", "on_hold", "completed", "archived"];
  if (status !== null && !statuses.includes(status)) throw new ApiError(400, "BAD_REQUEST", "status is not a supported project status.", [{ field: "status", message: "Use active, on_hold, completed, or archived." }]);
  return status?.toUpperCase();
}

export function validateDateRange(fromValue: string | null, toValue: string | null): { from: string; to: string; days: number } {
  if (fromValue === null || toValue === null) throw new ApiError(400, "BAD_REQUEST", "from and to query parameters are required.");
  const from = queryDate(fromValue, "from");
  const to = queryDate(toValue, "to");
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days <= 0 || days > 366) throw new ApiError(400, "BAD_REQUEST", "to must be later than from, and the date range must not exceed 366 days.");
  return { from, to, days };
}
