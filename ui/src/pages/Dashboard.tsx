import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { buildCompanyUserProfileMap } from "../lib/company-members";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { AgentStatusBadge, IssueStatusBadge } from "../components/StatusBadge";

import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle, Rocket, ClipboardList, Users, CheckCircle2, AlertCircle, PlayCircle, Loader2 } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import { AGENT_ROLE_LABELS, type Agent, type Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

const DASHBOARD_ACTIVITY_LIMIT = 10;

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

const SOLO_EMPLOYEE_TEMPLATE_KEYS = ["ceo", "pm", "tech_lead", "engineer", "qa_ops"] as const;
type SoloEmployeeTemplateKey = (typeof SOLO_EMPLOYEE_TEMPLATE_KEYS)[number];

function isSoloEmployeeTemplateKey(value: string): value is SoloEmployeeTemplateKey {
  return (SOLO_EMPLOYEE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

function getSoloEmployeeKey(agent: Agent): SoloEmployeeTemplateKey | null {
  const value = agent.metadata?.employeeTemplateId;
  return typeof value === "string" && isSoloEmployeeTemplateKey(value) ? value : null;
}

function isSoloSoftwareCompany(agents: Agent[] | undefined): boolean {
  if (!agents) return false;
  const keys = new Set(agents.map(getSoloEmployeeKey).filter(Boolean));
  return SOLO_EMPLOYEE_TEMPLATE_KEYS.every((key) => keys.has(key));
}

function sortSoloEmployees(agents: Agent[]): Agent[] {
  const order = new Map(SOLO_EMPLOYEE_TEMPLATE_KEYS.map((key, index) => [key, index]));
  return [...agents].sort((a, b) => {
    const aKey = getSoloEmployeeKey(a);
    const bKey = getSoloEmployeeKey(b);
    const aRank = aKey ? order.get(aKey) ?? 99 : 99;
    const bRank = bKey ? order.get(bKey) ?? 99 : 99;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}

function countIssuesByStatus(issues: Issue[] | undefined) {
  const counts = { todo: 0, inProgress: 0, inReview: 0, blocked: 0, done: 0 };
  for (const issue of issues ?? []) {
    if (issue.status === "done") counts.done += 1;
    else if (issue.status === "blocked") counts.blocked += 1;
    else if (issue.status === "in_review") counts.inReview += 1;
    else if (issue.status === "in_progress") counts.inProgress += 1;
    else if (issue.status === "todo" || issue.status === "backlog") counts.todo += 1;
  }
  return counts;
}

function SoloCompanyDashboard({
  companyId,
  agents,
  issues,
  pendingApprovals,
}: {
  companyId: string;
  agents: Agent[];
  issues: Issue[] | undefined;
  pendingApprovals: number;
}) {
  const queryClient = useQueryClient();
  const soloEmployees = sortSoloEmployees(agents.filter((agent) => getSoloEmployeeKey(agent)));
  const ceo = soloEmployees.find((agent) => getSoloEmployeeKey(agent) === "ceo") ?? null;
  const issueCounts = countIssuesByStatus(issues);

  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.liveRuns(companyId), "solo-ceo-operating-loop"],
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId, { limit: 20 }),
    enabled: Boolean(companyId),
    refetchInterval: 5_000,
  });
  const ceoRun = liveRuns?.find((run) => run.agentId === ceo?.id && (run.status === "queued" || run.status === "running")) ?? null;
  const ceoOperatingLoopActive = Boolean(ceoRun);

  const startCeoMutation = useMutation({
    mutationFn: async () => {
      if (!ceo) throw new Error("CEO agent is not available");
      return agentsApi.invoke(ceo.id, companyId, {
        triggerDetail: "manual",
        reason: "Start the solo company CEO operating loop from the dashboard.",
        forceFreshSession: true,
        payload: {
          intent: "solo_company_operating_loop",
          requestedAction: "Review company state, update the 7-day action plan, identify blockers, and delegate the next tasks.",
        },
        idempotencyKey: `solo-ceo-operating-loop:${companyId}:${ceo.id}`,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(companyId) }),
      ]);
    },
  });
  const issuesByAssignee = new Map<string, Issue[]>();
  for (const issue of issues ?? []) {
    if (!issue.assigneeAgentId) continue;
    const assigned = issuesByAssignee.get(issue.assigneeAgentId) ?? [];
    assigned.push(issue);
    issuesByAssignee.set(issue.assigneeAgentId, assigned);
  }
  const activeIssues = [...(issues ?? [])]
    .filter((issue) => issue.status !== "done" && issue.status !== "cancelled")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <section className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Rocket className="h-4 w-4" />
            Solo Company OS
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">1-person AI software company</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Your AI employees are bootstrapped. Use this cockpit to inspect the team, push initial tasks forward, and review approvals before risky actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startCeoMutation.mutate()}
            disabled={!ceo || ceoOperatingLoopActive || startCeoMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startCeoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {ceoOperatingLoopActive ? "CEO loop running" : startCeoMutation.isPending ? "Starting CEO..." : "Start CEO loop"}
          </button>
          <Link to="/org" className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium no-underline text-foreground hover:bg-accent">
            <Users className="h-4 w-4" /> Org chart
          </Link>
          <Link to="/issues" className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium no-underline text-foreground hover:bg-accent">
            <ClipboardList className="h-4 w-4" /> Task board
          </Link>
        </div>
      </div>
      {startCeoMutation.error ? (
        <p className="mt-3 text-sm text-destructive">{startCeoMutation.error.message}</p>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">AI employees</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{soloEmployees.length}/5</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Open tasks</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{issueCounts.todo + issueCounts.inProgress + issueCounts.inReview + issueCounts.blocked}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Blocked</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{issueCounts.blocked}</p>
        </div>
        <div className="rounded-xl border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">Pending approvals</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pendingApprovals}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-xl border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">AI employee bench</h3>
            <Link to="/agents" className="text-sm text-primary underline-offset-2 hover:underline">Manage agents</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {soloEmployees.map((agent) => {
              const assigned = issuesByAssignee.get(agent.id) ?? [];
              const activeAssigned = assigned.filter((issue) => issue.status !== "done" && issue.status !== "cancelled");
              return (
                <Link
                  key={agent.id}
                  to={`/agents/${agent.urlKey || agent.id}`}
                  className="rounded-lg border bg-card p-3 no-underline text-card-foreground transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{agent.title ?? AGENT_ROLE_LABELS[agent.role] ?? agent.role}</p>
                    </div>
                    <AgentStatusBadge status={agent.status} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{activeAssigned.length} active task{activeAssigned.length === 1 ? "" : "s"}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next operating loop</h3>
            {pendingApprovals > 0 ? (
              <Link to="/approvals" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
                <AlertCircle className="h-4 w-4" /> Review approvals
              </Link>
            ) : null}
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span><strong>CEO</strong> reviews the 7-day action plan and board asks.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span><strong>PM + Tech Lead</strong> turn goals into scoped implementation tasks.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span><strong>Engineer + QA/Ops</strong> execute, validate, and attach evidence for review.</span>
            </li>
          </ol>

          <div className="mt-4 border-t pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active startup tasks</h4>
            {activeIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active startup tasks.</p>
            ) : (
              <div className="space-y-2">
                {activeIssues.map((issue) => (
                  <Link key={issue.id} to={`/issues/${issue.identifier ?? issue.id}`} className="block rounded-md border bg-card px-3 py-2 no-underline text-card-foreground hover:bg-accent/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">{issue.title}</span>
                      <IssueStatusBadge status={issue.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{issue.identifier ?? issue.id.slice(0, 8)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: [...queryKeys.activity(selectedCompanyId!), { limit: DASHBOARD_ACTIVITY_LIMIT }],
    queryFn: () => activityApi.list(selectedCompanyId!, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const userProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const showSoloDashboard = isSoloSoftwareCompany(agents);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {showSoloDashboard && data && (
        <SoloCompanyDashboard
          companyId={selectedCompanyId!}
          agents={agents ?? []}
          issues={issues}
          pendingApprovals={data.pendingApprovals + data.budgets.pendingApprovals}
        />
      )}

      {data && (
        <>
          {data.budgets.activeIncidents > 0 ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused · {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Run Activity" subtitle="Last 14 days">
              <RunActivityChart activity={data.runActivity} />
            </ChartCard>
            <ChartCard title="Tasks by Priority" subtitle="Last 14 days">
              <PriorityChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Tasks by Status" subtitle="Last 14 days">
              <IssueStatusChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Success Rate" subtitle="Last 14 days">
              <SuccessRateChart activity={data.runActivity} />
            </ChartCard>
          </div>

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      userProfileMap={userProfileMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Tasks */}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Status icon - left column on mobile */}
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} blockerAttention={issue.blockerAttention} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex"><StatusIcon status={issue.status} blockerAttention={issue.blockerAttention} /></span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name
                                ? <span className="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}


