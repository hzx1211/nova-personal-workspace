# NOVA 前端 QA 运行入口与已知边界

更新：2026-09-29（UTC）

## 启动

在项目根目录运行以下命令：

```bash
npm install
NEXT_PUBLIC_DATA_MODE=demo npm run dev -- --hostname 0.0.0.0
```

默认端口 `3000`。

本地浏览器演示为显式模式，只使用 `localStorage` 保存本机 demo 数据；这不是服务端持久化。

## 检查命令

```bash
npx tsc --noEmit
npm run build
```

生产构建与类型检查请在当前开发服务器退出后串行执行，避免 Next.js 共用 `.next` 目录。端点契约以 [`docs/openapi.yaml`](./openapi.yaml) 为准，API 类型与适配器在 `src/lib/api-types.ts`、`src/lib/api.ts`。

## 运行模式

- 默认 API 基址为空并请求同源 `/api/v1/...`；跨域 API 才设置 `NEXT_PUBLIC_API_BASE_URL`。
- 将 `NEXT_PUBLIC_DATA_MODE=demo` 明确设为演示模式，才启用浏览器本地保存。
- API 模式启动：`NEXT_PUBLIC_DATA_MODE=api npm run dev -- --hostname 0.0.0.0`。此模式的交互界面目前仍为只读预览数据，不会写入 localStorage，也尚未逐个资源接线到 REST mutations。
- API 模式会请求 `GET /api/v1/dashboard?timezone=<IANA timezone>` 并在全局状态条与 Settings 中显示健康状态：401 会标注会话未通过验证；503 且 `code=DATABASE_UNAVAILABLE` 会标注数据库配置/Prisma 不可用；网络错误及其他 503 分别提示。
- API 错误 UI 不显示后端 detail/title/资源数据。请求不携带客户端 `userId`，会话身份由服务端派生。

## 当前观察记录（不等同完整 E2E）

- 根页面本机与共享测试 URL 均返回 HTTP 200；标题为 `NOVA · 个人工作台`，初始页面可见完整共享导航，展示明确的“演示数据 · 仅存本机”标记。
- QA 同伴已独立复核：`npm run typecheck`、本机/共享首页 HTTP 200、Dashboard API 的 `503 / DATABASE_UNAVAILABLE`、搜索分页封套与无客户端 `userId` 均符合预期。
- `NEXT_PUBLIC_DATA_MODE=demo npm run build` 和 `NEXT_PUBLIC_DATA_MODE=api npm run build` 均成功；Next.js 构建有一条来自服务端 `src/lib/server/prisma.ts` 的动态依赖 warning，未阻止构建。
- API 模式生产截图已确认全局提示显示“服务端数据库尚未配置”，包含 503/code 与不提交说明，并提供“重新检查”；不展示后端 `detail`。
- 浏览器桌面首屏截图已检查；Inbox 导航可打开其页面；快速收集对话框可打开并显示聚焦文本区。
- 本次浏览器自动化层拒绝向 textarea 注入键盘文本（`REF_NOT_INTERACTABLE`），因此没有声称完成快速收集写入/Inbox→Task/计时/词卡真实端到端操作；请 QA 同伴在交互浏览器中继续执行测试计划中的可测路径。
- 当前服务端 `GET /api/v1/dashboard?timezone=Asia%2FShanghai` 实际返回 `503 application/problem+json`、`code=DATABASE_UNAVAILABLE`、`detail=DATABASE_URL is not configured.`。UI 应按 code 显示安全提示，不显示 detail。尚无可用会话/数据库，不能声称真实 CRUD 或服务器持久化通过。

## 优先冒烟路径

1. Dashboard 与共享导航：切换 Dashboard / Inbox / Today / Tasks / Projects / Calendar / Focus / Pomodoro / English / Notes / Knowledge / Files / Habits / Goals / Analytics / Notifications / Settings。
2. 快速收集：收集一条短文本，确认显示成功状态、Inbox 数量变更，再将该项处理为 Task；重载确认 demo 仍在本机。
3. 任务：筛选/完成任务、从任务启动 Focus；核对 Today 与 Dashboard 变化。
4. 专注：单独验证自由 Focus 开始/暂停/结束记录；Pomodoro 开始/暂停/继续/重置与阶段标签。
5. CET-4/CET-6：切换考试词卡、翻词卡/显示释义、星标到生词本、进入复习和练习反馈；注意全部数据标为演示，不代表许可题库或正式 SRS 算法。
6. 手机视口（约 390×844）：检查 4–5 项底栏、英语与 Focus 快达、Pomodoro 可达、弹层/表单无水平溢出与焦点可见。
7. API 状态：用 `NEXT_PUBLIC_DATA_MODE=api` 启动；当前无 DB 预期出现 `503 / DATABASE_UNAVAILABLE`。若之后有会话配置，则分别验证 401 与可用状态。不要发送 `userId`。

## 尚待接入或确认

身份认证与会话签发、生产数据库与 Prisma 部署、CET 词库来源/许可、复习算法、二进制文件存储、服务端 CRUD 的 UI mutations、真实外部日历/通知、正式品牌。请不要把前端本地演示数据描述成后端用户数据。

## Git 与部署

本项目可通过 Git 管理。公开仓库的发布与部署状态请以对应平台上的实际配置为准；部署由项目维护者单独配置。
