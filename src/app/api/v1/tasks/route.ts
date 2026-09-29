import { withApi } from "@/lib/server/handler";
import { cursorWhere, parseTaskFilters } from "@/lib/server/filters";
import { ensureOwnedProject, mapTask, type Row } from "@/lib/server/mappers";
import { ApiError } from "@/lib/server/errors";
import { enumValue, isoInstant, optionalText, optionalUuid, pageWindow, paginationResponse, readJsonObject, requiredText } from "@/lib/server/validation";

const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const { limit, cursor } = pageWindow(search);
  const filters = parseTaskFilters(search);
  const rows = await prisma.task.findMany({
    where: { AND: [{ userId }, filters, ...(cursor ? [cursorWhere(cursor, "createdAt")] : [])] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = paginationResponse(rows as (Row & { id: string; createdAt: Date })[], limit, "createdAt");
  return Response.json({ data: page.data.map(mapTask), pagination: page.pagination });
});

export const POST = withApi(async (request, { prisma, userId }) => {
  const body = await readJsonObject(request, ["title", "description", "status", "priority", "dueAt", "projectId", "estimatedMinutes"]);
  const title = requiredText(body.title, "title", 300);
  const description = optionalText(body.description, "description", 20_000);
  const status = enumValue(body.status, "status", TASK_STATUSES, "todo").toUpperCase();
  const priority = enumValue(body.priority, "priority", TASK_PRIORITIES, "medium").toUpperCase();
  const dueAt = body.dueAt === undefined || body.dueAt === null ? body.dueAt : isoInstant(body.dueAt, "dueAt");
  const projectId = optionalUuid(body.projectId, "projectId");
  const estimatedMinutes = body.estimatedMinutes;
  if (estimatedMinutes !== undefined && estimatedMinutes !== null && (typeof estimatedMinutes !== "number" || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1)) {
    throw new ApiError(422, "VALIDATION_ERROR", "estimatedMinutes must be an integer greater than or equal to 1.", [{ field: "estimatedMinutes", message: "estimatedMinutes must be at least 1." }]);
  }
  await ensureOwnedProject(prisma, userId, projectId ?? null);
  const row = await prisma.task.create({
    data: {
      userId,
      title,
      ...(description !== undefined ? { description } : {}),
      status,
      priority,
      ...(dueAt !== undefined ? { dueAt } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
      ...(status === "DONE" ? { completedAt: new Date() } : {}),
    },
  });
  return Response.json({ data: mapTask(row) }, { status: 201 });
});
