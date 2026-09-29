export type ModuleId =
  | "dashboard" | "inbox" | "today" | "tasks" | "projects" | "calendar"
  | "focus" | "pomodoro" | "english" | "habits" | "goals" | "analytics"
  | "notes" | "knowledge" | "files" | "notifications" | "settings";
export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "高" | "中" | "低";
export type InboxKind = "task" | "note" | "link";
export type WordRating = "again" | "hard" | "good";
export interface Task { id: string; title: string; status: TaskStatus; priority: Priority; project: string; due: string; kind?: string; }
export interface Project { id: string; title: string; description: string; color: string; due: string; taskIds: string[]; }
export interface InboxItem { id: string; text: string; kind: InboxKind; createdAt: string; source: string; }
export interface Note { id: string; title: string; body: string; updatedAt: string; }
export interface VocabularyWord { id: string; spelling: string; phonetic: string; meaning: string; part: string; example: string; cet: "CET-4" | "CET-6"; known: boolean; starred: boolean; due: boolean; }
export interface StudyRecord { id: string; wordId: string; cet: "CET-4" | "CET-6"; rating: WordRating; at: string; }
export interface Habit { id: string; title: string; streak: number; checkedToday: boolean; days: boolean[]; }
export interface Goal { id: string; title: string; detail: string; progress: number; source: string; due: string; }
export interface AppNotification { id: string; title: string; detail: string; time: string; read: boolean; }
export interface CalendarEvent { id: string; title: string; time: string; kind: "task" | "focus" | "study" | "personal"; }
export interface TimerState { mode: "focus" | "short" | "long"; running: boolean; remainingSeconds: number; deadline: number | null; rounds: number; sessionId: string | null; linkedTaskId: string; }
export interface FocusLog { id: string; kind: "focus" | "pomodoro"; durationSeconds: number; taskId: string; completed: boolean; endedAt: string; }
export interface FreeFocusState { running: boolean; startedAt: number | null; accumulatedSeconds: number; taskId: string; }
export interface Preferences { focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; roundsBeforeLong: number; dailyNewWords: number; dailyReviewWords: number; notifications: boolean; sound: boolean; }
export interface WorkspaceData {
  tasks: Task[]; projects: Project[]; inbox: InboxItem[]; notes: Note[]; words: VocabularyWord[];
  studyRecords: StudyRecord[]; focusLogs: FocusLog[]; habits: Habit[]; goals: Goal[]; notifications: AppNotification[];
  events: CalendarEvent[]; timer: TimerState; freeFocus: FreeFocusState; preferences: Preferences; dismissed: string[];
}
