"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, BookMarked, BookOpen,
  BookmarkPlus, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Circle, Clock3, Command, Crosshair, FileText, Flame, FolderKanban, FolderOpen, Goal,
  Inbox as InboxIcon, LayoutDashboard, Library, ListTodo, MoreHorizontal, Pause, Play,
  Plus, Search, Send, Settings, SkipForward, SlidersHorizontal, Sparkles, Star, StickyNote,
  Sun, Timer, Trash2, X, type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_ROOT, ApiError, api, isDemoMode } from "@/lib/api";
import { demoData } from "@/lib/mock-data";
import { loadWorkspace, saveWorkspace, STORAGE_KEY, subscribeWorkspace } from "@/lib/storage";
import type { AppNotification, FocusLog, InboxItem, ModuleId, Note, Task, VocabularyWord, WordRating, WorkspaceData } from "@/lib/types";

const moduleTitle: Record<ModuleId, string> = {
  dashboard: "工作台", inbox: "收件箱", today: "今天", tasks: "任务", projects: "项目", calendar: "日历",
  focus: "Focus 专注", pomodoro: "Pomodoro 番茄钟", english: "英语学习", habits: "习惯", goals: "目标", analytics: "分析",
  notes: "笔记", knowledge: "知识库", files: "文件", notifications: "通知", settings: "设置",
};
const groups: { title: string; items: { id: ModuleId; label: string; icon: LucideIcon }[] }[] = [
  { title: "工作台", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { id: "inbox", label: "收件箱", icon: InboxIcon }, { id: "today", label: "今天", icon: Sun }] },
  { title: "执行", items: [{ id: "tasks", label: "任务", icon: CheckCircle2 }, { id: "projects", label: "项目", icon: FolderKanban }, { id: "calendar", label: "日历", icon: CalendarDays }, { id: "focus", label: "Focus 专注", icon: Crosshair }, { id: "pomodoro", label: "Pomodoro", icon: Timer }] },
  { title: "学习与成长", items: [{ id: "english", label: "英语学习", icon: BookOpen }, { id: "habits", label: "习惯", icon: Flame }, { id: "goals", label: "目标", icon: Goal }, { id: "analytics", label: "分析", icon: BarChart3 }] },
  { title: "资料", items: [{ id: "notes", label: "笔记", icon: StickyNote }, { id: "knowledge", label: "知识库", icon: Library }, { id: "files", label: "文件", icon: FolderOpen }] },
];
const mobileLinks: { id: ModuleId | "more"; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "今天", icon: Sun }, { id: "tasks", label: "任务", icon: CheckCircle2 },
  { id: "english", label: "英语", icon: BookOpen }, { id: "focus", label: "Focus", icon: Crosshair },
  { id: "more", label: "更多", icon: MoreHorizontal },
];
const todayLabel = () => new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const formatDuration = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;

function ActionButton({ children, onClick, variant = "primary", icon: Icon, className = "", type = "button", disabled = false, title }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "soft" | "danger";
  icon?: LucideIcon; className?: string; type?: "button" | "submit"; disabled?: boolean; title?: string;
}) {
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={`button ${variant} ${className}`}>
    {Icon && <Icon size={15} aria-hidden="true" />}<span>{children}</span>
  </button>;
}
function IconButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`icon-button ${className}`}>{children}</button>;
}
function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-actions">{action}</div>}</header>;
}
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`panel card ${className}`}>{children}</section>; }
function PanelHead({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="panel-head"><div><h2 className="panel-title">{title}</h2>{detail && <p className="panel-sub">{detail}</p>}</div>{action}</div>;
}

export default function Workspace() {
  const [page, setPage] = useState<ModuleId>("dashboard");
  const [data, setData] = useState<WorkspaceData>(demoData);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [apiCheckVersion, setApiCheckVersion] = useState(0);
  const [apiHealth, setApiHealth] = useState<{ state: "demo" | "checking" | "ready" | "unauthenticated" | "database-unavailable" | "unavailable" | "error"; message: string }>({ state: isDemoMode ? "demo" : "checking", message: "" });
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<"search" | "capture" | "commands" | "more" | null>(null);
  const [captureKind, setCaptureKind] = useState<"task" | "note" | "link">("task");
  const [searchText, setSearchText] = useState("");
  const [englishTab, setEnglishTab] = useState<"词卡" | "复习" | "生词本" | "练习">("词卡");
  const [cet, setCet] = useState<"CET-4" | "CET-6">("CET-6");
  const [wordIndex, setWordIndex] = useState(0);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [practiceChoice, setPracticeChoice] = useState<string | null>(null);
  const [practiceCount, setPracticeCount] = useState(0);
  const [practiceCorrect, setPracticeCorrect] = useState(0);
  const [taskView, setTaskView] = useState<"list" | "board">("list");
  const [taskFilter, setTaskFilter] = useState("全部任务");
  const [selectedNoteId, setSelectedNoteId] = useState("n1");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarView, setCalendarView] = useState<"month" | "agenda">("month");
  const [toast, setToast] = useState<{ message: string; action?: { label: string; run: () => void } } | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLTextAreaElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const restored = isDemoMode ? loadWorkspace() : demoData;
    setData(restored);
    setReady(true);
    if (!isDemoMode) return;
    try {
      const probe = `${STORAGE_KEY}-probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
    } catch { setStorageAvailable(false); }
    return subscribeWorkspace(() => setData(loadWorkspace()));
  }, []);
  useEffect(() => { if (ready && isDemoMode) saveWorkspace(data); }, [data, ready]);
  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    setApiHealth({ state: "checking", message: "正在请求同源 Dashboard API…" });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    api.dashboard({ timezone }).then(() => {
      if (active) setApiHealth({ state: "ready", message: "会话与 API 可用；本页仍显示只读预览数据，页面交互尚未接线到服务器。" });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) setApiHealth({ state: "unauthenticated", message: "服务端会话未验证（401）；登录/会话签发配置待接入。页面数据不会提交。" });
      else if (error instanceof ApiError && error.status === 503 && error.code === "DATABASE_UNAVAILABLE") setApiHealth({ state: "database-unavailable", message: "API 数据层不可用（503 / DATABASE_UNAVAILABLE）；需配置 DATABASE_URL 并生成 Prisma Client。页面数据不会提交。" });
      else if (error instanceof ApiError && error.status === 503) setApiHealth({ state: "unavailable", message: "工作区 API 暂不可用（503）。页面数据不会提交。" });
      else setApiHealth({ state: "error", message: "无法连接工作区 API（网络或服务暂不可达）。页面数据不会提交。" });
    });
    return () => { active = false; };
  }, [apiCheckVersion]);
  useEffect(() => {
    if (!data.freeFocus.running) return;
    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [data.freeFocus.running]);
  useEffect(() => {
    if (!toast) return;
    toastTimer.current = setTimeout(() => setToast(null), 4200);
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => (modal === "capture" ? captureInput.current : searchInput.current)?.focus(), 20);
    return () => { clearTimeout(timer); previousFocus.current?.focus?.(); };
  }, [modal]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchText(""); setModal("search"); }
      else if ((event.metaKey || event.ctrlKey) && event.code === "Space" && !typing) { event.preventDefault(); setModal("capture"); }
      else if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!ready || !data.timer.running || !data.timer.deadline) return;
    const id = setInterval(() => {
      setData((old) => {
        const timer = old.timer;
        if (!timer.running || !timer.deadline) return old;
        const remaining = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
        if (remaining > 0) return { ...old, timer: { ...timer, remainingSeconds: remaining } };
        if (timer.mode === "focus") {
          const rounds = timer.rounds + 1;
          const nextMode = rounds % Math.max(1, old.preferences.roundsBeforeLong) === 0 ? "long" : "short";
          const logId = timer.sessionId ?? uid();
          const log: FocusLog = { id: logId, kind: "pomodoro", durationSeconds: old.preferences.focusMinutes * 60, taskId: timer.linkedTaskId, completed: true, endedAt: new Date().toISOString() };
          const next: WorkspaceData = { ...old, timer: { ...timer, mode: nextMode, running: false, remainingSeconds: (nextMode === "long" ? old.preferences.longBreakMinutes : old.preferences.shortBreakMinutes) * 60, deadline: null, rounds, sessionId: null }, focusLogs: old.focusLogs.some((item) => item.id === logId) ? old.focusLogs : [log, ...old.focusLogs], notifications: [{ id: `finish-${logId}`, title: "专注阶段完成", detail: "计时记录已保存在此浏览器。", time: "刚刚", read: false }, ...old.notifications] };
          return next;
        }
        return { ...old, timer: { ...timer, mode: "focus", running: false, remainingSeconds: old.preferences.focusMinutes * 60, deadline: null, sessionId: null } };
      });
    }, 500);
    return () => clearInterval(id);
  }, [ready, data.timer.running, data.timer.deadline]);

  const say = useCallback((message: string, action?: { label: string; run: () => void }) => setToast({ message, action }), []);
  const navigate = useCallback((id: ModuleId) => { setPage(id); setModal(null); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const unread = data.notifications.filter((item) => !item.read).length;
  const todayTasks = data.tasks.filter((task) => task.due === "今天" && task.status !== "done");
  const words = data.words.filter((word) => word.cet === cet);
  const currentWord = words.length ? words[wordIndex % words.length] : undefined;
  const completedWords = data.studyRecords.filter((item) => item.cet === cet).length;
  const reviewWords = words.filter((word) => word.due);
  const studyToday = data.studyRecords.filter((record) => new Date(record.at).toDateString() === new Date().toDateString()).length;
  const todayFocusSeconds = data.focusLogs.filter((log) => new Date(log.endedAt).toDateString() === new Date().toDateString()).reduce((sum, log) => sum + log.durationSeconds, 0);

  const withTaskUpdate = (id: string, patch: Partial<Task>) => setData((old) => ({ ...old, tasks: old.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) }));
  const toggleTask = (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    withTaskUpdate(task.id, { status: next });
    say(next === "done" ? "任务已完成" : "已恢复任务");
  };
  const createTask = (title: string, project = "个人工作台") => {
    const task: Task = { id: uid(), title, status: "todo", priority: "中", project, due: "今天" };
    setData((old) => ({ ...old, tasks: [task, ...old.tasks] }));
    return task;
  };
  const submitCapture = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("capture") ?? "").trim();
    if (!text) return;
    const item: InboxItem = { id: uid(), text, kind: captureKind, createdAt: "刚刚", source: "快速收集" };
    setData((old) => ({ ...old, inbox: [item, ...old.inbox] }));
    setModal(null);
    say("已收集到收件箱");
  };
  const convertInbox = (item: InboxItem, kind: "task" | "note") => {
    const createdId = uid();
    const task: Task = { id: createdId, title: item.text, status: "todo", priority: "中", project: "个人工作台", due: "今天" };
    const note: Note = { id: createdId, title: item.text.slice(0, 55), body: item.text, updatedAt: "刚刚" };
    setData((old) => ({ ...old, inbox: old.inbox.filter((row) => row.id !== item.id), tasks: kind === "task" ? [task, ...old.tasks] : old.tasks, notes: kind === "note" ? [note, ...old.notes] : old.notes }));
    say(kind === "task" ? "已转为任务" : "已整理到笔记", { label: "撤销", run: () => setData((old) => ({ ...old, inbox: [item, ...old.inbox], tasks: old.tasks.filter((row) => row.id !== createdId), notes: old.notes.filter((row) => row.id !== createdId) })) });
  };
  const archiveInbox = (item: InboxItem) => {
    setData((old) => ({ ...old, inbox: old.inbox.filter((row) => row.id !== item.id), dismissed: [...old.dismissed, item.id] }));
    say("已归档", { label: "撤销", run: () => setData((old) => ({ ...old, inbox: [item, ...old.inbox], dismissed: old.dismissed.filter((id) => id !== item.id) })) });
  };
  const rateWord = (word: VocabularyWord, rating: WordRating, advance = true) => {
    const recordId = uid();
    setData((old) => ({ ...old,
      words: old.words.map((item) => item.id === word.id ? { ...item, known: rating === "good", due: rating !== "good" } : item),
      studyRecords: [...old.studyRecords, { id: recordId, wordId: word.id, cet: word.cet, rating, at: new Date().toISOString() }],
    }));
    setAnswerVisible(false);
    if (rating === "good" && advance) {
      const nextIndex = (wordIndex + 1) % Math.max(words.length, 1);
      setWordIndex(nextIndex);
    }
    say(rating === "good" ? "已记录为掌握" : rating === "hard" ? "已加入近期复习" : "已标记为需要再练");
  };
  const startPomodoro = () => setData((old) => {
    if (old.timer.running) return old;
    const seconds = old.timer.remainingSeconds || (old.timer.mode === "focus" ? old.preferences.focusMinutes : old.timer.mode === "short" ? old.preferences.shortBreakMinutes : old.preferences.longBreakMinutes) * 60;
    return { ...old, timer: { ...old.timer, running: true, remainingSeconds: seconds, deadline: Date.now() + seconds * 1000, sessionId: old.timer.mode === "focus" ? (old.timer.sessionId ?? uid()) : null } };
  });
  const pausePomodoro = () => setData((old) => ({ ...old, timer: { ...old.timer, running: false, remainingSeconds: old.timer.deadline ? Math.max(0, Math.ceil((old.timer.deadline - Date.now()) / 1000)) : old.timer.remainingSeconds, deadline: null } }));
  const skipPomodoro = () => setData((old) => {
    const mode = old.timer.mode === "focus" ? ((old.timer.rounds + 1) % Math.max(1, old.preferences.roundsBeforeLong) === 0 ? "long" : "short") : "focus";
    return { ...old, timer: { ...old.timer, mode, running: false, deadline: null, sessionId: null, remainingSeconds: (mode === "focus" ? old.preferences.focusMinutes : mode === "long" ? old.preferences.longBreakMinutes : old.preferences.shortBreakMinutes) * 60, rounds: old.timer.mode === "focus" ? old.timer.rounds + 1 : old.timer.rounds } };
  });
  const setPomodoroMode = (mode: "focus" | "short" | "long") => setData((old) => ({ ...old, timer: { ...old.timer, mode, running: false, deadline: null, sessionId: null, remainingSeconds: (mode === "focus" ? old.preferences.focusMinutes : mode === "short" ? old.preferences.shortBreakMinutes : old.preferences.longBreakMinutes) * 60 } }));
  const liveFocusSeconds = data.freeFocus.accumulatedSeconds + (data.freeFocus.running && data.freeFocus.startedAt ? Math.floor((clockNow - data.freeFocus.startedAt) / 1000) : 0);
  const startFreeFocus = () => setData((old) => ({ ...old, freeFocus: { ...old.freeFocus, running: true, startedAt: Date.now() } }));
  const pauseFreeFocus = () => setData((old) => ({ ...old, freeFocus: { ...old.freeFocus, running: false, startedAt: null, accumulatedSeconds: old.freeFocus.accumulatedSeconds + (old.freeFocus.startedAt ? Math.floor((Date.now() - old.freeFocus.startedAt) / 1000) : 0) } }));
  const finishFreeFocus = (keep: boolean) => {
    const duration = liveFocusSeconds;
    const sessionId = uid();
    setData((old) => ({ ...old, freeFocus: { running: false, startedAt: null, accumulatedSeconds: 0, taskId: "" }, focusLogs: keep && duration > 0 ? [{ id: sessionId, kind: "focus", durationSeconds: duration, taskId: old.freeFocus.taskId, completed: true, endedAt: new Date().toISOString() }, ...old.focusLogs] : old.focusLogs }));
    say(keep ? "专注记录已保存到此浏览器" : "本次专注未保存");
  };
  const startFocusForTask = (taskId: string) => { setData((old) => ({ ...old, freeFocus: { running: false, startedAt: null, accumulatedSeconds: 0, taskId } })); navigate("focus"); };
  const ratePractice = (word: VocabularyWord, correct: boolean) => {
    setPracticeCount((count) => count + 1);
    if (correct) setPracticeCorrect((count) => count + 1);
    setPracticeChoice(correct ? word.spelling : "wrong");
    rateWord(word, correct ? "good" : "again", false);
  };

  const searchCorpus = useMemo(() => [
    ...data.tasks.map((item) => ({ id: item.id, title: item.title, type: "任务", module: "tasks" as ModuleId, meta: item.project })),
    ...data.projects.map((item) => ({ id: item.id, title: item.title, type: "项目", module: "projects" as ModuleId, meta: item.description })),
    ...data.notes.map((item) => ({ id: item.id, title: item.title, type: "笔记", module: "notes" as ModuleId, meta: item.body.slice(0, 80) })),
    ...data.words.map((item) => ({ id: item.id, title: item.spelling, type: item.cet, module: "english" as ModuleId, meta: item.meaning.replace("\n", " / ") })),
    ...data.inbox.map((item) => ({ id: item.id, title: item.text, type: "收件箱", module: "inbox" as ModuleId, meta: item.source })),
    { id: "file1", title: "research-outline.pdf", type: "文件", module: "files" as ModuleId, meta: "示例文件索引 · 尚未上传" },
  ], [data.tasks, data.projects, data.notes, data.words, data.inbox]);
  const results = searchText.trim() ? searchCorpus.filter((row) => `${row.title} ${row.meta}`.toLowerCase().includes(searchText.toLowerCase())).slice(0, 10) : [];
  const markRead = (notification: AppNotification) => setData((old) => ({ ...old, notifications: old.notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item) }));
  const openCommand = (id: ModuleId) => { if (id === "focus") startFocusForTask(""); else navigate(id); };
  const pageNames = (page === "english" ? "英语学习 / " + cet : moduleTitle[page]);

  const renderTask = (task: Task) => <div className="task-row" key={task.id}>
    <button className={`check ${task.status === "done" ? "done" : ""}`} aria-label={task.status === "done" ? `重新打开：${task.title}` : `完成：${task.title}`} onClick={() => toggleTask(task)}>{task.status === "done" && <Check size={12} />}</button>
    <button className={`task-name ${task.status === "done" ? "completed" : ""}`} onClick={() => navigate("tasks")}>{task.title}</button>
    <span className={`tag ${task.priority === "高" ? "warm" : "green"}`}>{task.priority}优先</span><span className="task-project">{task.project}</span><span className="due">{task.due}</span>
    <button className="mini-action" aria-label={`为任务「${task.title}」开始专注`} onClick={() => startFocusForTask(task.id)}><Crosshair size={14} /></button>
  </div>;
  const stats = [
    { label: "今天待办", value: String(todayTasks.length), note: `${data.tasks.filter((task) => task.due === "今天" && task.status === "done").length} 项已完成`, icon: CheckCircle2, color: "#e8eee6", target: "today" as ModuleId },
    { label: "专注时间", value: `${Math.floor(todayFocusSeconds / 60)} 分`, note: "来自已保存的专注记录", icon: Crosshair, color: "#f1e8dc", target: "analytics" as ModuleId },
    { label: "待复习词条", value: String(data.words.filter((word) => word.due).length), note: "本地演示词表 · CET-4/6", icon: BookOpen, color: "#e8edf4", target: "english" as ModuleId },
    { label: "收件箱", value: String(data.inbox.length), note: "等待整理", icon: InboxIcon, color: "#f4e9e5", target: "inbox" as ModuleId },
  ];
  const allTasks = taskFilter === "全部任务" ? data.tasks : taskFilter === "未完成" ? data.tasks.filter((item) => item.status !== "done") : data.tasks.filter((item) => item.status === "done");
  const selectedNote = data.notes.find((item) => item.id === selectedNoteId) ?? data.notes[0];

  return <div className="app-shell">
    <aside className="sidebar" aria-label="主导航">
      <button className="brand" onClick={() => navigate("dashboard")} aria-label="返回工作台首页"><span className="brand-mark">N</span><span><b>NOVA</b><small>PERSONAL WORKSPACE</small></span></button>
      <button className="workspace-switch" onClick={() => say(isDemoMode ? "当前为个人演示空间；账号与团队切换待服务端接入" : "工作区身份由服务端会话派生；当前不发送客户端 userId")}><span className="switch-icon"><Sparkles size={15} /></span><span><b>个人空间</b><small>{isDemoMode ? "浏览器本地演示" : "服务端会话 · 预览数据"}</small></span><ChevronDown size={14} /></button>
      <div className="nav-scroll">{groups.map((group) => <nav className="nav-group" aria-label={group.title} key={group.title}><p className="nav-label">{group.title}</p>{group.items.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><item.icon size={17} aria-hidden="true"/><span>{item.label}</span>{item.id === "inbox" && data.inbox.length > 0 && <small className="nav-count">{data.inbox.length}</small>}</button>)}</nav>)}
        <nav className="nav-group" aria-label="系统"><p className="nav-label">系统</p><button className={`nav-item ${page === "notifications" ? "active" : ""}`} aria-current={page === "notifications" ? "page" : undefined} onClick={() => navigate("notifications")}><Bell size={17}/><span>通知</span>{unread > 0 && <small className="nav-count warm-count">{unread}</small>}</button><button className={`nav-item ${page === "settings" ? "active" : ""}`} aria-current={page === "settings" ? "page" : undefined} onClick={() => navigate("settings")}><Settings size={17}/><span>设置</span></button></nav>
      </div>
      <div className="sidebar-footer"><div className="avatar">迪</div><div className="profile-copy"><b>个人空间</b><small>{isDemoMode ? "本地演示模式" : "服务器请求 · 页面预览"}</small></div><button className="more-icon" aria-label="打开设置" onClick={() => navigate("settings")}>•••</button></div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark small-mark">N</span><b>NOVA</b></div>
        <div className="breadcrumb"><span>工作台</span><span className="crumb-divider">/</span><b>{pageNames}</b></div>
        <div className="topbar-right">
          <span className="demo-badge"><span className="demo-dot"/>{isDemoMode ? "演示数据 · 仅存本机" : "同源 API · 页面预览"}</span>
          <button className="search-trigger" onClick={() => { setSearchText(""); setModal("search"); }} aria-label="全局搜索（Command 或 Control 加 K）"><Search size={15}/><span>搜索任务、笔记、词条…</span><kbd>⌘ K</kbd></button>
          <IconButton label={`通知${unread ? `，${unread} 条未读` : ""}`} onClick={() => navigate("notifications")} className="notification-button"><Bell size={17}/>{unread > 0 && <i className="notification-dot"/>}</IconButton>
          <ActionButton icon={Plus} onClick={() => setModal("capture")} className="capture-top">快速收集</ActionButton>
        </div>
      </header>

      <main className="content" id="main-content">
        {!isDemoMode && <div className={`api-health-banner ${apiHealth.state}`} role="status" aria-live="polite"><div><b>{apiHealth.state === "checking" ? "正在检查服务端" : apiHealth.state === "ready" ? "服务端 API 可用" : apiHealth.state === "unauthenticated" ? "尚未通过服务端会话认证" : apiHealth.state === "database-unavailable" ? "服务端数据库尚未配置" : apiHealth.state === "unavailable" ? "服务端暂不可用" : "无法连接服务端"}</b><span>{apiHealth.message}</span></div><button type="button" onClick={() => setApiCheckVersion((value) => value + 1)} disabled={apiHealth.state === "checking"}>重新检查</button></div>}
        {page === "dashboard" && <>
          <Heading eyebrow={todayLabel()} title="早上好，今天从容一点。" description="先看看现在需要注意什么，再选一个最重要的下一步。" action={<ActionButton icon={Plus} onClick={() => setModal("capture")}>快速收集</ActionButton>} />
          {!storageAvailable && <div className="inline-alert error" role="status">浏览器存储不可用，刷新后本次变更可能无法保留。</div>}
          <div className="stats-grid">{stats.map((stat) => <button className="stat-card card" key={stat.label} onClick={() => navigate(stat.target)}><div className="stat-top"><span>{stat.label}</span><span className="stat-icon" style={{ background: stat.color }}><stat.icon size={16}/></span></div><b className="stat-value">{stat.value}</b><span className="stat-note">{stat.note}</span><ArrowUpRight size={14} className="stat-arrow"/></button>)}</div>
          <div className="home-grid">
            <section className="welcome-panel card"><div className="welcome-kicker"><span className="welcome-symbol"><Sparkles size={14}/></span><span>给今天留一点空间</span></div><h2>慢一点，也是在向前。</h2><p>把注意力放在眼前的一件事上，下一步自然会清楚。</p><div className="welcome-metrics"><div><b>{todayTasks.length}</b><span>待完成任务</span></div><div><b>{data.inbox.length}</b><span>待整理收集</span></div><div><b>{data.timer.rounds}</b><span>番茄轮次（累计）</span></div></div><div className="welcome-actions"><ActionButton icon={Crosshair} onClick={() => startFocusForTask("")}>开始专注</ActionButton><button className="text-link" onClick={() => navigate("today")}>查看今天 <ArrowRight size={14}/></button></div></section>
            <section className="cover-card card" aria-label="学习资料示例"><img src="/assets/desk.jpg" alt="桌面上的笔记和书籍"/><div className="cover-overlay"/><div className="cover-content"><span className="cover-pill">LEARNING · DEMO</span><h3>给学习留一段安静时间</h3><p>打开 CET-4 / CET-6 词卡，继续本地演示学习。</p><button onClick={() => navigate("english")}>继续学习 <ArrowRight size={14}/></button></div></section>
          </div>
          <div className="dashboard-grid">
            <Panel><PanelHead title="今天的下一步" detail={`${todayTasks.length} 项未完成`} action={<button className="text-action" onClick={() => navigate("tasks")}>全部任务 <ArrowRight size={13}/></button>}/>{todayTasks.length ? <div className="task-list">{todayTasks.slice(0, 4).map(renderTask)}</div> : <EmptyState title="今天暂时没有待办" detail="收集一件小事，或从任务中安排下一步。" action={<ActionButton variant="soft" icon={Plus} onClick={() => setModal("capture")}>添加一项</ActionButton>}/>}</Panel>
            <Panel><PanelHead title="接下来" detail="日程示例 · 外部日历尚未连接" action={<button className="text-action" onClick={() => navigate("calendar")}>打开日历 <ArrowRight size={13}/></button>}/><div className="agenda-list">{data.events.slice(0, 4).map((event) => <div className="agenda-item" key={event.id}><span className={`agenda-time ${event.kind}`}>{event.time}</span><span className={`agenda-line ${event.kind}`}/><div><b>{event.title}</b><small>{event.kind === "task" ? "安排任务" : event.kind === "study" ? "英语学习计划 · 演示" : event.kind === "focus" ? "可进入 Focus 或 Pomodoro" : "个人安排"}</small></div></div>)}</div></Panel>
          </div>
          <div className="section-heading"><h2>正在推进</h2><button className="text-action" onClick={() => navigate("projects")}>查看项目 <ArrowRight size={13}/></button></div>
          <div className="project-grid">{data.projects.map((project) => { const projectTasks = data.tasks.filter((task) => task.project === project.title); const done = projectTasks.filter((task) => task.status === "done").length; const pct = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0; return <button className="project-card card" key={project.id} onClick={() => navigate("projects")}><div className="project-accent" style={{ background: project.color }}/><div className="project-card-top"><span className="project-avatar" style={{ color: project.color, background: `${project.color}20` }}><FolderKanban size={16}/></span><span className="project-due">{project.due}</span></div><b>{project.title}</b><p>{project.description}</p><div className="progress-track"><i style={{ width: `${pct}%`, background: project.color }}/></div><div className="project-meta"><span>{done}/{projectTasks.length} 项任务完成</span><small>进度来自关联任务</small></div></button>; })}</div>
          <div className="dashboard-bottom"><Panel><PanelHead title="学习与复习" detail={`演示词表 · ${data.words.filter((word) => word.due).length} 个建议复习`} action={<button className="text-action" onClick={() => navigate("english")}>进入英语学习 <ArrowRight size={13}/></button>}/><div className="learning-reminder"><div className="book-illustration"><BookOpen size={22}/></div><div><b>用一张词卡开始</b><p>题库与复习间隔规则待确认；当前词条仅用于交互演示。</p></div><ActionButton variant="soft" onClick={() => { setCet("CET-6"); setEnglishTab("词卡"); navigate("english"); }}>打开词卡</ActionButton></div></Panel><Panel><PanelHead title="习惯记录" detail="本地演示打卡" action={<button className="text-action" onClick={() => navigate("habits")}>查看习惯 <ArrowRight size={13}/></button>}/><div className="habit-compact">{data.habits.slice(0, 2).map((habit) => <div className="habit-compact-row" key={habit.id}><button className={`check ${habit.checkedToday ? "done" : ""}`} onClick={() => setData((old) => ({ ...old, habits: old.habits.map((item) => item.id === habit.id ? { ...item, checkedToday: !item.checkedToday, days: [...item.days.slice(0, 6), !item.checkedToday] } : item) }))} aria-label={`打卡：${habit.title}`}>{habit.checkedToday && <Check size={12}/>}</button><span>{habit.title}</span><small><Flame size={12}/> {habit.streak} 天</small></div>)}</div></Panel></div>
        </>}

        {page === "inbox" && <>
          <Heading eyebrow="CAPTURE FIRST" title="收件箱" description="先把想法放在这里，再决定它要去哪里。转换与归档都可以撤销。" action={<ActionButton icon={Plus} onClick={() => setModal("capture")}>快速收集</ActionButton>}/>
          <form className="capture-inline card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get("inboxText") ?? "").trim(); if (!value) return; const item: InboxItem = { id: uid(), text: value, kind: "task", createdAt: "刚刚", source: "收件箱" }; setData((old) => ({ ...old, inbox: [item, ...old.inbox] })); event.currentTarget.reset(); say("已收集到收件箱"); }}><Plus size={16}/><input name="inboxText" aria-label="写下待整理的内容" placeholder="记下一个想法、任务或链接…"/><button aria-label="收集" type="submit"><Send size={16}/></button></form>
          <Panel className="inbox-panel"><PanelHead title={`待整理 · ${data.inbox.length}`} detail="保留原始内容与来源；选择一个明确的下一步。"/>{data.inbox.length ? <div className="inbox-list">{data.inbox.map((item) => <article className="inbox-item" key={item.id}><span className={`inbox-kind ${item.kind}`}>{item.kind === "task" ? <ListTodo size={16}/> : item.kind === "note" ? <StickyNote size={16}/> : <ArrowUpRight size={16}/>}</span><div className="inbox-copy"><b>{item.text}</b><small>{item.source} · {item.createdAt}</small></div><div className="inbox-actions"><button className="small-control" onClick={() => convertInbox(item, "task")}><CheckCircle2 size={14}/>转为任务</button><button className="small-control" onClick={() => convertInbox(item, "note")}><StickyNote size={14}/>转为笔记</button><button className="small-control" onClick={() => archiveInbox(item)}><Archive size={14}/>归档</button></div></article>)}</div> : <EmptyState title="收件箱已整理干净" detail="新想法可以随时快速收集到这里。" action={<ActionButton icon={Plus} onClick={() => setModal("capture")}>收集一条</ActionButton>}/>}</Panel>
        </>}

        {page === "today" && <>
          <Heading eyebrow={todayLabel()} title="今天" description="今日任务、安排与轻量习惯集中在这里。完成项不会自动消失。" action={<ActionButton icon={Plus} onClick={() => setModal("capture")}>添加到今天</ActionButton>}/>
          <div className="today-grid"><div className="today-main"><Panel><PanelHead title="今日任务" detail={`${todayTasks.length} 项待完成 · ${data.tasks.filter((task) => task.due === "今天" && task.status === "done").length} 项已完成`} action={<button className="text-action" onClick={() => navigate("tasks")}>任务列表 <ArrowRight size={13}/></button>}/>{data.tasks.filter((task) => task.due === "今天").length ? <div className="task-list">{data.tasks.filter((task) => task.due === "今天").map(renderTask)}</div> : <EmptyState title="今天还没有安排" detail="添加任务后，它会留在今天视图直到你决定下一步。"/>}</Panel>
            <Panel><PanelHead title="按时间安排" detail="日程样例 · 无外部日历同步" action={<button className="text-action" onClick={() => navigate("calendar")}>查看日历 <ArrowRight size={13}/></button>}/><div className="agenda-list large-agenda">{data.events.map((event) => <div className="agenda-item" key={event.id}><span className={`agenda-time ${event.kind}`}>{event.time}</span><span className={`agenda-line ${event.kind}`}/><div><b>{event.title}</b><small>{event.kind === "study" ? "计划学习 · 演示" : event.kind === "task" ? "任务安排 · 演示" : "日程安排 · 演示"}</small></div>{event.kind === "focus" && <button className="small-control" onClick={() => navigate("focus")}>开始 Focus</button>}</div>)}</div></Panel></div>
            <div className="right-stack"><Panel><PanelHead title="一个专注时段" detail="保存记录到当前浏览器"/><div className="mini-focus"><div className="mini-focus-icon"><Crosshair size={20}/></div><b>{data.freeFocus.running ? formatDuration(liveFocusSeconds) : "准备好了吗？"}</b><p>{data.freeFocus.running ? "Focus 自由计时正在进行" : "不设倒计时，按自己的节奏工作。"}</p><ActionButton icon={data.freeFocus.running ? Pause : Play} onClick={() => { if (data.freeFocus.running) pauseFreeFocus(); else { startFreeFocus(); navigate("focus"); } }}>{data.freeFocus.running ? "暂停专注" : "开始 Focus"}</ActionButton><button className="text-link centered" onClick={() => navigate("pomodoro")}>切换到 Pomodoro <ArrowRight size={13}/></button></div></Panel>
              <Panel><PanelHead title="习惯" detail="想做就记一笔，不以断签惩罚" action={<button className="text-action" onClick={() => navigate("habits")}>全部 <ArrowRight size={13}/></button>}/>{data.habits.slice(0, 3).map((habit) => <div className="habit-today" key={habit.id}><button className={`check ${habit.checkedToday ? "done" : ""}`} onClick={() => setData((old) => ({ ...old, habits: old.habits.map((item) => item.id === habit.id ? { ...item, checkedToday: !item.checkedToday } : item) }))} aria-label={`${habit.checkedToday ? "取消" : "完成"}习惯：${habit.title}`}>{habit.checkedToday && <Check size={12}/>}</button><span>{habit.title}</span><small>{habit.checkedToday ? "已记录" : "可选"}</small></div>)}</Panel></div></div>
        </>}

        {page === "tasks" && <>
          <Heading eyebrow="EXECUTION" title="任务" description="把下一步变得具体。项目、状态、日期与专注入口保持关联。" action={<ActionButton icon={Plus} onClick={() => document.getElementById("task-create-input")?.focus()}>新建任务</ActionButton>}/>
          <form className="task-create card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("task") ?? "").trim(); if (title) { createTask(title); event.currentTarget.reset(); say("任务已添加到今天"); } }}><Plus size={17}/><input id="task-create-input" name="task" aria-label="任务标题" placeholder="写下要完成的下一步…"/><button type="submit">添加任务 <ArrowRight size={14}/></button></form>
          <Panel className="tasks-panel"><div className="task-toolbar"><div className="filter-pills" role="group" aria-label="任务筛选">{["全部任务", "未完成", "已完成"].map((label) => <button key={label} className={taskFilter === label ? "selected" : ""} onClick={() => setTaskFilter(label)}>{label}</button>)}</div><div className="toolbar-right"><label className="sr-only" htmlFor="task-view">任务视图</label><select id="task-view" value={taskView} onChange={(event) => setTaskView(event.target.value as "list" | "board")}><option value="list">列表视图</option><option value="board">看板视图</option></select><button className="filter-button" onClick={() => setTaskFilter("未完成")}><SlidersHorizontal size={14}/>未完成</button></div></div>
            {taskView === "list" ? <div className="task-list task-list-full">{allTasks.length ? allTasks.map(renderTask) : <EmptyState title="没有符合条件的任务" detail="清除筛选，或新建一个任务。" action={<ActionButton variant="soft" onClick={() => setTaskFilter("全部任务")}>清除筛选</ActionButton>}/>}</div> : <div className="kanban-grid">{([{ id: "todo", label: "待开始" }, { id: "doing", label: "进行中" }, { id: "done", label: "已完成" }] as const).map((col) => <section className="kanban-column" key={col.id}><div className="kanban-title">{col.label}<span>{allTasks.filter((task) => task.status === col.id).length}</span></div>{allTasks.filter((task) => task.status === col.id).map((task) => <article className="kanban-card" key={task.id}><b>{task.title}</b><small>{task.project} · {task.due}</small><div className="kanban-bottom"><span className={`tag ${task.priority === "高" ? "warm" : "green"}`}>{task.priority}优先</span><button className="small-control" onClick={() => toggleTask(task)}>{task.status === "done" ? "重开" : "完成"}</button></div></article>)}</section>)}</div>}
          </Panel>
        </>}

        {page === "projects" && <>
          <Heading eyebrow="PROJECTS" title="项目" description="项目进度从实际关联任务计算；当前数据为本地演示。" action={<ActionButton icon={Plus} onClick={() => say("创建项目表单将在项目 API 接入后开放。")}>新建项目</ActionButton>}/>
          <div className="projects-list">{data.projects.map((project) => { const linked = data.tasks.filter((task) => task.project === project.title); const done = linked.filter((task) => task.status === "done").length; const pct = linked.length ? Math.round(done / linked.length * 100) : 0; return <Panel key={project.id} className="project-detail"><div className="project-detail-heading"><span className="project-avatar large" style={{ color: project.color, background: `${project.color}20` }}><FolderKanban size={19}/></span><div><h2>{project.title}</h2><p>{project.description}</p></div><span className="project-due">目标日期 · {project.due}</span></div><div className="project-progress-row"><div className="progress-track"><i style={{ width: `${pct}%`, background: project.color }}/></div><b>{pct}%</b><span>{done}/{linked.length} 关联任务完成</span></div><div className="project-task-list">{linked.length ? linked.map((task) => <div key={task.id} className="project-task"><button className={`check ${task.status === "done" ? "done" : ""}`} aria-label={`切换任务：${task.title}`} onClick={() => toggleTask(task)}>{task.status === "done" && <Check size={12}/>}</button><span className={task.status === "done" ? "completed" : ""}>{task.title}</span><button className="small-control" onClick={() => startFocusForTask(task.id)}><Crosshair size={14}/>专注</button></div>) : <p className="muted-copy">暂无关联任务。</p>}</div><div className="project-links"><button onClick={() => navigate("calendar")}><CalendarDays size={14}/>相关日程</button><button onClick={() => navigate("notes")}><StickyNote size={14}/>项目笔记</button><button onClick={() => navigate("files")}><FolderOpen size={14}/>项目文件</button></div></Panel>; })}</div>
        </>}

        {page === "calendar" && <>
          <Heading eyebrow="CALENDAR" title="日历" description="示例日程与本地任务视图；外部日历和时区同步尚未接入。" action={<div className="calendar-heading-actions"><button className={`view-pill ${calendarView === "month" ? "selected" : ""}`} aria-pressed={calendarView === "month"} onClick={() => setCalendarView("month")}>月</button><button className={`view-pill ${calendarView === "agenda" ? "selected" : ""}`} aria-pressed={calendarView === "agenda"} onClick={() => setCalendarView("agenda")}>议程</button><ActionButton icon={Plus} onClick={() => say("创建日程功能待日历 API 接入。")}>新建日程</ActionButton></div>}/>
          {calendarView === "month" && <Panel className="calendar-panel"><div className="calendar-controls"><div><h2>{calendarMonth.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</h2><small>事件样例仅用于呈现布局；不代表真实预约</small></div><div className="calendar-stepper"><IconButton label="上个月" onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ChevronLeft size={16}/></IconButton><button onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>今天</button><IconButton label="下个月" onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ChevronRight size={16}/></IconButton></div></div><div className="calendar-grid" role="grid" aria-label="月历"><div className="calendar-daynames">{["一", "二", "三", "四", "五", "六", "日"].map((name) => <span key={name}>{name}</span>)}</div><div className="calendar-dates">{(() => { const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1); const offset = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - offset); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); const sameMonth = date.getMonth() === calendarMonth.getMonth(); const today = date.toDateString() === new Date().toDateString(); const event = sameMonth && date.getDate() === Math.min(29, new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()) ? data.events[0] : sameMonth && date.getDate() === Math.min(30, new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()) ? data.events[2] : null; return <button role="gridcell" aria-label={date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })} className={`calendar-date ${!sameMonth ? "dim" : ""} ${today ? "today" : ""}`} key={date.toISOString()} onClick={() => event ? say(`${event.time} · ${event.title}（演示日程）`) : say(`${date.getMonth() + 1} 月 ${date.getDate()} 日`)}><span>{date.getDate()}</span>{event && <small className={`cal-event ${event.kind}`}>{event.time} {event.title}</small>}</button>; }); })()}</div></div></Panel>}
          {calendarView === "agenda" && <Panel className="calendar-agenda"><PanelHead title="议程" detail="任务与学习安排 · 示例数据"/>{data.events.map((event) => <div className="agenda-item" key={event.id}><span className={`agenda-time ${event.kind}`}>{event.time}</span><span className={`agenda-line ${event.kind}`}/><div><b>{event.title}</b><small>{event.kind === "study" ? "学习计划" : event.kind === "task" ? "任务" : event.kind === "focus" ? "专注记录" : "个人"} · 演示</small></div></div>)}</Panel>}
        </>}

        {page === "focus" && <>
          <Heading eyebrow="FOCUS · OPEN SESSION" title="Focus 专注" description="自由计时的工作空间：按自己的节奏开始、暂停并决定是否保存记录。" action={<ActionButton variant="secondary" icon={Timer} onClick={() => navigate("pomodoro")}>切换到 Pomodoro</ActionButton>}/>
          <div className="focus-layout"><Panel className="focus-session"><span className="focus-orbit"><Crosshair size={20}/></span><span className="focus-label">自由专注 · {data.freeFocus.running ? "进行中" : "准备就绪"}</span><div className="focus-clock" aria-live="off">{formatDuration(liveFocusSeconds)}</div><p className="focus-caption">{data.freeFocus.running ? "计时已保存到本机；切换页面后仍可恢复。" : "不设预设时长。计时只在应用处于可用状态时更新。"}</p><div className="focus-task-picker"><label htmlFor="focus-task">正在处理</label><select id="focus-task" value={data.freeFocus.taskId} onChange={(event) => setData((old) => ({ ...old, freeFocus: { ...old.freeFocus, taskId: event.target.value } }))}><option value="">自由主题（不关联任务）</option>{data.tasks.filter((task) => task.status !== "done").map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div><div className="focus-actions">{data.freeFocus.running ? <ActionButton icon={Pause} variant="secondary" onClick={pauseFreeFocus}>暂停</ActionButton> : <ActionButton icon={Play} onClick={startFreeFocus}>{liveFocusSeconds ? "继续专注" : "开始专注"}</ActionButton>}{(data.freeFocus.running || liveFocusSeconds > 0) && <ActionButton variant="soft" icon={Check} onClick={() => finishFreeFocus(true)}>保存并结束</ActionButton>}{liveFocusSeconds > 0 && <ActionButton variant="quiet" icon={Trash2} onClick={() => finishFreeFocus(false)}>放弃本次</ActionButton>}</div><p className="focus-footnote">结束后仅在此浏览器记一条记录。后台运行、跨设备同步与提醒服务待 API/平台能力对接。</p></Panel>
            <div className="right-stack"><Panel><PanelHead title="Pomodoro 番茄钟" detail="独立的工作 / 休息循环模式"/><div className="pomodoro-preview"><div className="pomodoro-preview-top"><span className="phase-dot"/><b>{data.timer.mode === "focus" ? "专注阶段" : data.timer.mode === "short" ? "短休息" : "长休息"}</b></div><strong>{formatDuration(data.timer.running && data.timer.deadline ? Math.max(0, Math.ceil((data.timer.deadline - Date.now()) / 1000)) : data.timer.remainingSeconds)}</strong><small>已完成 {data.timer.rounds} 轮（本机计数）</small><ActionButton onClick={() => navigate("pomodoro")} icon={Timer}>打开 Pomodoro</ActionButton></div></Panel><Panel><PanelHead title="最近专注记录" detail="可追溯到关联任务"/>{data.focusLogs.length ? <div className="record-list">{data.focusLogs.slice(0, 4).map((log) => <div className="record-row" key={log.id}><span className="record-icon"><Clock3 size={15}/></span><div><b>{log.kind === "focus" ? "自由专注" : "Pomodoro 专注"}</b><small>{log.taskId ? data.tasks.find((task) => task.id === log.taskId)?.title ?? "已关联任务" : "未关联任务"} · {new Date(log.endedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{Math.floor(log.durationSeconds / 60)} 分</strong></div>)}</div> : <EmptyState title="还没有保存的专注记录" detail="结束一次 Focus 或完成一个番茄后，记录会显示在这里。"/>}</Panel></div></div>
        </>}

        {page === "pomodoro" && <>
          <Heading eyebrow="POMODORO · TIMED CYCLE" title="Pomodoro 番茄钟" description="独立计时模式，阶段结束后会暂停并提示；休息和专注不会自动跳转。" action={<ActionButton variant="secondary" icon={Crosshair} onClick={() => navigate("focus")}>切换到自由 Focus</ActionButton>}/>
          <div className="pomodoro-layout"><Panel className={`pomodoro-card ${data.timer.mode !== "focus" ? "break-mode" : ""}`}><div className="timer-tabs" role="group" aria-label="计时阶段">{([ ["focus", "专注"], ["short", "短休息"], ["long", "长休息"] ] as const).map(([mode, label]) => <button key={mode} className={data.timer.mode === mode ? "selected" : ""} onClick={() => setPomodoroMode(mode)}>{label}</button>)}</div><div className="pomodoro-face"><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="100"/><circle cx="110" cy="110" r="100" className="timer-ring" style={{ strokeDashoffset: 628 - 628 * (data.timer.remainingSeconds / ((data.timer.mode === "focus" ? data.preferences.focusMinutes : data.timer.mode === "short" ? data.preferences.shortBreakMinutes : data.preferences.longBreakMinutes) * 60)) }}/></svg><div className="pomodoro-digits" aria-live="polite"><span>{formatDuration(data.timer.running && data.timer.deadline ? Math.max(0, Math.ceil((data.timer.deadline - Date.now()) / 1000)) : data.timer.remainingSeconds)}</span><small>{data.timer.mode === "focus" ? "FOCUS SESSION" : "BREAK TIME"}</small></div></div><p className="pomodoro-state" role="status">{data.timer.running ? "计时进行中" : data.timer.mode === "focus" ? "准备开始一轮专注" : "阶段已暂停，可开始休息"}</p><div className="pomodoro-actions">{data.timer.running ? <ActionButton icon={Pause} variant="secondary" onClick={pausePomodoro}>暂停</ActionButton> : <ActionButton icon={Play} onClick={startPomodoro}>开始计时</ActionButton>}<ActionButton icon={SkipForward} variant="quiet" onClick={skipPomodoro}>跳过阶段</ActionButton></div><div className="round-indicator"><span>本机已完成轮次</span><div>{Array.from({ length: Math.min(data.preferences.roundsBeforeLong, 8) }, (_, index) => <i className={index < data.timer.rounds % Math.max(1, data.preferences.roundsBeforeLong) ? "filled" : ""} key={index}/>)}</div><b>{data.timer.rounds}</b></div><p className="pomodoro-note">计时状态与轮次保存在当前浏览器。页面休眠时基于截止时间恢复；浏览器通知和后台提醒未接入。</p></Panel>
            <div className="right-stack"><Panel><PanelHead title="本轮关联任务" detail="未选择时记录不会关联到其他任务"/><label className="field-label" htmlFor="pomodoro-task">选择任务</label><select className="full-select" id="pomodoro-task" value={data.timer.linkedTaskId} onChange={(event) => setData((old) => ({ ...old, timer: { ...old.timer, linkedTaskId: event.target.value } }))}><option value="">不关联任务</option>{data.tasks.filter((task) => task.status !== "done").map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select><p className="helper-text">本轮完成后，记录仅写入本地浏览器。切换关联会作用于当前轮次。</p></Panel><Panel><PanelHead title="当前计时偏好" detail="可在设置中调整默认分钟数" action={<button className="text-action" onClick={() => navigate("settings")}>设置 <ArrowRight size={13}/></button>}/><div className="duration-summary"><div><span>专注</span><b>{data.preferences.focusMinutes} 分</b></div><div><span>短休息</span><b>{data.preferences.shortBreakMinutes} 分</b></div><div><span>长休息</span><b>{data.preferences.longBreakMinutes} 分</b></div></div><p className="helper-text">每 {data.preferences.roundsBeforeLong} 轮进入长休息；结束阶段需要手动开始下一段。</p></Panel><Panel><PanelHead title="最近记录" detail={`${data.focusLogs.filter((log) => log.kind === "pomodoro").length} 条番茄专注记录`}/>{data.focusLogs.filter((log) => log.kind === "pomodoro").slice(0, 3).map((log) => <div className="record-row compact" key={log.id}><span className="record-icon"><Timer size={14}/></span><div><b>{Math.floor(log.durationSeconds / 60)} 分钟专注</b><small>{log.taskId ? data.tasks.find((task) => task.id === log.taskId)?.title : "未关联任务"}</small></div><CheckCircle2 size={16} color="var(--success)"/></div>)}{!data.focusLogs.some((log) => log.kind === "pomodoro") && <p className="muted-copy">完成一轮后，记录会出现在此处。</p>}</Panel></div></div>
        </>}

        {page === "english" && <>
          <Heading eyebrow="LEARNING · DEMO WORD SET" title="英语学习" description="CET-4 / CET-6 示例词条：词库来源、考试题库与复习间隔算法待确认。" action={<div className="cet-switch" role="group" aria-label="选择词库">{(["CET-4", "CET-6"] as const).map((level) => <button key={level} className={cet === level ? "selected" : ""} onClick={() => { setCet(level); setWordIndex(0); setAnswerVisible(false); setPracticeChoice(null); }}>{level}</button>)}</div>}/>
          <div className="learning-summary"><div><BookOpen size={17}/><span><b>{words.length}</b><small>演示词条</small></span></div><div><CheckCircle2 size={17}/><span><b>{data.words.filter((word) => word.cet === cet && word.known).length}</b><small>已标记掌握</small></span></div><div><Clock3 size={17}/><span><b>{reviewWords.length}</b><small>建议复习</small></span></div><div className="summary-note">当前进度只根据此浏览器的样例词条与操作记录统计。</div></div>
          <div className="learning-tabs" role="tablist" aria-label="英语学习功能">{([ ["词卡", BookOpen], ["复习", Clock3], ["生词本", BookMarked], ["练习", ListTodo] ] as const).map(([name, Icon]) => <button role="tab" aria-selected={englishTab === name} className={englishTab === name ? "active" : ""} key={name} onClick={() => { setEnglishTab(name); setAnswerVisible(false); setPracticeChoice(null); }}><Icon size={15}/>{name}{name === "复习" && reviewWords.length > 0 && <span>{reviewWords.length}</span>}</button>)}</div>
          {englishTab === "词卡" && <div className="flashcard-layout"><Panel className="flashcard-panel"><div className="flashcard-head"><span>{cet} · 演示词卡</span><small>{Math.min(wordIndex + 1, words.length)} / {words.length}</small></div>{currentWord ? <><div className={`flashcard ${answerVisible ? "revealed" : ""}`}><span className="flashcard-bookmark"><button aria-label={currentWord.starred ? "从生词本移除" : "加入生词本"} onClick={() => { setData((old) => ({ ...old, words: old.words.map((word) => word.id === currentWord.id ? { ...word, starred: !word.starred } : word) })); say(currentWord.starred ? "已从生词本移除" : "已加入生词本"); }}><Star size={17} fill={currentWord.starred ? "currentColor" : "none"}/></button></span><span className="word-counter">{currentWord.cet}</span><b>{currentWord.spelling}</b><span className="phonetic">{currentWord.phonetic} · {currentWord.part}</span>{answerVisible ? <><span className="word-definition">{currentWord.meaning}</span><span className="word-example">“{currentWord.example}”</span></> : null}<button className="reveal-control" onClick={() => setAnswerVisible((visible) => !visible)} aria-expanded={answerVisible}>{answerVisible ? "隐藏释义" : "揭示释义"}</button></div><div className="flashcard-feedback"><p>{answerVisible ? "这次记得怎么样？" : "先试着回忆，再揭示答案。"}</p><div><ActionButton disabled={!answerVisible} variant="secondary" onClick={() => rateWord(currentWord, "again")}>再练一次</ActionButton><ActionButton disabled={!answerVisible} variant="soft" onClick={() => rateWord(currentWord, "hard")}>有点模糊</ActionButton><ActionButton disabled={!answerVisible} onClick={() => rateWord(currentWord, "good")}>记住了</ActionButton></div></div></> : <EmptyState title="这个词库暂无示例词条" detail="题库接入后可在这里学习真实词条。"/>}</Panel><Panel className="learning-side"><PanelHead title="学习说明" detail="透明的演示边界"/><div className="info-callout"><Sparkles size={16}/><p><b>当前是交互样例</b><br/>词条为演示数据，不代表完整 CET 词库。答题结果保存在本机；真实题库、分级数据和复习算法尚未配置。</p></div><PanelHead title="快速入口"/><button className="learning-link" onClick={() => setEnglishTab("复习")}><Clock3 size={16}/><span><b>查看复习队列</b><small>{reviewWords.length} 个演示词条建议复习</small></span><ArrowRight size={15}/></button><button className="learning-link" onClick={() => setEnglishTab("生词本")}><BookMarked size={16}/><span><b>我的生词本</b><small>{data.words.filter((word) => word.cet === cet && word.starred).length} 个已收藏</small></span><ArrowRight size={15}/></button><button className="learning-link" onClick={() => setEnglishTab("练习")}><ListTodo size={16}/><span><b>开始轻量练习</b><small>本地演示题型</small></span><ArrowRight size={15}/></button></Panel></div>}
          {englishTab === "复习" && <Panel className="review-panel"><PanelHead title="今日建议复习" detail={`范围：${cet} · 按本地样例标记筛选，不代表正式间隔重复算法`}/>{reviewWords.length ? <>{reviewWords.map((word) => <div className="review-row" key={word.id}><span className="review-letter">Aa</span><div><b>{word.spelling}</b><small>{answerVisible && currentWord?.id === word.id ? word.meaning : "先回忆含义，再查看答案"}</small></div><button className="small-control" onClick={() => { setWordIndex(Math.max(0, words.findIndex((item) => item.id === word.id))); setAnswerVisible(true); setEnglishTab("词卡"); }}>查看词卡 <ArrowRight size={13}/></button><ActionButton variant="soft" onClick={() => rateWord(word, "good")}>完成复习</ActionButton></div>)}</> : <EmptyState title="当前没有标记为待复习的演示词条" detail="在词卡或练习中选择「再练一次」，可将词条放回本地复习列表。" action={<ActionButton onClick={() => setEnglishTab("词卡")}>返回词卡</ActionButton>}/>}</Panel>}
          {englishTab === "生词本" && <Panel className="review-panel"><PanelHead title="我的生词本" detail="收藏仅影响当前词库与本机演示数据。"/>{data.words.filter((word) => word.cet === cet && word.starred).length ? data.words.filter((word) => word.cet === cet && word.starred).map((word) => <div className="review-row" key={word.id}><span className="review-letter"><Star size={15}/></span><div><b>{word.spelling}</b><small>{word.meaning.replace("\n", " / ")}</small></div><button className="small-control" onClick={() => { setWordIndex(words.findIndex((item) => item.id === word.id)); setEnglishTab("词卡"); setAnswerVisible(true); }}>词卡 <ArrowRight size={13}/></button><button className="small-control" onClick={() => setData((old) => ({ ...old, words: old.words.map((item) => item.id === word.id ? { ...item, starred: false } : item) }))}><X size={14}/>移除</button></div>) : <EmptyState title="生词本还是空的" detail="在词卡或练习中选择星标，方便稍后复习。" action={<ActionButton onClick={() => setEnglishTab("词卡")}>去看词卡</ActionButton>}/>}</Panel>}
          {englishTab === "练习" && <Panel className="practice-panel"><PanelHead title="快速练习" detail="示例选择题 · 不是真实考试题库" action={<span className="practice-score">本次 {practiceCorrect}/{practiceCount}</span>}/>{currentWord ? <><div className="practice-progress"><span>题目 {practiceCount + 1}</span><span>{cet}</span></div><h2>“{currentWord.meaning.split("\n")[0].replace(/^[^ ]+\s/, "")}” 最接近哪个词？</h2><div className="choice-list">{[currentWord.spelling, ...words.filter((word) => word.id !== currentWord.id).slice(0, 3).map((word) => word.spelling)].sort((a, b) => a.localeCompare(b)).map((choice) => <button className={`choice ${practiceChoice ? choice === currentWord.spelling ? "correct" : choice === practiceChoice ? "incorrect" : "" : ""}`} key={choice} disabled={Boolean(practiceChoice)} onClick={() => ratePractice(currentWord, choice === currentWord.spelling)}><span>{choice}</span>{practiceChoice && choice === currentWord.spelling && <CheckCircle2 size={17}/>}</button>)}</div>{practiceChoice && <div className={`answer-feedback ${practiceChoice === currentWord.spelling ? "success" : "error"}`} role="status">{practiceChoice === currentWord.spelling ? "答对了，已记录为掌握。" : `这题再看看：${currentWord.spelling} — ${currentWord.meaning.replace("\n", " / ")}`}<button onClick={() => { const next = (wordIndex + 1) % Math.max(words.length, 1); setWordIndex(next); setPracticeChoice(null); setAnswerVisible(false); }}>下一题 <ArrowRight size={13}/></button></div>}</> : <EmptyState title="暂无练习内容" detail="待接入题库后可配置题型、范围与数量。"/>}<p className="helper-text">练习使用本地示例词条自动组成选择题。题型和题目数量配置待接入正式题库后确定。</p></Panel>}
        </>}

        {page === "habits" && <>
          <Heading eyebrow="GROWTH · HABITS" title="习惯" description="轻量记录每天想做的事；允许补记与跳过，不用断签惩罚自己。" action={<ActionButton icon={Plus} onClick={() => say("新建习惯表单待数据服务接入。")}>添加习惯</ActionButton>}/>
          <div className="habit-grid">{data.habits.map((habit) => <Panel key={habit.id} className="habit-detail"><div className="habit-detail-top"><span className="habit-icon"><Flame size={19}/></span><span className="streak-pill"><Flame size={13}/>{habit.streak} 天连续</span></div><h2>{habit.title}</h2><p>今日记录是可选的，你可以随时补记或跳过。</p><div className="habit-week-labels">{["一", "二", "三", "四", "五", "六", "日"].map((label, index) => <span key={index}>{label}</span>)}</div><div className="habit-week">{habit.days.map((day, index) => <span key={index} className={day ? "checked" : ""} aria-label={`${day ? "已记录" : "未记录"}第 ${index + 1} 天`}>{day && <Check size={12}/>}</span>)}</div><div className="habit-detail-actions"><ActionButton variant={habit.checkedToday ? "soft" : "primary"} icon={habit.checkedToday ? Check : Plus} onClick={() => setData((old) => ({ ...old, habits: old.habits.map((item) => item.id === habit.id ? { ...item, checkedToday: !item.checkedToday, days: [...item.days.slice(0, 6), !item.checkedToday] } : item) }))}>{habit.checkedToday ? "已记录 · 撤销" : "记录今天"}</ActionButton><button className="text-action" onClick={() => say("补记和跳过日程将在习惯 API 对接后开放。")}>补记 / 跳过</button></div></Panel>)}</div>
        </>}

        {page === "goals" && <>
          <Heading eyebrow="GROWTH · GOALS" title="目标" description="目标展示周期和进度来源；演示进度不代表真实学习或习惯数据。" action={<ActionButton icon={Plus} onClick={() => say("新建目标入口将在目标与习惯联动服务接入后开放。")}>新建目标</ActionButton>}/>
          <div className="goals-grid">{data.goals.map((goal, index) => <Panel className="goal-card" key={goal.id}><div className="goal-card-top"><span className={`goal-icon goal-${index}`}><Goal size={19}/></span><span className="goal-due">{goal.due}</span></div><h2>{goal.title}</h2><p>{goal.detail}</p><div className="goal-progress"><div className="progress-track"><i style={{ width: `${goal.progress}%` }}/></div><b>{goal.progress}%</b></div><small className="goal-source">进度来源 · {goal.source}</small><div className="goal-links"><button onClick={() => navigate(goal.id === "g1" ? "english" : "habits")}><ArrowUpRight size={14}/>{goal.id === "g1" ? "打开英语学习" : "查看习惯"}</button><button onClick={() => navigate("projects")}><FolderKanban size={14}/>关联项目</button></div></Panel>)}</div>
        </>}

        {page === "analytics" && <>
          <Heading eyebrow="INSIGHTS · LOCAL DEMO" title="分析" description="统计区间：当前浏览器已有记录。样本不足时不推断趋势，也不补造数据。" action={<button className="range-picker" onClick={() => say("当前区间为本地记录；日期范围筛选待接入。")}>近 7 天 <ChevronDown size={14}/></button>}/>
          <div className="stats-grid analytics-stats"><div className="stat-card card"><span className="stat-top">已保存专注</span><b className="stat-value">{Math.floor(data.focusLogs.reduce((sum, log) => sum + log.durationSeconds, 0) / 60)} 分</b><span className="stat-note">只统计已保存 Focus / Pomodoro 记录</span></div><div className="stat-card card"><span className="stat-top">完成任务</span><b className="stat-value">{data.tasks.filter((task) => task.status === "done").length}</b><span className="stat-note">来自本地任务状态</span></div><div className="stat-card card"><span className="stat-top">学习答题</span><b className="stat-value">{data.studyRecords.length}</b><span className="stat-note">正确率分母：已记录答题数</span></div><div className="stat-card card"><span className="stat-top">今日打卡</span><b className="stat-value">{data.habits.filter((habit) => habit.checkedToday).length}</b><span className="stat-note">来自本地习惯记录</span></div></div>
          <div className="analytics-grid"><Panel><PanelHead title="近 7 天活动" detail="只显示有真实本地记录的日子"/>{data.focusLogs.length || data.studyRecords.length ? <div className="activity-bars">{Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const sessions = data.focusLogs.filter((log) => new Date(log.endedAt).toDateString() === date.toDateString()).length; const studies = data.studyRecords.filter((record) => new Date(record.at).toDateString() === date.toDateString()).length; const total = sessions + studies; return <div className="bar-column" key={date.toISOString()}><span>{total ? `${total} 项` : "—"}</span><div><i style={{ height: `${total ? Math.min(100, 20 + total * 22) : 3}%` }}/></div><small>{date.toLocaleDateString("zh-CN", { weekday: "short" })}</small></div>; })}</div> : <EmptyState title="数据不足，暂不显示趋势" detail="完成 Focus / Pomodoro 或记录英语学习后，趋势会从本地事件生成。"/>}<div className="chart-text-summary">图表摘要：{data.focusLogs.length + data.studyRecords.length ? `有 ${data.focusLogs.length} 条专注和 ${data.studyRecords.length} 条学习记录。` : "当前区间暂无可用于趋势分析的记录。"}</div></Panel><Panel><PanelHead title="数据口径" detail="当前只汇总本机事件"/><ul className="definition-list"><li><b>专注时间</b><span>Focus 与已完成的 Pomodoro 记录时长总和。</span></li><li><b>任务完成</b><span>当前任务状态为「已完成」的数量。</span></li><li><b>英语学习</b><span>已提交的词卡自评或本地练习作答事件。</span></li><li><b>习惯记录</b><span>今天被标记为已记录的演示习惯数量。</span></li></ul><div className="inline-alert">演示种子任务、词条和习惯不作为历史事件计入趋势。</div></Panel></div>
        </>}

        {page === "notes" && <>
          <Heading eyebrow="NOTES · QUICK THOUGHTS" title="笔记" description="快速记录与可编辑内容。输入会自动保存在当前浏览器，不会同步到服务端。" action={<ActionButton icon={Plus} onClick={() => { const note: Note = { id: uid(), title: "未命名笔记", body: "", updatedAt: "刚刚" }; setData((old) => ({ ...old, notes: [note, ...old.notes] })); setSelectedNoteId(note.id); say("已新建笔记"); }}>新建笔记</ActionButton>}/>
          <div className="notes-layout"><Panel className="note-list-panel"><label className="note-search"><Search size={15}/><input placeholder="搜索笔记" aria-label="搜索笔记" onChange={(event) => setSearchText(event.target.value)}/></label><div className="note-list">{data.notes.filter((note) => !searchText || `${note.title} ${note.body}`.toLowerCase().includes(searchText.toLowerCase())).map((note) => <button key={note.id} className={`note-item ${selectedNote?.id === note.id ? "active" : ""}`} onClick={() => setSelectedNoteId(note.id)}><b>{note.title || "未命名笔记"}</b><span>{note.updatedAt} · {note.body.slice(0, 56) || "空白笔记"}</span></button>)}</div>{!data.notes.length && <EmptyState title="还没有笔记" detail="创建第一条记录，随时继续编辑。"/>}</Panel>{selectedNote ? <Panel className="note-editor"><div className="editor-meta"><span><StickyNote size={14}/>本机自动保存</span><span>{selectedNote.updatedAt}</span></div><input className="note-title-input" aria-label="笔记标题" value={selectedNote.title} onChange={(event) => setData((old) => ({ ...old, notes: old.notes.map((note) => note.id === selectedNote.id ? { ...note, title: event.target.value, updatedAt: "刚刚" } : note) }))}/><textarea className="note-body-input" aria-label="笔记内容" value={selectedNote.body} placeholder="从一个念头开始…" onChange={(event) => setData((old) => ({ ...old, notes: old.notes.map((note) => note.id === selectedNote.id ? { ...note, body: event.target.value, updatedAt: "刚刚" } : note) }))}/><div className="editor-bottom"><span><CheckCircle2 size={14}/>更改自动保存到本地</span><button className="small-control" onClick={() => { const note = selectedNote; setData((old) => ({ ...old, notes: old.notes.filter((item) => item.id !== note.id) })); setSelectedNoteId(data.notes.find((item) => item.id !== note.id)?.id ?? ""); say("笔记已移除", { label: "撤销", run: () => setData((old) => ({ ...old, notes: [note, ...old.notes] })) }); }}><Trash2 size={14}/>删除</button></div></Panel> : <Panel className="note-editor"><EmptyState title="选择一条笔记" detail="保留左侧列表与尚未提交的编辑。" action={<ActionButton onClick={() => say("选择列表中的笔记，或创建新笔记。")}>继续编辑</ActionButton>}/></Panel>}</div>
        </>}

        {page === "knowledge" && <>
          <Heading eyebrow="KNOWLEDGE · LIBRARY" title="知识库" description="整理可复用的主题与资料。笔记保留快速记录用途；两者目前以示例条目关联。" action={<ActionButton icon={Plus} onClick={() => navigate("notes")}>从笔记开始</ActionButton>}/>
          <div className="knowledge-callout"><Library size={19}/><div><b>知识库与笔记有什么不同？</b><p>笔记用来快速写下当下想法；知识库用于以后重用的主题摘要。当前尚未接入专门的知识库后端。</p></div><button onClick={() => navigate("notes")}>打开笔记 <ArrowRight size={14}/></button></div><div className="knowledge-grid">{[{ title: "研究方法", label: "主题", text: "将研究材料拆成可验证的问题与阶段性产物。", count: "2 条关联笔记", icon: Library }, { title: "英语表达", label: "学习资料", text: "记录有助于写作与阅读的实用词汇。", count: "1 条关联笔记", icon: BookMarked }, { title: "每周回顾", label: "流程", text: "回看近期做得好的事，再选择下一步。", count: "演示页面", icon: Sparkles }].map((card) => <button className="knowledge-card card" key={card.title} onClick={() => navigate("notes")}><span className="knowledge-icon"><card.icon size={18}/></span><small>{card.label}</small><b>{card.title}</b><p>{card.text}</p><span className="knowledge-count">{card.count} <ArrowRight size={13}/></span></button>)}</div>
        </>}

        {page === "files" && <>
          <Heading eyebrow="FILES · INDEX ONLY" title="文件" description="当前仅展示示例索引和关联入口；上传、存储、预览与外部盘连接尚未接入。" action={<ActionButton icon={Plus} variant="secondary" disabled title="文件存储 API 尚未接入">上传文件</ActionButton>}/>
          <div className="inline-alert"><FolderOpen size={15}/>这里不是云盘：本地样例不会上传，配置文件存储服务后才能管理真实附件。</div><div className="file-grid">{[{ name: "research-outline.pdf", type: "PDF", size: "示例 · 248 KB", project: "论文研究" }, { name: "weekly-review.md", type: "MD", size: "示例 · 12 KB", project: "个人工作台" }, { name: "cet6-notes.txt", type: "TXT", size: "示例 · 4 KB", project: "英语备考" }].map((file) => <article className="file-card card" key={file.name}><span className={`file-type ${file.type.toLowerCase()}`}>{file.type}</span><b>{file.name}</b><small>{file.size}</small><div className="file-associated"><FolderKanban size={13}/>{file.project}</div><button className="small-control" onClick={() => say("该条目是文件索引示例，没有真实文件可预览。")}>查看详情 <ArrowRight size={13}/></button></article>)}</div>
        </>}

        {page === "notifications" && <>
          <Heading eyebrow="SYSTEM · ACTIVITY" title="通知" description="提醒与事项活动单独展示，不与收件箱混在一起。" action={<ActionButton variant="secondary" onClick={() => setData((old) => ({ ...old, notifications: old.notifications.map((item) => ({ ...item, read: true })) }))}>全部标为已读</ActionButton>}/>
          <Panel className="notification-list">{data.notifications.length ? data.notifications.map((notification) => <article className={`notification-row ${notification.read ? "read" : ""}`} key={notification.id}><span className="notification-symbol"><Bell size={16}/></span><div><div className="notification-title-row"><b>{notification.title}</b>{!notification.read && <span className="unread-label">未读</span>}</div><p>{notification.detail}</p><small>{notification.time}</small></div><div className="notification-actions">{!notification.read && <button className="small-control" onClick={() => markRead(notification)}><Check size={14}/>标为已读</button>}<button className="small-control" onClick={() => { markRead(notification); navigate(notification.id.includes("finish") ? "pomodoro" : "today"); }}>查看 <ArrowRight size={13}/></button></div></article>) : <EmptyState title="暂时没有通知" detail="提醒功能需在服务端和浏览器权限接入后使用。"/>}</Panel>
          <p className="helper-text">浏览器通知权限尚未申请；计时和学习提醒当前不会在应用外发送。</p>
        </>}

        {page === "settings" && <>
          <Heading eyebrow="SYSTEM · PREFERENCES" title="设置" description="计时和学习目标偏好保存在当前浏览器。账号、同步与隐私控制待服务端接入。"/>
          <div className="settings-layout"><div className="right-stack"><Panel><PanelHead title="专注与休息" detail="时长以分钟计，需为 1–180 的整数。"/><div className="settings-fields">{([["focusMinutes", "专注时长"], ["shortBreakMinutes", "短休息"], ["longBreakMinutes", "长休息"], ["roundsBeforeLong", "每几轮长休息"]] as const).map(([key, label]) => <label className="setting-field" key={key}><span>{label}</span><input type="number" min="1" max="180" value={data.preferences[key]} onChange={(event) => { const value = Math.max(1, Math.min(180, Number(event.target.value) || 1)); setData((old) => ({ ...old, preferences: { ...old.preferences, [key]: value }, timer: old.timer.running ? old.timer : { ...old.timer, remainingSeconds: (old.timer.mode === "focus" ? (key === "focusMinutes" ? value : old.preferences.focusMinutes) : old.timer.mode === "short" ? (key === "shortBreakMinutes" ? value : old.preferences.shortBreakMinutes) : (key === "longBreakMinutes" ? value : old.preferences.longBreakMinutes)) * 60 } })); }}/></label>)}</div><p className="helper-text">修改默认时长不改变已记录的历史会话；当前运行中的计时保持不变。</p></Panel><Panel><PanelHead title="英语学习目标" detail="只控制本地界面显示，不连接题库。"/><div className="settings-fields">{([["dailyNewWords", "每日新词目标"], ["dailyReviewWords", "每日复习目标"]] as const).map(([key, label]) => <label className="setting-field" key={key}><span>{label}</span><input type="number" min="0" max="500" value={data.preferences[key]} onChange={(event) => setData((old) => ({ ...old, preferences: { ...old.preferences, [key]: Math.max(0, Math.min(500, Number(event.target.value) || 0)) } }))}/></label>)}</div></Panel></div><div className="right-stack"><Panel><PanelHead title="数据与隐私" detail={isDemoMode ? "本地浏览器演示" : apiHealth.state === "checking" ? "正在检查同源服务端" : apiHealth.state === "ready" ? "服务端可用 · 本页仍为预览" : "服务端连接状态需处理"}/><div className="api-status"><span className={`status-dot ${apiHealth.state === "ready" ? "connected" : ""}`}/><div><b>{isDemoMode ? "仅本地演示" : apiHealth.state === "ready" ? "REST API 可用" : apiHealth.state === "unauthenticated" ? "会话未认证（401）" : apiHealth.state === "database-unavailable" ? "数据库不可用（503）" : apiHealth.state === "checking" ? "正在检查…" : "API 不可用"}</b><small>{isDemoMode ? "NEXT_PUBLIC_DATA_MODE=demo；界面交互只保存到当前浏览器。" : `请求基址为 ${API_ROOT || "同源"}；${apiHealth.message || "健康检查尚未完成。"}`}</small></div></div><p className="helper-text">{isDemoMode ? "任务、笔记、词条反馈与计时写入 localStorage（仅当前浏览器）。" : "当前界面仍显示本地只读预览数据，不写入 localStorage，也不会提交到服务端。服务端身份只由会话派生，前端不发送 userId。"} API 适配层位于 <code>src/lib/api.ts</code>，服务端会话认证方式待配置。</p><div className="settings-note"><FileText size={15}/><span>清理浏览器站点数据会移除本机演示记录。</span></div></Panel><Panel><PanelHead title="提醒与声音" detail="当前未请求浏览器通知权限"/><div className="capability-row"><span>应用外通知</span><span className="pending-pill">待 API / 权限对接</span></div><div className="capability-row"><span>计时结束声音</span><span className="pending-pill">待验证</span></div><p className="helper-text">当前关闭这些开关，避免呈现未实现能力。应用内状态仍会显示计时阶段。</p></Panel><Panel><PanelHead title="品牌与数据来源"/><p className="helper-text">NOVA 名称和低饱和配色沿用现有静态壳，作为可替换的工作标签；品牌、正式题库、词汇来源、复习间隔与外部同步方式尚未确认。</p></Panel></div></div>
        </>}
      </main>
      <footer className="main-footer"><span>NOVA · Personal workspace</span><span>{ready ? (isDemoMode ? "本地演示已就绪" : "预览数据已加载") : "正在恢复状态…"} · 不代表服务端持久化</span><button onClick={() => navigate("settings")}>数据与隐私</button></footer>
    </div>

    <nav className="mobile-nav" aria-label="手机端主要导航">{mobileLinks.map((item) => item.id === "more" ? <button key={item.id} className={modal === "more" ? "active" : ""} onClick={() => setModal("more")}><item.icon size={19}/><span>{item.label}</span></button> : <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id as ModuleId)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>

    <Dialog.Root open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}>
      <Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className={`command-dialog ${modal === "more" ? "more-dialog" : ""}`} onOpenAutoFocus={(event) => { event.preventDefault(); searchInput.current?.focus(); }}>
        <Dialog.Title className="sr-only">{modal === "search" ? "全局搜索" : modal === "capture" ? "快速收集" : modal === "commands" ? "命令面板" : "更多模块"}</Dialog.Title>
        <Dialog.Description className="sr-only">使用键盘和按钮完成工作台操作。按 Escape 关闭。</Dialog.Description>
        {modal === "search" && <><div className="dialog-search"><Search size={18}/><input ref={searchInput} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索任务、项目、笔记、知识或词条…" aria-label="搜索工作台"/><kbd>ESC</kbd><Dialog.Close className="close-dialog" aria-label="关闭搜索"><X size={17}/></Dialog.Close></div><div className="search-results" aria-live="polite">{!searchText.trim() ? <div className="search-empty"><Search size={19}/><span>输入关键词，搜索当前演示数据</span><small>任务 · 项目 · 笔记 · 收件箱 · CET-4/6 词条</small></div> : results.length ? results.map((result) => <button className="search-result" key={`${result.module}-${result.id}`} onClick={() => navigate(result.module)}><span className="result-type">{result.type}</span><span><b>{result.title}</b><small>{result.meta}</small></span><ArrowUpRight size={15}/></button>) : <div className="search-empty"><Search size={19}/><b>没有找到匹配项</b><small>试试其他关键词，当前搜索仅包含本地演示数据。</small></div>}</div><div className="dialog-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 浏览</span><span><kbd>Enter</kbd> 打开结果</span><button onClick={() => setModal("commands")}><Command size={13}/>命令面板</button></div></>}
        {modal === "capture" && <form className="capture-dialog-form" onSubmit={submitCapture}><div className="dialog-heading"><div><span className="dialog-icon"><Plus size={17}/></span><div><b>快速收集</b><small>先记下来，再去收件箱整理。</small></div></div><Dialog.Close className="close-dialog" aria-label="关闭"><X size={17}/></Dialog.Close></div><div className="capture-kind-tabs" role="group" aria-label="收集类型">{([ ["task", "任务"], ["note", "笔记"], ["link", "链接"] ] as const).map(([kind, label]) => <button type="button" key={kind} className={captureKind === kind ? "active" : ""} onClick={() => setCaptureKind(kind)}>{label}</button>)}</div><label htmlFor="capture-input">内容</label><textarea ref={captureInput} id="capture-input" name="capture" required minLength={1} maxLength={500} placeholder={captureKind === "link" ? "粘贴一个链接…" : captureKind === "note" ? "写下一个想法…" : "今晚复习 CET-6 单词…"}/><div className="form-row"><small>最多 500 字 · 默认进入收件箱</small><ActionButton type="submit" icon={Send}>收集</ActionButton></div></form>}
        {modal === "commands" && <><div className="dialog-search"><Command size={18}/><input ref={searchInput} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索命令…" aria-label="筛选命令"/><Dialog.Close className="close-dialog" aria-label="关闭"><X size={17}/></Dialog.Close></div><div className="command-list"><p>快速动作</p><button onClick={() => setModal("capture")}><Plus size={16}/>快速收集<span>⌘ Space</span></button><button onClick={() => { setModal(null); navigate("tasks"); }}><CheckCircle2 size={16}/>创建或查看任务</button><button onClick={() => { setModal(null); navigate("notes"); }}><StickyNote size={16}/>新建笔记</button><button onClick={() => openCommand("focus")}><Crosshair size={16}/>开始自由专注</button><button onClick={() => { setModal(null); navigate("pomodoro"); }}><Timer size={16}/>打开 Pomodoro</button>{groups.flatMap((group) => group.items).filter((item) => !searchText || item.label.toLowerCase().includes(searchText.toLowerCase())).map((item) => <button key={item.id} onClick={() => { setModal(null); navigate(item.id); }}><item.icon size={16}/>{item.label}<span>跳转</span></button>)}</div></>}
        {modal === "more" && <><div className="dialog-heading"><div><span className="dialog-icon"><MoreHorizontal size={17}/></span><div><b>更多模块</b><small>包括日历、Pomodoro、资料与设置。</small></div></div><Dialog.Close className="close-dialog" aria-label="关闭"><X size={17}/></Dialog.Close></div><div className="more-grid"><button onClick={() => navigate("dashboard")}><LayoutDashboard size={18}/>工作台</button><button onClick={() => navigate("calendar")}><CalendarDays size={18}/>日历</button><button onClick={() => navigate("pomodoro")}><Timer size={18}/>Pomodoro</button><button onClick={() => navigate("projects")}><FolderKanban size={18}/>项目</button><button onClick={() => navigate("habits")}><Flame size={18}/>习惯</button><button onClick={() => navigate("goals")}><Goal size={18}/>目标</button><button onClick={() => navigate("analytics")}><BarChart3 size={18}/>分析</button><button onClick={() => navigate("notes")}><StickyNote size={18}/>笔记</button><button onClick={() => navigate("knowledge")}><Library size={18}/>知识库</button><button onClick={() => navigate("files")}><FolderOpen size={18}/>文件</button><button onClick={() => navigate("notifications")}><Bell size={18}/>通知</button><button onClick={() => navigate("settings")}><Settings size={18}/>设置</button></div><button className="mobile-search-link" onClick={() => { setSearchText(""); setModal("search"); }}><Search size={16}/>全局搜索 <kbd>⌘ K</kbd></button></>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>

    {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={17}/><span>{toast.message}</span>{toast.action && <button onClick={() => { toast.action?.run(); setToast(null); }}>{toast.action.label}</button>}<button className="toast-close" onClick={() => setToast(null)} aria-label="关闭提示"><X size={15}/></button></div>}
  </div>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span><InboxIcon size={19}/></span><b>{title}</b><p>{detail}</p>{action}</div>;
}
