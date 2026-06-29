# Paperclip 1人公司二开计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将 Paperclip 从通用 AI-agent company control plane 二开成适合单人操盘的“1人公司 OS”：一个人通过 Web UI/移动通知管理多名 AI 员工，完成软件开发、运营增长、市场调研、客服/销售跟进等闭环工作。

**Architecture:** 保留 Paperclip 作为公司级控制平面，不重写为聊天产品；新增“一人公司”模板、角色预设、任务/审批驾驶舱、Hermes-first 执行默认值和业务流水线。Paperclip 负责公司/员工/任务/预算/审批/审计，Hermes/Claude/Codex/OpenHands 等 adapter 负责执行。

**Tech Stack:** Paperclip monorepo, Node/TypeScript, Express, React/Vite, Drizzle/PostgreSQL, adapter plugin system, Hermes adapter, local CLI/session adapters, routines/pipelines/plugins.

---

## 0. 当前仓库状态

- 本地路径：`/home/liming/projects/paperclip`
- 远程：`git@github.com:paperclipai/paperclip.git`
- 分支：`master`
- 已拉取最新：`e6407b322 refactor: revert X mention poller backend (#8709)`
- `git status --short --branch`：`## master...origin/master`
- 代码规模粗略统计：TypeScript/TSX 约 819k 行，JSON 很多来自 lock/fixture，整体已是大型 monorepo。

## 1. Repo 证据与结论

### 1.1 Paperclip 已经是控制平面，不是执行平面

来自 `doc/GOAL.md` / `doc/PRODUCT.md` / `doc/SPEC-implementation.md`：

- Paperclip 是 **control plane for autonomous AI companies**。
- V1 明确支持：company、org tree、agents、issues/comments、heartbeats、approvals、budgets、activity log。
- `doc/SPEC-implementation.md` 第 14-25 行明确目标：一个 operator 能运行 small AI-native company end-to-end。

结论：**不要重写 Paperclip；应在现有控制平面上做“一人公司”产品化二开。**

### 1.2 Hermes 已进入 core adapter 体系

当前 `server/package.json` / `ui/package.json` 都依赖：

- `@paperclipai/hermes-paperclip-adapter: workspace:*`

当前 `server/src/adapters/registry.ts`：

- 直接 import `createHermesGatewayServerAdapter` / `createHermesLocalServerAdapter`
- 注册 `hermes_gateway` 与 `hermes_local`

当前 `server/src/adapters/builtin-adapter-types.ts`：

- `hermes_gateway`
- `hermes_local`

结论：当前 upstream master 是 **builtin + external overlay**，不是 plugin-only Hermes。短期可以直接利用 built-in Hermes；中长期可再评估是否回到 AGENTS.md 提到的 external-only adapter 策略。

### 1.3 已有长会话/唤醒/审批基础

已存在数据模型：

- `packages/db/src/schema/agent_runtime_state.ts`
  - `sessionId`
  - `stateJson`
  - `lastRunId`
  - token/cost 汇总
- `packages/db/src/schema/agent_task_sessions.ts`
  - `taskKey`
  - `sessionParamsJson`
  - `sessionDisplayId`
- `packages/db/src/schema/agent_wakeup_requests.ts`
  - wakeup payload/status/idempotency/runId
- `packages/db/src/schema/heartbeat_runs.ts`
  - `sessionIdBefore`
  - `sessionIdAfter`
  - `contextSnapshot`
  - `continuationAttempt`
  - liveness/nextAction/log refs
- `packages/db/src/schema/approvals.ts`
  - approval type/status/payload/decision

结论：二开重点不是“从零造 agent”，而是：**把这些底层能力包装成 CEO 视角的公司驾驶舱和模板化员工团队。**

## 2. 产品定位

### 2.1 一句话

> 1人公司 OS：用户只设目标、批关键决策、验收成果；AI 员工自动拆任务、执行、汇报、请求授权、交付工件。

### 2.2 第一版聚焦

第一版先做 **AI 软件开发公司**，因为最贴合当前 Paperclip + Hermes/Codex/Claude/OpenCode adapter 能力。

后续再扩展到：

- 市场调研公司
- 内容/SEO 公司
- 销售线索公司
- 客服/运营公司
- 自动化小 SaaS 工作室

## 3. 关键边界

### Paperclip owns

- companies
- org chart / employee registry
- goals / projects / issues / comments
- approvals / budgets / activity / audit
- scheduler / assignment / board visibility
- work products / artifacts / pipelines / routines

### Hermes owns

- per-agent execution runtime
- session continuity
- memory
- skills
- tool orchestration
- subagent delegation
- cron-like autonomous loops

### Other adapters own

- Claude Code / Codex / OpenCode / Gemini / Cursor 等 specialist execution paths
- OpenHands 这类外部工程师可通过 http/process/plugin adapter 接入

## 4. MVP 用户旅程

### 4.1 Onboarding

用户打开 Paperclip：

1. 选择模板：`1人软件公司`
2. 输入公司目标：例如“3个月内交付 AI 项目外包业务，月收入 3 万”
3. 选择默认执行器：Hermes / Claude / Codex / OpenCode
4. 系统自动创建：
   - Company
   - Root company goal
   - 5 个 AI 员工
   - 默认项目
   - 第一批启动任务
   - 预算与审批策略
5. CEO agent 运行第一次 heartbeat，生成战略拆解草案
6. 用户在审批页点击批准/要求修改

### 4.2 日常操作

首页不应是普通 Kanban，而是“一人公司驾驶舱”：

- 今天 AI 员工在干什么
- 哪些结果需要我审批
- 哪些任务阻塞
- 花了多少钱
- 本周产出了什么工件
- 哪些项目接近交付
- 下一步 CEO 建议做什么

## 5. 第一版组织模板

### 5.1 `solo_software_company` 员工

| 员工 | role | title | 默认 runtime | 职责 |
|---|---|---|---|---|
| CEO | `ceo` | CEO | `hermes_local` | 定目标、拆战略、检查所有项目、向用户请求决策 |
| PM | `manager` 或 `general` | Product Manager | `hermes_local` | 写 PRD、拆 issue、维护计划、验收需求 |
| Tech Lead | `manager` 或 `general` | Tech Lead | `hermes_local` | 技术方案、任务拆分、代码审查、调度工程师 |
| Engineer | `general` | Full-stack Engineer | `codex_local` / `claude_local` / `hermes_local` | 实现代码、修 bug、提交 diff |
| QA/Ops | `general` | QA & DevOps | `hermes_local` | 跑测试、浏览器验证、部署检查、故障报告 |

### 5.2 默认权限

- CEO：可创建任务、建议新员工、建议预算变更；高风险动作需 board approval。
- PM/Tech Lead：可创建/分配 issue；不可直接部署生产。
- Engineer：可修改工作区、提交本地改动；push/deploy 需审批。
- QA/Ops：可运行测试和健康检查；生产部署需审批。

## 6. 数据模型策略

第一阶段尽量 **不新增表**，复用现有字段：

- `companies.metadata` 或 `settings` 类现有机制保存 `companyTemplateId`
- `agents.metadata` 保存 `employeeTemplateId`, `department`, `seniority`
- `agents.runtimeConfig` 保存 one-person-company runtime preset
- `issues.origin_kind/origin_id` 保存模板启动任务来源
- `approvals.payload` 保存审批上下文

第二阶段再考虑新增：

- `company_templates`
- `employee_templates`
- `company_operating_modes`
- `company_metrics_snapshots`

## 7. 需要新增/修改的核心文件

### 7.1 Shared contract

- `packages/shared/src/validators/company.ts`
  - 新增 `templateId?: string`
  - 新增 `operatingMode?: 'solo_software_company' | 'blank'`
- `packages/shared/src/types/company.ts`
  - 补充 template/operating mode 类型
- 新建：`packages/shared/src/company-templates.ts`
  - 定义模板 ID、员工预设、默认 goal/project/issues

### 7.2 DB/service

- `server/src/services/companies.ts`
  - 在 `create` 后调用模板 bootstrap service
- 新建：`server/src/services/company-templates.ts`
  - `bootstrapCompanyFromTemplate(companyId, templateId, options)`
  - 创建 root goal / agents / initial project / initial issues
- `server/src/routes/companies.ts`
  - `POST /api/companies` 支持模板参数
  - 或新增 `POST /api/companies/:companyId/bootstrap-template`

### 7.3 Agent presets

- 新建：`server/src/services/one-person-company-presets.ts`
  - 生成 Hermes promptTemplate
  - 生成默认 runtimeConfig
  - 生成 permissions
- 修改：`ui/src/components/agent-config-defaults.ts`
  - 对一人公司模板默认 `adapterType` 优先设为 `hermes_local`
- 修改：`ui/src/lib/new-agent-hire-payload.ts`
  - 支持 template/preset metadata

### 7.4 UI

- `ui/src/components/OnboardingWizardVariant.tsx`
  - 增加模板选择卡片：Blank / 1人软件公司
- `ui/src/pages/Companies.tsx`
  - New Company 打开模板化 onboarding
- 新建：`ui/src/pages/SoloCompanyDashboard.tsx`
  - 公司驾驶舱
- 修改：`ui/src/App.tsx`
  - 添加可选路由或 dashboard 内分支
- 修改：`ui/src/pages/Dashboard.tsx` / `DashboardLive.tsx`
  - 当 company metadata 表示 solo company 时显示专用视图

### 7.5 Docs

- 新建：`doc/plans/2026-06-29-one-person-ai-company-fork-plan.md`（本文件）
- 新建：`doc/ONE-PERSON-COMPANY.md`
  - 产品说明和使用方式
- 更新：`doc/PRODUCT.md`
  - 加入 Solo operator template 是 Paperclip 的一种模板，不改变核心边界

## 8. 实施计划

## Phase 0 — 基线验证与分支

### Task 0.1 创建工作分支

**Files:** 无

```bash
cd /home/liming/projects/paperclip
git checkout -b feat/one-person-company
```

**验证：**

```bash
git status --short --branch
```

### Task 0.2 安装与轻量测试

```bash
pnpm install
pnpm test:run -- --help || pnpm test
```

如果依赖变动大，优先跑：

```bash
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
```

## Phase 1 — 模板 contract，不创建 UI

### Task 1.1 新增模板类型定义

**Create:** `packages/shared/src/company-templates.ts`

建议结构：

```ts
export const COMPANY_TEMPLATE_IDS = ["blank", "solo_software_company"] as const;
export type CompanyTemplateId = (typeof COMPANY_TEMPLATE_IDS)[number];

export interface CompanyEmployeeTemplate {
  key: string;
  name: string;
  role: "ceo" | "general" | "manager";
  title: string;
  reportsToKey?: string;
  adapterType: string;
  capabilities: string;
  promptTemplate: string;
  permissions: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CompanyTemplateDefinition {
  id: CompanyTemplateId;
  label: string;
  description: string;
  employees: CompanyEmployeeTemplate[];
  defaultProjects: Array<{ key: string; name: string; description?: string }>;
  defaultIssues: Array<{
    title: string;
    description: string;
    assigneeEmployeeKey?: string;
    projectKey?: string;
    priority?: "critical" | "high" | "medium" | "low";
  }>;
}
```

### Task 1.2 扩展 createCompanySchema

**Modify:** `packages/shared/src/validators/company.ts`

增加：

```ts
templateId: z.enum(COMPANY_TEMPLATE_IDS).optional().default("blank")
```

注意避免把 `templateId` 直接 insert 到 `companies` 表。

### Task 1.3 添加 shared 测试

**Test:** 新建或修改 `packages/shared/src/validators/company.test.ts`

验证：

- 不传 templateId 时默认 `blank`
- 传 `solo_software_company` 成功
- 传未知模板失败

运行：

```bash
pnpm --filter @paperclipai/shared test -- validators/company.test.ts
```

## Phase 2 — Server bootstrap company template

### Task 2.1 新建模板 bootstrap service

**Create:** `server/src/services/company-templates.ts`

职责：

1. 接收 `companyId`, `templateId`, `companyGoalText`
2. 对 `blank` 直接返回
3. 对 `solo_software_company`：
   - 创建 root goal
   - 创建 default project
   - 创建 CEO/PM/Tech Lead/Engineer/QA-Ops agents
   - 创建 initial issues
   - 写 activity log

实现细节：

- 用 `agentService(txDb).create()` 创建员工，避免绕过权限/secret/runtime normalization。
- 先创建 CEO，再创建下级，保存 `templateKey -> agentId` map。
- `adapterConfig.promptTemplate` 由模板生成。
- 默认 `adapterType`：CEO/PM/Tech Lead/QA 使用 `hermes_local`，Engineer 可以先用 `hermes_local`，后续 UI 让用户改成 `codex_local` 或 `claude_local`。

### Task 2.2 修改 company create flow

**Modify:** `server/src/services/companies.ts`

当前 `create` 在第 262 行附近：

```ts
create: async (data: typeof companies.$inferInsert) => {
  const created = await createCompanyWithUniquePrefix(data);
  await environmentsSvc.ensureLocalEnvironment(created.id);
  ...
}
```

建议改为：

- route 层解析出 `templateId`
- service `create` 仍只负责 company 基础创建
- route 层在 company 创建成功后调用 `companyTemplateService(db).bootstrap(...)`

原因：减少 `companies.$inferInsert` 与 create schema 扩展字段冲突。

### Task 2.3 修改 companies route

**Modify:** `server/src/routes/companies.ts`

当前第 297 行：

```ts
router.post("/", validate(createCompanySchema), async (req, res) => {
```

处理：

```ts
const { templateId, ...companyInput } = req.body;
const company = await svc.create(companyInput);
if (templateId && templateId !== "blank") {
  await companyTemplateService(db).bootstrap(company.id, templateId, { actor: getActorInfo(req) });
}
```

### Task 2.4 Server 测试

**Test:** 新建 `server/src/__tests__/company-templates.test.ts`

验证：

- 创建 solo template company 后有 5 个 agents
- 第一名 agent 是 CEO，role 为 `ceo`
- PM/Tech Lead/Engineer/QA reportsTo 正确
- 至少创建 1 个 root goal、1 个 project、若干 initial issues
- agents 的 `adapterType` 为 `hermes_local`
- activity log 有 `company.template_bootstrapped`

运行：

```bash
pnpm --filter @paperclipai/server test -- company-templates.test.ts
```

## Phase 3 — Onboarding UI 模板选择

### Task 3.1 找到现有 onboarding 入口

**Inspect:**

- `ui/src/components/OnboardingWizardVariant.tsx`
- `ui/src/context/DialogContext.tsx`
- `ui/src/pages/Companies.tsx`

### Task 3.2 增加模板选择 UI

**Modify:** `ui/src/components/OnboardingWizardVariant.tsx`

新增两个卡片：

- Blank company
- 1人软件公司

选择后提交 `templateId` 到 `companiesApi.create`。

### Task 3.3 UI API 类型同步

**Modify:**

- `ui/src/api/companies.ts`
- 任何 `CreateCompany` 类型引用

确保 `templateId` 可传。

### Task 3.4 UI 测试

新增/修改测试：

- 选择 `1人软件公司`
- 提交时请求体包含 `templateId: 'solo_software_company'`
- 创建成功后跳转到 dashboard/org

运行：

```bash
pnpm --filter @paperclipai/ui test -- OnboardingWizardVariant
```

## Phase 4 — Solo Company Dashboard

### Task 4.1 新增 dashboard read model

**Create:** `server/src/services/solo-company-dashboard.ts`

返回：

```ts
{
  company,
  metrics: {
    activeAgents,
    runningRuns,
    pendingApprovals,
    blockedIssues,
    monthlySpendCents,
    doneThisWeek
  },
  attention: {
    approvals: [],
    blockers: [],
    failedRuns: []
  },
  employees: [],
  recentArtifacts: [],
  ceoRecommendations: []
}
```

### Task 4.2 新增 API route

**Create/Modify:**

- `server/src/routes/solo-company-dashboard.ts`
- 或挂在 `companies/:companyId/solo-dashboard`

### Task 4.3 新增 UI 页面

**Create:** `ui/src/pages/SoloCompanyDashboard.tsx`

页面区块：

1. 今日公司状态
2. 需要我审批
3. 员工状态
4. 项目/任务进度
5. 成本预算
6. 最近产出
7. CEO 建议

### Task 4.4 Dashboard 分支显示

**Modify:** `ui/src/pages/Dashboard.tsx`

如果 `selectedCompany.metadata.templateId === 'solo_software_company'`，显示 `SoloCompanyDashboard`。

## Phase 5 — Hermes-first 员工体验

### Task 5.1 角色 prompt 模板

**Create:** `server/src/services/one-person-company-prompts.ts`

为每类员工生成 promptTemplate。

CEO 示例要点：

- 你是此公司 CEO
- 每次 heartbeat 先看 goals/projects/issues/approvals/activity
- 不直接写代码，优先拆任务、分派、请求审批
- 重大动作创建 approval，不绕过 board
- 输出必须包含：Summary / Decisions / Tasks created / Blockers / Board asks

Engineer 示例要点：

- 只处理分配给自己的 issue
- 开始前确认验收标准
- 修改代码后跑最小验证
- 需要 push/deploy/删数据时请求审批

### Task 5.2 Agent creation defaults

**Modify:**

- `ui/src/components/agent-config-defaults.ts`
- `ui/src/pages/NewAgent.tsx`

当来自 template flow 或 query `?preset=solo_engineer` 时自动填：

- name/title/role
- adapterType
- promptTemplate
- heartbeatEnabled
- intervalSec
- permissions

### Task 5.3 Hermes adapter smoke

使用已有 smoke：

```bash
pnpm smoke:hermes-gateway-join
pnpm test:hermes-gateway-smoke
```

如果只用 `hermes_local`，增加 targeted adapter config test。

## Phase 6 — 自动运行与审批闭环

### Task 6.1 初始化启动任务

模板创建时自动创建这些 issues：

1. CEO：制定 7 天行动计划
2. PM：把公司目标拆成第一个项目 PRD
3. Tech Lead：评估技术交付流程
4. Engineer：准备开发环境检查清单
5. QA/Ops：制定验收和部署检查清单

### Task 6.2 可选自动唤醒 CEO

创建模板后：

- 创建 `agent_wakeup_requests` 给 CEO
- 或 UI 显示“启动 CEO”按钮

第一版建议按钮触发，避免用户刚创建就开始烧 token。

### Task 6.3 审批策略

默认必须审批：

- 新员工创建
- 预算增加
- 生产部署
- 对外发邮件/发帖
- 删除数据
- git push 到远程

## 9. 验证计划

### 每阶段最小验证

```bash
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
pnpm test:run
```

### 手动验收

```bash
pnpm dev:once
curl -s http://localhost:3100/api/health
```

浏览器验收：

1. 打开 `/onboarding`
2. 创建 `1人软件公司`
3. 查看 `/org` 有 5 个员工
4. 查看 `/goals` 有 root goal
5. 查看 `/issues` 有 initial issues
6. 打开 CEO detail，确认 adapter 为 Hermes，promptTemplate 正确
7. 点击 wake/run，确认 heartbeat_runs 生成
8. 查看 approvals/activity/costs 是否有记录

## 10. 风险与处理

| 风险 | 影响 | 处理 |
|---|---|---|
| createCompanySchema 加 templateId 后误写 DB | 服务报错 | route 层剥离 templateId，不传给 `svc.create` |
| 模板 bootstrap 部分成功部分失败 | 脏公司 | 用 transaction 或可恢复 activity；第一版优先 transaction |
| Hermes built-in 与 external-only 分支策略冲突 | 后续升级冲突 | 当前先用 upstream master built-in；另开专项审计是否切 fork external-only |
| onboarding UI 变复杂 | 首次体验变差 | 只给 Blank / 1人软件公司 两张卡 |
| 自动 heartbeat 烧 token | 成本不可控 | 默认不自动启动，显示 Start CEO 按钮 |
| Agent prompt 太散 | 产出不可控 | 每个角色固定输出格式 + issue/comment 约束 |
| 大量 adapter 配置暴露给用户 | 上手困难 | 模板默认 Hermes，本页隐藏高级项，Agent 详情页再改 |

## 11. 不做事项

第一阶段不要做：

- 不做完整 CRM/财务系统
- 不做企业级 RBAC
- 不把 Paperclip 改成通用聊天软件
- 不直接删除 built-in Hermes adapter
- 不做 marketplace
- 不引入新的复杂队列系统
- 不做多租户 SaaS 云化改造

## 12. 建议开发顺序

1. `feat/one-person-company` 分支
2. Shared template contract + tests
3. Server bootstrap service + tests
4. Onboarding 模板选择 UI
5. Solo dashboard read model + UI
6. Hermes-first prompt presets
7. 手动启动 CEO heartbeat
8. 文档与 smoke 验证

## 13. 第一批 commit 建议

```bash
git commit -m "feat(shared): add company template contract"
git commit -m "feat(server): bootstrap solo software company template"
git commit -m "feat(ui): add one-person company onboarding option"
git commit -m "feat(ui): add solo company dashboard"
git commit -m "docs: document one-person company workflow"
```

## 14. 后续产品扩展

第二轮模板：

- `solo_growth_company`
- `solo_content_studio`
- `solo_support_ops`
- `solo_research_agency`

第三轮能力：

- 自动找线索
- 自动生成报价
- 自动落地页
- 自动社媒内容草稿
- 自动客户邮件草稿
- 自动交付报告

---

## 结论

可行，而且不需要重写。Paperclip 最新 master 已经具备公司、员工、任务、审批、心跳、运行状态、插件和 Hermes adapter 基础。二开重点应放在：

1. 模板化创建 1 人公司
2. Hermes-first AI 员工预设
3. CEO 视角驾驶舱
4. 审批/预算/产出闭环
5. 软件开发公司 MVP 先跑通
