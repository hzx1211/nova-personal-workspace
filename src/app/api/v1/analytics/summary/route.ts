import { withApi } from "@/lib/server/handler";
import { addCalendarDays, localDate, validateTimezone, zonedDateTimeToUtc } from "@/lib/server/dates";
import { validateDateRange } from "@/lib/server/filters";

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const { from, to, days } = validateDateRange(search.get("from"), search.get("to"));
  const timezone = validateTimezone(search.get("timezone"));
  const start = zonedDateTimeToUtc(from, timezone);
  const end = zonedDateTimeToUtc(to, timezone);
  const dateStart = new Date(`${from}T00:00:00.000Z`);
  const dateEnd = new Date(`${to}T00:00:00.000Z`);

  const [tasks, focusSessions, reviews, habitEntries] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: "DONE", completedAt: { gte: start, lt: end } }, select: { completedAt: true } }),
    prisma.focusSession.findMany({ where: { userId, status: "COMPLETED", endedAt: { gte: start, lt: end } }, select: { endedAt: true, elapsedSeconds: true } }),
    prisma.reviewAttempt.findMany({ where: { userId, reviewedAt: { gte: start, lt: end } }, select: { reviewedAt: true } }),
    prisma.habitEntry.findMany({ where: { userId, completed: true, date: { gte: dateStart, lt: dateEnd } }, select: { date: true } }),
  ]);

  type Day = { date: string; tasksCompleted: number; focusSeconds: number; reviewAttempts: number; habitCompletions: number };
  const series = new Map<string, Day>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = addCalendarDays(from, offset);
    series.set(date, { date, tasksCompleted: 0, focusSeconds: 0, reviewAttempts: 0, habitCompletions: 0 });
  }
  const bucket = (date: string) => series.get(date);
  for (const row of tasks) {
    if (row.completedAt) { const day = bucket(localDate(new Date(String(row.completedAt)), timezone)); if (day) day.tasksCompleted += 1; }
  }
  for (const row of focusSessions) {
    if (row.endedAt) { const day = bucket(localDate(new Date(String(row.endedAt)), timezone)); if (day) day.focusSeconds += Number(row.elapsedSeconds ?? 0); }
  }
  for (const row of reviews) {
    const day = bucket(localDate(new Date(String(row.reviewedAt)), timezone)); if (day) day.reviewAttempts += 1;
  }
  for (const row of habitEntries) {
    const raw = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
    const day = bucket(raw); if (day) day.habitCompletions += 1;
  }
  const values = [...series.values()];
  const totals = values.reduce((sum, day) => ({
    tasksCompleted: sum.tasksCompleted + day.tasksCompleted,
    focusSeconds: sum.focusSeconds + day.focusSeconds,
    reviewAttempts: sum.reviewAttempts + day.reviewAttempts,
    habitCompletions: sum.habitCompletions + day.habitCompletions,
  }), { tasksCompleted: 0, focusSeconds: 0, reviewAttempts: 0, habitCompletions: 0 });

  return Response.json({ data: { from, to, timezone, totals, days: values } });
});
