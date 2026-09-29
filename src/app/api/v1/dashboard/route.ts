import { withApi } from "@/lib/server/handler";
import { localDate, startEndForDate, validateTimezone } from "@/lib/server/dates";
import { queryDate } from "@/lib/server/validation";
import { mapCalendarEvent, mapFocusSession, mapGoal, mapHabit, mapProject, mapTask } from "@/lib/server/mappers";

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const timezone = validateTimezone(search.get("timezone"));
  const requestedDate = search.get("date");
  const date = requestedDate === null ? localDate(new Date(), timezone) : queryDate(requestedDate, "date");
  const { start, end } = startEndForDate(date, timezone);
  const dateValue = new Date(`${date}T00:00:00.000Z`);

  const [inboxOpen, tasksOpen, tasksCompletedToday, unreadNotifications, dueTaskRows, eventRows, projectRows, habits, habitEntryRows, dueCount, reviewedToday, settings, activeSession, completedFocusRows, goalRows] = await Promise.all([
    prisma.inboxItem.count({ where: { userId, status: "OPEN" } }),
    prisma.task.count({ where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { userId, status: "DONE", completedAt: { gte: start, lt: end } } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.task.findMany({ where: { userId, dueAt: { gte: start, lt: end }, status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 100 }),
    prisma.calendarEvent.findMany({ where: { userId, startsAt: { gte: start, lt: end } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 100 }),
    prisma.project.findMany({ where: { userId, status: "ACTIVE" }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100 }),
    prisma.habit.findMany({ where: { userId, archived: false }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 }),
    prisma.habitEntry.findMany({ where: { userId, date: dateValue }, select: { habitId: true, completed: true } }),
    prisma.userWordProgress.count({ where: { userId, dueAt: { lte: new Date() } } }),
    prisma.reviewAttempt.count({ where: { userId, reviewedAt: { gte: start, lt: end } } }),
    prisma.userSettings.findFirst({ where: { userId }, select: { dailyReviewGoal: true } }),
    prisma.focusSession.findFirst({ where: { userId, status: "RUNNING" }, orderBy: { startedAt: "desc" } }),
    prisma.focusSession.findMany({ where: { userId, status: "COMPLETED", endedAt: { gte: start, lt: end } }, select: { elapsedSeconds: true } }),
    prisma.goal.findMany({ where: { userId, status: "ACTIVE" }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100 }),
  ]);

  const entriesByHabit = new Map(habitEntryRows.map((entry) => [String(entry.habitId), Boolean(entry.completed)]));
  const habitsToday = habits.map((habit) => ({ habit: mapHabit(habit), completedToday: entriesByHabit.get(String(habit.id)) ?? false }));
  const focusSecondsToday = completedFocusRows.reduce((total, session) => total + Number(session.elapsedSeconds ?? 0), 0);

  return Response.json({
    data: {
      date,
      timezone,
      counts: { inboxOpen, tasksOpen, tasksCompletedToday, unreadNotifications },
      tasksDueToday: dueTaskRows.map(mapTask),
      upcomingEvents: eventRows.map(mapCalendarEvent),
      activeProjects: projectRows.map(mapProject),
      habitsToday,
      learning: { dueCount, reviewedToday, dailyGoal: Number(settings?.dailyReviewGoal ?? 20) },
      focus: { activeSession: activeSession ? mapFocusSession(activeSession) : null, completedToday: completedFocusRows.length, focusSecondsToday },
      goals: goalRows.map(mapGoal),
    },
  });
});
