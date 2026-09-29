import { withApi } from "@/lib/server/handler";
import { cursorWhere, parseProjectStatus } from "@/lib/server/filters";
import { mapProject, type Row } from "@/lib/server/mappers";
import { ApiError } from "@/lib/server/errors";
import { enumValue, optionalDate, optionalText, pageWindow, paginationResponse, readJsonObject, requiredText } from "@/lib/server/validation";

const PROJECT_STATUSES = ["active", "on_hold", "completed", "archived"] as const;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const { limit, cursor } = pageWindow(search);
  const status = parseProjectStatus(search);
  const rows = await prisma.project.findMany({
    where: { AND: [{ userId }, ...(status ? [{ status }] : []), ...(cursor ? [cursorWhere(cursor, "updatedAt")] : [])] },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = paginationResponse(rows as (Row & { id: string; updatedAt: Date })[], limit, "updatedAt");
  return Response.json({ data: page.data.map(mapProject), pagination: page.pagination });
});

export const POST = withApi(async (request, { prisma, userId }) => {
  const body = await readJsonObject(request, ["name", "description", "status", "color", "startDate", "targetDate"]);
  let name: string;
  let description: string | null | undefined;
  let status: string;
  let color: string | null | undefined;
  let startDate: Date | null | undefined;
  let targetDate: Date | null | undefined;
  try {
    name = requiredText(body.name, "name", 200);
    description = optionalText(body.description, "description", 20_000);
    status = enumValue(body.status, "status", PROJECT_STATUSES, "active").toUpperCase();
    color = optionalText(body.color, "color", 7);
    if (color && !COLOR_RE.test(color)) {
      throw new ApiError(422, "VALIDATION_ERROR", "color must be a six-digit hexadecimal color.", [{ field: "color", message: "Expected #RRGGBB." }]);
    }
    startDate = optionalDate(body.startDate, "startDate");
    targetDate = optionalDate(body.targetDate, "targetDate");
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      throw new ApiError(400, "BAD_REQUEST", error.message, error.errors);
    }
    throw error;
  }
  const row = await prisma.project.create({
    data: {
      userId,
      name,
      ...(description !== undefined ? { description } : {}),
      status,
      ...(color !== undefined ? { color } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(targetDate !== undefined ? { targetDate } : {}),
    },
  });
  return Response.json({ data: mapProject(row) }, { status: 201 });
});
