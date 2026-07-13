import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { costEvents, heartbeatRuns, issueWorkProducts } from "@paperclipai/db";
import type { SoloCompanyDashboardRecommendation } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { agentService } from "./agents.js";
import { approvalService } from "./approvals.js";
import { companyService } from "./companies.js";
import { getUtcMonthStart } from "./dashboard.js";
import { issueService } from "./issues.js";
import { projectService } from "./projects.js";
import { toIssueWorkProduct } from "./work-products.js";

const SOLO_EMPLOYEE_TEMPLATE_KEYS = ["ceo", "pm", "tech_lead", "engineer", "qa_ops"] as const;
type SoloEmployeeTemplateKey = (typeof SOLO_EMPLOYEE_TEMPLATE_KEYS)[number];

type SoloAgentLike = {
  readonly id: string;
  readonly name: string;
  readonly metadata: Record<string, unknown> | null;
};

type StatusLike = {
  readonly status: string;
};

type IssueLike = StatusLike & {
  readonly updatedAt: Date;
};

function isSoloEmployeeTemplateKey(value: string): value is SoloEmployeeTemplateKey {
  return (SOLO_EMPLOYEE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

function getSoloEmployeeKey(agent: SoloAgentLike): SoloEmployeeTemplateKey | null {
  const value = agent.metadata?.employeeTemplateId;
  return typeof value === "string" && isSoloEmployeeTemplateKey(value) ? value : null;
}

function sortSoloEmployees<T extends SoloAgentLike>(agents: T[]): T[] {
  const order = new Map(SOLO_EMPLOYEE_TEMPLATE_KEYS.map((key, index) => [key, index]));
  return [...agents].sort((left, right) => {
    const leftKey = getSoloEmployeeKey(left);
    const rightKey = getSoloEmployeeKey(right);
    const leftRank = leftKey ? order.get(leftKey) ?? 99 : 99;
    const rightRank = rightKey ? order.get(rightKey) ?? 99 : 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.name.localeCompare(right.name);
  });
}

function issueIsOpen(issue: StatusLike): boolean {
  return issue.status !== "done" && issue.status !== "cancelled";
}

function approvalNeedsAttention(approval: StatusLike): boolean {
  return approval.status === "pending" || approval.status === "revision_requested";
}

function startOfUtcWeek(date: Date): Date {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(dayStart + mondayOffset * 24 * 60 * 60 * 1000);
}

function buildRecommendations(input: {
  approvals: readonly StatusLike[];
  blockers: readonly IssueLike[];
  employees: readonly SoloAgentLike[];
  startupIssues: readonly StatusLike[];
}): SoloCompanyDashboardRecommendation[] {
  const recommendations: SoloCompanyDashboardRecommendation[] = [];
  if (input.approvals.length > 0) {
    recommendations.push({
      id: "review-approvals",
      label: "Review board approvals",
      description: "Clear pending governed-action decisions before AI employees execute risky work.",
      actionHref: "/approvals",
    });
  }
  if (input.blockers.length > 0) {
    recommendations.push({
      id: "resolve-blockers",
      label: "Resolve blocked tasks",
      description: "Unblock startup tasks so the initial company operating loop can continue.",
      actionHref: "/issues?attention=blocked",
    });
  }
  const ceo = input.employees.find((agent) => getSoloEmployeeKey(agent) === "ceo");
  if (ceo && input.startupIssues.some(issueIsOpen)) {
    recommendations.push({
      id: "start-ceo-loop",
      label: "Start CEO loop",
      description: "Have the CEO review the 7-day plan, current blockers, approvals, and next delegation step.",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "inspect-company",
      label: "Inspect company state",
      description: "Review employees, startup tasks, recent artifacts, and costs before assigning follow-up work.",
      actionHref: "/issues",
    });
  }
  return recommendations;
}

export function soloCompanyDashboardService(db: Db) {
  const companies = companyService(db);
  const agents = agentService(db);
  const issues = issueService(db);
  const approvals = approvalService(db);
  const projects = projectService(db);

  return {
    summary: async (companyId: string) => {
      const company = await companies.getById(companyId);
      if (!company) throw notFound("Company not found");

      const [
        allAgents,
        allIssues,
        approvalRows,
        projectRows,
        failedRuns,
        activeRuns,
        recentArtifactRows,
        monthCostRows,
      ] = await Promise.all([
        agents.list(companyId),
        issues.list(companyId, { sortField: "updated", sortDir: "desc" }),
        approvals.list(companyId),
        projects.list(companyId),
        db
          .select()
          .from(heartbeatRuns)
          .where(
            and(
              eq(heartbeatRuns.companyId, companyId),
              inArray(heartbeatRuns.status, ["failed", "timed_out"]),
            ),
          )
          .orderBy(desc(heartbeatRuns.updatedAt))
          .limit(5),
        db
          .select()
          .from(heartbeatRuns)
          .where(
            and(
              eq(heartbeatRuns.companyId, companyId),
              inArray(heartbeatRuns.status, ["queued", "running"]),
            ),
          ),
        db
          .select()
          .from(issueWorkProducts)
          .where(eq(issueWorkProducts.companyId, companyId))
          .orderBy(desc(issueWorkProducts.updatedAt))
          .limit(5),
        db
          .select()
          .from(costEvents)
          .where(and(eq(costEvents.companyId, companyId), gte(costEvents.occurredAt, getUtcMonthStart(new Date())))),
      ]);

      const employees = sortSoloEmployees(allAgents.filter((agent) => getSoloEmployeeKey(agent)));
      const attentionApprovals = approvalRows
        .filter(approvalNeedsAttention)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      const blockers = allIssues
        .filter((issue) => issue.status === "blocked")
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      const startupIssues = allIssues
        .filter((issue) => issue.originKind === "company_template" && issue.originId === "solo_software_company")
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      const weekStart = startOfUtcWeek(new Date());
      const doneThisWeek = allIssues.filter((issue) => {
        if (issue.status !== "done" || !issue.completedAt) return false;
        return issue.completedAt >= weekStart;
      }).length;
      const monthlySpendCents = monthCostRows.reduce((total, row) => total + row.costCents, 0);

      return {
        company,
        metrics: {
          activeAgents: employees.filter((agent) => agent.status !== "terminated").length,
          runningRuns: activeRuns.length,
          pendingApprovals: attentionApprovals.length,
          blockedIssues: blockers.length,
          monthlySpendCents,
          doneThisWeek,
        },
        attention: {
          approvals: attentionApprovals.slice(0, 5),
          blockers: blockers.slice(0, 5),
          failedRuns,
        },
        employees,
        projects: projectRows,
        startupIssues,
        recentArtifacts: recentArtifactRows.map(toIssueWorkProduct),
        ceoRecommendations: buildRecommendations({
          approvals: attentionApprovals,
          blockers,
          employees,
          startupIssues,
        }),
      };
    },
  };
}
