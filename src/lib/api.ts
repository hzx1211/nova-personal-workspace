import type {
  ApiAnalyticsSummary, ApiCalendarEvent, ApiDashboard, ApiEnvelope, ApiFile, ApiFocusSession, ApiGoal, ApiHabit, ApiHabitEntry, ApiInboxItem, ApiNote, ApiNotification, ApiPage, ApiProject, ApiSettings, ApiTask, ApiProblem, CalendarEventInput, CalendarEventPatch, FileInput, FilePatch, FocusSessionInput, FocusSessionPatch, GoalInput, GoalPatch, HabitEntryInput, HabitInput, HabitPatch, InboxItemInput, InboxItemPatch, NoteInput, NotePatch, NotificationPatch, PageQuery, ProjectInput, ProjectPatch, ReviewQueue, ReviewResult, ReviewSubmission, SettingsPatch, TaskInput, TaskPatch,
} from "./api-types";

/** Empty base URL deliberately resolves to same-origin /api/v1 per docs/openapi.yaml. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
export const API_ROOT = `${API_BASE_URL}/api/v1`;
/** Demo mode is opt-in; a missing API base URL never silently switches adapters. */
export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "api";
export const isDemoMode = DATA_MODE === "demo";
export const isApiConfigured = !isDemoMode;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string, readonly requestId?: string) {
    super(message); this.name = "ApiError";
  }
}
function safeStatusMessage(status: number): string {
  if (status === 400 || status === 422) return "请求内容未通过校验，请检查输入。";
  if (status === 401) return "当前会话未验证，请先完成服务端配置。";
  if (status === 403 || status === 404) return "资源不存在或当前不可访问。";
  if (status === 409) return "数据状态已变化，请刷新后重试。";
  if (status === 429) return "请求过于频繁，请稍后重试。";
  return "服务暂时不可用，请稍后重试。";
}
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const route = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json, application/problem+json");
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${route}`, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError("无法连接工作台 API，请检查网络或服务状态。");
  }
  if (!response.ok) {
    let problem: Partial<ApiProblem> = {};
    try { problem = await response.json() as Partial<ApiProblem>; } catch { /* Do not surface arbitrary body text. */ }
    // Deliberately do not show server detail/title: a cross-user object is indistinguishable from not found.
    throw new ApiError(safeStatusMessage(response.status), response.status, problem.code, problem.requestId);
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ApiError("服务返回的数据格式无法读取。", response.status); }
}
function query(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") params.set(key, String(value)); });
  const value = params.toString();
  return value ? `?${value}` : "";
}
function paging(params: PageQuery = {}) {
  return { cursor: params.cursor, limit: params.limit === undefined ? undefined : Math.max(1, Math.min(100, Math.trunc(params.limit))) };
}
const itemPath = (base: string, id: string) => `${base}/${encodeURIComponent(id)}`;

/** Typed endpoint surface follows operationIds and routes in docs/openapi.yaml. No userId is accepted. */
export const api = {
  dashboard: (params: { timezone: string; date?: string }) => apiRequest<ApiEnvelope<ApiDashboard>>(`/dashboard${query(params)}`),
  inbox: {
    list: (params: PageQuery & { status?: "open" | "processed" | "archived"; q?: string } = {}) => apiRequest<ApiPage<ApiInboxItem>>(`/inbox-items${query({ ...paging(params), status: params.status, q: params.q })}`),
    create: (body: InboxItemInput) => apiRequest<ApiEnvelope<ApiInboxItem>>("/inbox-items", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiInboxItem>>(itemPath("/inbox-items", id)),
    update: (id: string, body: InboxItemPatch) => apiRequest<ApiEnvelope<ApiInboxItem>>(itemPath("/inbox-items", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/inbox-items", id), { method: "DELETE" }),
  },
  tasks: {
    list: (params: PageQuery & { status?: ApiTask["status"]; projectId?: string; dueFrom?: string; dueTo?: string; q?: string } = {}) => apiRequest<ApiPage<ApiTask>>(`/tasks${query({ ...params, ...paging(params) })}`),
    create: (body: TaskInput) => apiRequest<ApiEnvelope<ApiTask>>("/tasks", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiTask>>(itemPath("/tasks", id)),
    update: (id: string, body: TaskPatch) => apiRequest<ApiEnvelope<ApiTask>>(itemPath("/tasks", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/tasks", id), { method: "DELETE" }),
  },
  projects: {
    list: (params: PageQuery & { status?: ApiProject["status"] } = {}) => apiRequest<ApiPage<ApiProject>>(`/projects${query({ ...paging(params), status: params.status })}`),
    create: (body: ProjectInput) => apiRequest<ApiEnvelope<ApiProject>>("/projects", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiProject>>(itemPath("/projects", id)),
    update: (id: string, body: ProjectPatch) => apiRequest<ApiEnvelope<ApiProject>>(itemPath("/projects", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/projects", id), { method: "DELETE" }),
  },
  calendar: {
    list: (params: PageQuery & { from: string; to: string }) => apiRequest<ApiPage<ApiCalendarEvent>>(`/calendar/events${query({ ...paging(params), from: params.from, to: params.to })}`),
    create: (body: CalendarEventInput) => apiRequest<ApiEnvelope<ApiCalendarEvent>>("/calendar/events", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiCalendarEvent>>(itemPath("/calendar/events", id)),
    update: (id: string, body: CalendarEventPatch) => apiRequest<ApiEnvelope<ApiCalendarEvent>>(itemPath("/calendar/events", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/calendar/events", id), { method: "DELETE" }),
  },
  notes: {
    list: (params: PageQuery & { q?: string; pinned?: boolean } = {}) => apiRequest<ApiPage<ApiNote>>(`/notes${query({ ...paging(params), q: params.q, pinned: params.pinned })}`),
    create: (body: NoteInput) => apiRequest<ApiEnvelope<ApiNote>>("/notes", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiNote>>(itemPath("/notes", id)),
    update: (id: string, body: NotePatch) => apiRequest<ApiEnvelope<ApiNote>>(itemPath("/notes", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/notes", id), { method: "DELETE" }),
  },
  files: {
    list: (params: PageQuery & { q?: string } = {}) => apiRequest<ApiPage<ApiFile>>(`/files${query({ ...paging(params), q: params.q })}`),
    createMetadata: (body: FileInput) => apiRequest<ApiEnvelope<ApiFile>>("/files", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiFile>>(itemPath("/files", id)),
    update: (id: string, body: FilePatch) => apiRequest<ApiEnvelope<ApiFile>>(itemPath("/files", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/files", id), { method: "DELETE" }),
  },
  learning: {
    decks: (exam?: "CET4" | "CET6") => apiRequest<ApiEnvelope<import("./api-types").LearningDeck[]>>(`/learning/decks${query({ exam })}`),
    queue: (params: { deckId: string; limit?: number; mode?: "due" | "new" | "mixed" }) => apiRequest<ApiEnvelope<ReviewQueue>>(`/learning/queue${query({ deckId: params.deckId, limit: Math.max(1, Math.min(100, params.limit ?? 20)), mode: params.mode })}`),
    submitReview: (body: ReviewSubmission) => apiRequest<ApiEnvelope<ReviewResult>>("/learning/reviews", { method: "POST", body: JSON.stringify(body) }),
  },
  pomodoro: {
    list: (params: PageQuery & { from?: string; to?: string; status?: ApiFocusSession["status"] } = {}) => apiRequest<ApiPage<ApiFocusSession>>(`/pomodoro/sessions${query({ ...paging(params), from: params.from, to: params.to, status: params.status })}`),
    start: (body: FocusSessionInput = {}) => apiRequest<ApiEnvelope<ApiFocusSession>>("/pomodoro/sessions", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiFocusSession>>(itemPath("/pomodoro/sessions", id)),
    update: (id: string, body: FocusSessionPatch) => apiRequest<ApiEnvelope<ApiFocusSession>>(itemPath("/pomodoro/sessions", id), { method: "PATCH", body: JSON.stringify(body) }),
    complete: (id: string) => apiRequest<ApiEnvelope<ApiFocusSession>>(`${itemPath("/pomodoro/sessions", id)}/complete`, { method: "POST" }),
    cancel: (id: string) => apiRequest<ApiEnvelope<ApiFocusSession>>(`${itemPath("/pomodoro/sessions", id)}/cancel`, { method: "POST" }),
    remove: (id: string) => apiRequest<void>(itemPath("/pomodoro/sessions", id), { method: "DELETE" }),
  },
  habits: {
    list: (params: PageQuery & { archived?: boolean } = {}) => apiRequest<ApiPage<ApiHabit>>(`/habits${query({ ...paging(params), archived: params.archived })}`),
    create: (body: HabitInput) => apiRequest<ApiEnvelope<ApiHabit>>("/habits", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiHabit>>(itemPath("/habits", id)),
    update: (id: string, body: HabitPatch) => apiRequest<ApiEnvelope<ApiHabit>>(itemPath("/habits", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/habits", id), { method: "DELETE" }),
    entries: (id: string, params: PageQuery & { from?: string; to?: string } = {}) => apiRequest<ApiPage<ApiHabitEntry>>(`${itemPath("/habits", id)}/entries${query({ ...paging(params), from: params.from, to: params.to })}`),
    record: (id: string, body: HabitEntryInput) => apiRequest<ApiEnvelope<ApiHabitEntry>>(`${itemPath("/habits", id)}/entries`, { method: "POST", body: JSON.stringify(body) }),
  },
  goals: {
    list: (params: PageQuery & { status?: ApiGoal["status"] } = {}) => apiRequest<ApiPage<ApiGoal>>(`/goals${query({ ...paging(params), status: params.status })}`),
    create: (body: GoalInput) => apiRequest<ApiEnvelope<ApiGoal>>("/goals", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiRequest<ApiEnvelope<ApiGoal>>(itemPath("/goals", id)),
    update: (id: string, body: GoalPatch) => apiRequest<ApiEnvelope<ApiGoal>>(itemPath("/goals", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/goals", id), { method: "DELETE" }),
  },
  notifications: {
    list: (params: PageQuery & { unread?: boolean } = {}) => apiRequest<ApiPage<ApiNotification>>(`/notifications${query({ ...paging(params), unread: params.unread })}`),
    update: (id: string, body: NotificationPatch) => apiRequest<ApiEnvelope<ApiNotification>>(itemPath("/notifications", id), { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiRequest<void>(itemPath("/notifications", id), { method: "DELETE" }),
    readAll: () => apiRequest<ApiEnvelope<{ updatedCount: number }>>("/notifications/read-all", { method: "POST" }),
  },
  search: (params: PageQuery & { q: string; types?: import("./api-types").ApiSearchResult["type"][]; limit?: number }) => apiRequest<ApiPage<import("./api-types").ApiSearchResult>>(`/search${query({ q: params.q, types: params.types?.join(","), cursor: params.cursor, limit: params.limit === undefined ? undefined : Math.max(1, Math.min(100, Math.trunc(params.limit))) })}`),
  analytics: (params: { from: string; to: string; timezone: string }) => apiRequest<ApiEnvelope<ApiAnalyticsSummary>>(`/analytics/summary${query(params)}`),
  settings: {
    get: () => apiRequest<ApiEnvelope<ApiSettings>>("/settings"),
    update: (body: SettingsPatch) => apiRequest<ApiEnvelope<ApiSettings>>("/settings", { method: "PATCH", body: JSON.stringify(body) }),
  },
};
