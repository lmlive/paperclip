import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, Approval, Issue } from "@paperclipai/shared";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "@/lib/router";
import { agentsApi } from "../api/agents";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { AgentStatusBadge, IssueStatusBadge } from "../components/StatusBadge";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";

const SOLO_EMPLOYEE_TEMPLATE_KEYS = ["ceo", "pm", "tech_lead", "engineer", "qa_ops"] as const;
type SoloEmployeeTemplateKey = (typeof SOLO_EMPLOYEE_TEMPLATE_KEYS)[number];

function isSoloEmployeeTemplateKey(value: string): value is SoloEmployeeTemplateKey {
  return (SOLO_EMPLOYEE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

function getSoloEmployeeKey(agent: Agent): SoloEmployeeTemplateKey | null {
  const value = agent.metadata?.employeeTemplateId;
  return typeof value === "string" && isSoloEmployeeTemplateKey(value) ? value : null;
}

export function isSoloSoftwareCompany(agents: Agent[] | undefined): boolean {
  if (!agents) return false;
  const keys = new Set(agents.map(getSoloEmployeeKey).filter(Boolean));
  return SOLO_EMPLOYEE_TEMPLATE_KEYS.every((key) => keys.has(key));
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

function approvalTitle(approval: Approval) {
  const value = approval.payload.title ?? approval.payload.summary ?? approval.payload.recommendedAction ?? approval.type;
  return String(value);
}

function activeIssueCountForAgent(issues: Issue[], agentId: string): number {
  return issues.filter((issue) =>
    issue.assigneeAgentId === agentId && issue.status !== "done" && issue.status !== "cancelled"
  ).length;
}

export function SoloCompanyDashboard({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.soloDashboard(companyId),
    queryFn: () => dashboardApi.soloSummary(companyId),
    enabled: Boolean(companyId),
  });
  const employees = data?.employees ?? [];
  const startupIssues = data?.startupIssues ?? [];
  const issueCounts = countIssuesByStatus(startupIssues);
  const ceo = employees.find((agent) => getSoloEmployeeKey(agent) === "ceo") ?? null;

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
        queryClient.invalidateQueries({ queryKey: queryKeys.soloDashboard(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(companyId) }),
      ]);
    },
  });

  if (isLoading) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading solo company cockpit...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Unable to load solo company dashboard"}
      </section>
    );
  }

  const approvalsToReview = data?.attention.approvals.slice(0, 3) ?? [];
  const activeIssues = startupIssues
    .filter((issue) => issue.status !== "done" && issue.status !== "cancelled")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5);
  const requesterName = (approval: Approval) => {
    if (!approval.requestedByAgentId) return "Board";
    return employees.find((agent) => agent.id === approval.requestedByAgentId)?.name ?? "AI employee";
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
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

      {approvalsToReview.length > 0 ? (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <ShieldCheck className="h-4 w-4" />
                Pending board approvals
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Review these before AI employees execute governed or risky work.</p>
            </div>
            <Link to="/approvals" className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium no-underline text-foreground hover:bg-accent">
              Review all approvals
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {approvalsToReview.map((approval) => (
              <Link
                key={approval.id}
                to={`/approvals/${approval.id}`}
                className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 no-underline text-card-foreground hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{approvalTitle(approval)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Requested by {requesterName(approval)} · {timeAgo(approval.createdAt)}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary">Open approval</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <Metric label="AI employees" value={`${employees.length}/5`} />
        <Metric label="Open tasks" value={issueCounts.todo + issueCounts.inProgress + issueCounts.inReview + issueCounts.blocked} />
        <Metric label="Blocked" value={data?.metrics.blockedIssues ?? 0} />
        <Metric label="Pending approvals" value={data?.metrics.pendingApprovals ?? 0} />
        <Metric label="Done this week" value={data?.metrics.doneThisWeek ?? 0} />
        <Metric label="Monthly spend" value={formatCents(data?.metrics.monthlySpendCents ?? 0)} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-xl border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">AI employee bench</h3>
            <Link to="/agents" className="text-sm text-primary underline-offset-2 hover:underline">Manage agents</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {employees.map((agent) => (
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
                <p className="mt-3 text-xs text-muted-foreground">
                  {activeIssueCountForAgent(startupIssues, agent.id)} active task{activeIssueCountForAgent(startupIssues, agent.id) === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next operating loop</h3>
            {(data?.metrics.pendingApprovals ?? 0) > 0 ? (
              <Link to="/approvals" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
                <AlertCircle className="h-4 w-4" /> Review approvals
              </Link>
            ) : null}
          </div>
          <ol className="space-y-3 text-sm">
            {(data?.ceoRecommendations ?? []).map((recommendation) => (
              <li key={recommendation.id} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <span><strong>{recommendation.label}</strong>: {recommendation.description}</span>
              </li>
            ))}
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

      {(data?.recentArtifacts.length ?? 0) > 0 ? (
        <div className="mt-5 rounded-xl border bg-background/70 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4" />
            Recent artifacts
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {data?.recentArtifacts.map((artifact) => (
              <Link key={artifact.id} to={`/issues/${artifact.issueId}`} className="rounded-lg border bg-card p-3 no-underline text-card-foreground hover:bg-accent/50">
                <p className="truncate text-sm font-medium">{artifact.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{artifact.type} · {artifact.status}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
