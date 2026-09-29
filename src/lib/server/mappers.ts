import { ApiError } from "./errors";
import type { PrismaLike } from "./prisma";
import { iso, nullableIso } from "./dates";

export type Row = Record<string, unknown>;
export const lower = (value: unknown): string => String(value).toLowerCase();
export const upper = (value: unknown): string => String(value).toUpperCase();
export const asRow = (value: unknown): Row => value as Row;

export function mapTask(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: lower(row.status),
    priority: lower(row.priority),
    dueAt: nullableIso(row.dueAt),
    completedAt: nullableIso(row.completedAt),
    projectId: row.projectId ?? null,
    estimatedMinutes: row.estimatedMinutes ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function mapProject(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: lower(row.status),
    color: row.color ?? null,
    startDate: row.startDate ? iso(row.startDate).slice(0, 10) : null,
    targetDate: row.targetDate ? iso(row.targetDate).slice(0, 10) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function mapCalendarEvent(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    allDay: row.allDay,
    timezone: row.timezone,
    location: row.location ?? null,
    taskId: row.taskId ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function mapHabit(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    frequency: lower(row.frequency),
    targetPerWeek: row.targetPerWeek,
    color: row.color ?? null,
    archived: row.archived,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function mapFocusSession(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    taskId: row.taskId ?? null,
    status: lower(row.status),
    startedAt: iso(row.startedAt),
    endedAt: nullableIso(row.endedAt),
    targetSeconds: row.targetSeconds,
    elapsedSeconds: row.elapsedSeconds,
    note: row.note ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function mapGoal(rowValue: unknown) {
  const row = asRow(rowValue);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: lower(row.status),
    progress: Number(row.progress),
    targetDate: row.targetDate ? iso(row.targetDate).slice(0, 10) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function rowId(row: Row): string {
  return String(row.id);
}

export async function ensureOwnedProject(prisma: PrismaLike, userId: string, projectId: string | null): Promise<void> {
  if (projectId === null) return;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project does not exist or is not visible to the current user.");
}
