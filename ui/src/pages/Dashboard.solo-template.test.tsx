// @vitest-environment jsdom

import { act } from "react";
import type { ComponentProps, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Approval, DashboardSummary, Issue } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";

const apiMocks = vi.hoisted(() => ({
  dashboardSummary: vi.fn(),
  activityList: vi.fn(),
  userDirectoryList: vi.fn(),
  issuesList: vi.fn(),
  agentsList: vi.fn(),
  agentInvoke: vi.fn(),
  approvalsList: vi.fn(),
  projectsList: vi.fn(),
  liveRunsForCompany: vi.fn(),
}));

const mockOpenOnboarding = vi.hoisted(() => vi.fn());
const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    companies: [{ id: "company-1", name: "Solo Software Co" }],
  }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openOnboarding: mockOpenOnboarding }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));

vi.mock("../api/dashboard", () => ({
  dashboardApi: { summary: apiMocks.dashboardSummary },
}));

vi.mock("../api/activity", () => ({
  activityApi: { list: apiMocks.activityList },
}));

vi.mock("../api/access", () => ({
  accessApi: { listUserDirectory: apiMocks.userDirectoryList },
}));

vi.mock("../api/issues", () => ({
  issuesApi: { list: apiMocks.issuesList },
}));

vi.mock("../api/agents", () => ({
  agentsApi: { list: apiMocks.agentsList, invoke: apiMocks.agentInvoke },
}));

vi.mock("../api/approvals", () => ({
  approvalsApi: { list: apiMocks.approvalsList },
}));

vi.mock("../api/heartbeats", () => ({
  heartbeatsApi: { liveRunsForCompany: apiMocks.liveRunsForCompany },
}));

vi.mock("../api/projects", () => ({
  projectsApi: { list: apiMocks.projectsList },
}));

vi.mock("../components/ActiveAgentsPanel", () => ({
  ActiveAgentsPanel: () => <div data-testid="active-agents-panel" />,
}));

vi.mock("../components/ActivityCharts", () => ({
  ChartCard: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  RunActivityChart: () => <div data-testid="run-activity-chart" />,
  PriorityChart: () => <div data-testid="priority-chart" />,
  IssueStatusChart: () => <div data-testid="issue-status-chart" />,
  SuccessRateChart: () => <div data-testid="success-rate-chart" />,
}));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function makeAgent(key: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id: `agent-${key}`,
    companyId: "company-1",
    name: key === "tech_lead" ? "Tech Lead" : key === "qa_ops" ? "QA/Ops" : key.toUpperCase(),
    urlKey: key,
    role: key === "ceo" ? "ceo" : key === "pm" ? "pm" : key === "tech_lead" ? "cto" : key === "qa_ops" ? "qa" : "engineer",
    title: key === "tech_lead" ? "Tech Lead" : null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "hermes_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: { employeeTemplateId: key },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "SOL-1",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Draft the first 7-day company action plan",
    description: null,
    status: "todo",
    workMode: "standard",
    priority: "high",
    assigneeAgentId: "agent-ceo",
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 1,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function makeApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "approval-1",
    companyId: "company-1",
    type: "request_board_approval",
    requestedByAgentId: "agent-ceo",
    requestedByUserId: null,
    status: "pending",
    payload: {
      title: "Approve solo company Task → Approval → Execute policy",
      summary: "Govern risky AI employee work with board approval before execution.",
      riskClass: "governance",
    },
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const summary: DashboardSummary = {
  companyId: "company-1",
  agents: { active: 5, running: 0, paused: 0, error: 0 },
  tasks: { open: 5, inProgress: 0, blocked: 0, done: 0 },
  costs: { monthSpendCents: 0, monthBudgetCents: 0, monthUtilizationPercent: 0 },
  pendingApprovals: 1,
  budgets: { activeIncidents: 0, pendingApprovals: 1, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
};

async function flushReact() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderDashboard(container: HTMLElement): Root {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>,
    );
  });
  return root;
}

describe("Dashboard solo company cockpit", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.dashboardSummary.mockResolvedValue(summary);
    apiMocks.activityList.mockResolvedValue([]);
    apiMocks.userDirectoryList.mockResolvedValue({ users: [] });
    apiMocks.projectsList.mockResolvedValue([]);
    apiMocks.approvalsList.mockResolvedValue([makeApproval()]);
    apiMocks.liveRunsForCompany.mockResolvedValue([]);
    apiMocks.agentInvoke.mockResolvedValue({ id: "run-1", status: "queued" });
    apiMocks.agentsList.mockResolvedValue([
      makeAgent("ceo"),
      makeAgent("pm"),
      makeAgent("tech_lead"),
      makeAgent("engineer"),
      makeAgent("qa_ops"),
    ]);
    apiMocks.issuesList.mockResolvedValue([
      makeIssue(),
      makeIssue({ id: "issue-2", identifier: "SOL-2", title: "Blocked setup", status: "blocked" }),
    ]);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the solo operating cockpit when the template employees are present", async () => {
    root = renderDashboard(container);
    await flushReact();

    expect(document.body.textContent).toContain("Solo Company OS");
    expect(document.body.textContent).toContain("1-person AI software company");
    expect(document.body.textContent).toContain("AI employees");
    expect(document.body.textContent).toContain("5/5");
    expect(document.body.textContent).toContain("Pending approvals");
    expect(document.body.textContent).toContain("2");
    expect(document.body.textContent).toContain("CEO");
    expect(document.body.textContent).toContain("PM");
    expect(document.body.textContent).toContain("Tech Lead");
    expect(document.body.textContent).toContain("QA/Ops");
    expect(document.body.textContent).toContain("Draft the first 7-day company action plan");
    expect(document.body.textContent).toContain("Start CEO loop");
  });

  it("surfaces pending approvals in the solo cockpit", async () => {
    root = renderDashboard(container);
    await flushReact();

    expect(apiMocks.approvalsList).toHaveBeenCalledWith("company-1", "pending");
    expect(document.body.textContent).toContain("Pending board approvals");
    expect(document.body.textContent).toContain("Approve solo company Task → Approval → Execute policy");
    expect(document.body.textContent).toContain("Requested by");
    expect(document.body.textContent).toContain("CEO");
    const approvalLink = Array.from(document.body.querySelectorAll("a")).find((entry) =>
      entry.textContent?.includes("Open approval"),
    ) as HTMLAnchorElement | undefined;
    expect(approvalLink?.getAttribute("href")).toBe("/approvals/approval-1");
  });

  it("starts the CEO operating loop from the dashboard", async () => {
    root = renderDashboard(container);
    await flushReact();

    const button = Array.from(document.body.querySelectorAll("button")).find((entry) =>
      entry.textContent?.includes("Start CEO loop"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button!.click();
    });
    await flushReact();

    expect(apiMocks.agentInvoke).toHaveBeenCalledWith("agent-ceo", "company-1", {
      triggerDetail: "manual",
      reason: "Start the solo company CEO operating loop from the dashboard.",
      forceFreshSession: true,
      payload: {
        intent: "solo_company_operating_loop",
        requestedAction: "Review company state, update the 7-day action plan, identify blockers, and delegate the next tasks.",
      },
      idempotencyKey: "solo-ceo-operating-loop:company-1:agent-ceo",
    });
  });

  it("disables the CEO operating loop button while a CEO run is live", async () => {
    apiMocks.liveRunsForCompany.mockResolvedValue([
      {
        id: "run-1",
        status: "running",
        agentId: "agent-ceo",
        agentName: "CEO",
        adapterType: "hermes_local",
        invocationSource: "on_demand",
        triggerDetail: "manual",
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    root = renderDashboard(container);
    await flushReact();

    const button = Array.from(document.body.querySelectorAll("button")).find((entry) =>
      entry.textContent?.includes("CEO loop running"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();
    expect(button!.disabled).toBe(true);
  });
});
