import type { WorkspaceData } from "./types";

// Clearly illustrative seed data; vocabulary, dates and metrics are not backed by a real account or corpus.
export const demoData: WorkspaceData = {
  tasks: [
    { id: "t1", title: "整理本周的研究资料", status: "doing", priority: "高", project: "论文研究", due: "今天", kind: "深度工作" },
    { id: "t2", title: "复习 CET-6 生词 20 个", status: "todo", priority: "中", project: "英语备考", due: "今天", kind: "学习" },
    { id: "t3", title: "给项目写一份简短复盘", status: "todo", priority: "低", project: "个人工作台", due: "明天", kind: "写作" },
    { id: "t4", title: "整理参考文献与引用格式", status: "done", priority: "中", project: "论文研究", due: "今天", kind: "整理" },
  ],
  projects: [
    { id: "p1", title: "论文研究", description: "梳理材料，推进研究与写作", color: "#78917c", due: "10 月 18 日", taskIds: ["t1", "t4"] },
    { id: "p2", title: "英语备考", description: "为下一次 CET-6 考试做准备", color: "#c39469", due: "11 月 22 日", taskIds: ["t2"] },
    { id: "p3", title: "个人工作台", description: "把日常计划整理得更清楚", color: "#8396af", due: "持续进行", taskIds: ["t3"] },
  ],
  inbox: [
    { id: "i1", text: "今晚复习 CET-6 单词", kind: "task", createdAt: "09:12", source: "快速收集" },
    { id: "i2", text: "想记一下：晨间散步时灵感更好", kind: "note", createdAt: "昨天", source: "快速收集" },
    { id: "i3", text: "https://example.com/research-notes", kind: "link", createdAt: "昨天", source: "粘贴链接" },
  ],
  notes: [
    { id: "n1", title: "今天的研究思路", body: "先整理手头的文献，再把共同主题归纳出来。\n\n- 找出三篇核心参考\n- 标记仍未解决的问题\n- 为下一次专注预留写作时间", updatedAt: "今天 09:20" },
    { id: "n2", title: "周末回顾", body: "这周做得好的事情：保持了散步习惯，也按计划完成了几次专注。下周继续留出不被打断的时间。", updatedAt: "昨天" },
    { id: "n3", title: "英语表达摘录", body: "make steady progress — 稳步推进\n\n值得放进写作素材里的短语。", updatedAt: "9 月 25 日" },
  ],
  words: [
    { id: "cet4-approach", spelling: "approach", phonetic: "/əˈprəʊtʃ/", meaning: "n. 方法；途径；接近\nv. 接近；着手处理", part: "v. / n.", example: "We need a more thoughtful approach to the problem.", cet: "CET-4", known: false, starred: true, due: true },
    { id: "cet4-benefit", spelling: "benefit", phonetic: "/ˈbenɪfɪt/", meaning: "n. 好处；益处\nv. 受益", part: "n. / v.", example: "Regular practice can benefit every learner.", cet: "CET-4", known: true, starred: false, due: false },
    { id: "cet6-resilient", spelling: "resilient", phonetic: "/rɪˈzɪliənt/", meaning: "adj. 有韧性的；能复原的", part: "adj.", example: "A resilient system adapts to change.", cet: "CET-6", known: false, starred: true, due: true },
    { id: "cet6-substantial", spelling: "substantial", phonetic: "/səbˈstænʃəl/", meaning: "adj. 大量的；重大的；坚固的", part: "adj.", example: "The team made substantial progress this month.", cet: "CET-6", known: false, starred: false, due: true },
    { id: "cet6-allocate", spelling: "allocate", phonetic: "/ˈæləkeɪt/", meaning: "v. 分配；拨出（资源或时间）", part: "v.", example: "Allocate a little time to review each day.", cet: "CET-6", known: true, starred: false, due: false },
  ],
  studyRecords: [],
  focusLogs: [],
  habits: [
    { id: "h1", title: "阅读 20 分钟", streak: 5, checkedToday: false, days: [true, true, false, true, true, false, true] },
    { id: "h2", title: "英语听力练习", streak: 3, checkedToday: true, days: [true, true, true, false, true, false, true] },
    { id: "h3", title: "晚间散步", streak: 8, checkedToday: false, days: [true, true, true, true, false, true, true] },
  ],
  goals: [
    { id: "g1", title: "通过 CET-6", detail: "稳步完成学习计划", progress: 42, source: "由已标记掌握的词条驱动（演示）", due: "本季度" },
    { id: "g2", title: "建立稳定的晨间习惯", detail: "每周至少 5 天早间阅读", progress: 68, source: "由每日习惯打卡驱动（演示）", due: "持续目标" },
  ],
  notifications: [
    { id: "a1", title: "今天有 2 项待办", detail: "查看 Today 里的计划安排", time: "09:00", read: false },
    { id: "a2", title: "学习提醒：CET-6 复习", detail: "这是一条演示提醒，复习算法待确认", time: "昨天", read: false },
    { id: "a3", title: "项目「论文研究」有新进展", detail: "你已完成一项关联任务", time: "昨天", read: true },
  ],
  events: [
    { id: "e1", title: "整理研究资料", time: "09:30", kind: "task" },
    { id: "e2", title: "专注时段", time: "11:00", kind: "focus" },
    { id: "e3", title: "CET-6 词汇复习", time: "14:00", kind: "study" },
    { id: "e4", title: "散步休息", time: "16:30", kind: "personal" },
  ],
  timer: { mode: "focus", running: false, remainingSeconds: 25 * 60, deadline: null, rounds: 0, sessionId: null, linkedTaskId: "" },
  freeFocus: { running: false, startedAt: null, accumulatedSeconds: 0, taskId: "" },
  preferences: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, roundsBeforeLong: 4, dailyNewWords: 10, dailyReviewWords: 20, notifications: false, sound: false },
  dismissed: [],
};
