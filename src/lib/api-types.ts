/** API DTOs mirror docs/openapi.yaml (OpenAPI 3.1); UI demo models live separately in types.ts. */
export type UUID = string;
export type DateTime = string; // RFC 3339 instant; responses normalized to UTC.
export type DateOnly = string; // ISO 8601 local calendar date, not a UTC instant.
export interface ApiEnvelope<T> { data: T }
export interface ApiPage<T> { data: T[]; pagination: { nextCursor: string | null; hasMore: boolean } }
export interface PageQuery { cursor?: string; limit?: number; }
export interface ApiProblem { type?: string; title: string; status: number; detail?: string; code?: string; requestId?: string; errors?: { field: string; message: string }[] }
export interface ApiInboxItem { id: UUID; title: string; body: string | null; status: "open" | "processed" | "archived"; source: string | null; processedAt: DateTime | null; createdAt: DateTime; updatedAt: DateTime }
export interface InboxItemInput { title: string; body?: string | null; source?: string | null }
export interface InboxItemPatch { title?: string; body?: string | null; source?: string | null; status?: ApiInboxItem["status"] }
export type ApiTaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type ApiPriority = "low" | "medium" | "high" | "urgent";
export interface ApiTask { id: UUID; title: string; description: string | null; status: ApiTaskStatus; priority: ApiPriority; dueAt: DateTime | null; completedAt: DateTime | null; projectId: UUID | null; estimatedMinutes: number | null; createdAt: DateTime; updatedAt: DateTime }
export interface TaskInput { title: string; description?: string | null; status?: ApiTaskStatus; priority?: ApiPriority; dueAt?: DateTime | null; projectId?: UUID | null; estimatedMinutes?: number | null }
export type TaskPatch = Partial<TaskInput>;
export type ApiProjectStatus = "active" | "on_hold" | "completed" | "archived";
export interface ApiProject { id: UUID; name: string; description: string | null; status: ApiProjectStatus; color: string | null; startDate: DateOnly | null; targetDate: DateOnly | null; createdAt: DateTime; updatedAt: DateTime }
export interface ProjectInput { name: string; description?: string | null; status?: ApiProjectStatus; color?: string | null; startDate?: DateOnly | null; targetDate?: DateOnly | null }
export type ProjectPatch = Partial<ProjectInput>;
export interface ApiCalendarEvent { id: UUID; title: string; description: string | null; startsAt: DateTime; endsAt: DateTime; allDay: boolean; timezone: string; location: string | null; taskId: UUID | null; createdAt: DateTime; updatedAt: DateTime }
export interface CalendarEventInput { title: string; description?: string | null; startsAt: DateTime; endsAt: DateTime; allDay?: boolean; timezone?: string; location?: string | null; taskId?: UUID | null }
export type CalendarEventPatch = Partial<CalendarEventInput>;
export interface ApiNote { id: UUID; title: string; content: string; contentFormat: "markdown" | "plain_text"; pinned: boolean; tags: string[]; createdAt: DateTime; updatedAt: DateTime }
export interface NoteInput { title: string; content?: string; contentFormat?: ApiNote["contentFormat"]; pinned?: boolean; tags?: string[] }
export type NotePatch = Partial<NoteInput>;
export interface ApiFile { id: UUID; name: string; mimeType: string; sizeBytes: number; storageKey: string; downloadUrl: string | null; createdAt: DateTime; updatedAt: DateTime }
export interface FileInput { name: string; mimeType: string; sizeBytes: number; storageKey: string }
export interface FilePatch { name?: string }
export interface LearningDeck { id: UUID; code: string; name: string; exam: "CET4" | "CET6"; totalWords: number; dueCount: number; learnedCount: number }
export type ReviewAnswer = "again" | "hard" | "good" | "easy";
export interface ReviewQueueItem { wordId: UUID; spelling: string; phonetic: string | null; definition: string; example: string | null; state: "new" | "learning" | "review"; dueAt: DateTime | null; reviewProgressId: UUID | null }
export interface ReviewQueue { deckId: UUID; items: ReviewQueueItem[]; dueCount: number; newCount: number }
export interface ReviewSubmission { wordId: UUID; clientAttemptId: UUID; answer: ReviewAnswer; responseMs: number }
export interface ReviewResult { attemptId: UUID; wordId: UUID; answer: ReviewAnswer; correct: boolean; nextDueAt: DateTime | null; intervalDays: number; repetitions: number; reviewedAt: DateTime }
export type FocusStatus = "running" | "completed" | "cancelled" | "interrupted";
export interface ApiFocusSession { id: UUID; taskId: UUID | null; status: FocusStatus; startedAt: DateTime; endedAt: DateTime | null; targetSeconds: number; elapsedSeconds: number; note: string | null; createdAt: DateTime; updatedAt: DateTime }
export interface FocusSessionInput { taskId?: UUID | null; targetSeconds?: number; note?: string | null }
export interface FocusSessionPatch { taskId?: UUID | null; note?: string | null }
export interface ApiHabit { id: UUID; name: string; description: string | null; frequency: "daily" | "weekly"; targetPerWeek: number; color: string | null; archived: boolean; createdAt: DateTime; updatedAt: DateTime }
export interface HabitInput { name: string; description?: string | null; frequency?: ApiHabit["frequency"]; targetPerWeek?: number; color?: string | null }
export type HabitPatch = Partial<HabitInput & { archived: boolean }>;
export interface ApiHabitEntry { id: UUID; habitId: UUID; date: DateOnly; completed: boolean; note: string | null; createdAt: DateTime }
export interface HabitEntryInput { date: DateOnly; completed: boolean; note?: string | null }
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export interface ApiGoal { id: UUID; title: string; description: string | null; status: GoalStatus; progress: number; targetDate: DateOnly | null; createdAt: DateTime; updatedAt: DateTime }
export interface GoalInput { title: string; description?: string | null; status?: GoalStatus; progress?: number; targetDate?: DateOnly | null }
export type GoalPatch = Partial<GoalInput>;
export interface ApiNotification { id: UUID; type: string; title: string; body: string | null; resourceType: string | null; resourceId: UUID | null; readAt: DateTime | null; createdAt: DateTime }
export interface NotificationPatch { read: boolean }
export interface ApiSearchResult { type: "inbox" | "task" | "project" | "event" | "note" | "file"; id: UUID; title: string; snippet: string | null; updatedAt: DateTime; href: string }
export interface ApiSettings { timezone: string; locale: string; weekStartsOn: number; pomodoroWorkSeconds: number; pomodoroShortBreakSeconds: number; pomodoroLongBreakSeconds: number; dailyReviewGoal: number }
export type SettingsPatch = Partial<ApiSettings>;
export interface ApiDashboard { date: DateOnly; timezone: string; counts: { inboxOpen: number; tasksOpen: number; tasksCompletedToday: number; unreadNotifications: number }; tasksDueToday: ApiTask[]; upcomingEvents: ApiCalendarEvent[]; activeProjects: ApiProject[]; habitsToday: { habit: ApiHabit; completedToday: boolean }[]; learning: { dueCount: number; reviewedToday: number; dailyGoal: number }; focus: { activeSession: ApiFocusSession | null; completedToday: number; focusSecondsToday: number }; goals: ApiGoal[] }
export interface ApiAnalyticsSummary { from: DateOnly; to: DateOnly; timezone: string; totals: { tasksCompleted: number; focusSeconds: number; reviewAttempts: number; habitCompletions: number }; days: { date: DateOnly; tasksCompleted: number; focusSeconds: number; reviewAttempts: number; habitCompletions: number }[] }
