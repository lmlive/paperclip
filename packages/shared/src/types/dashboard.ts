export interface DashboardRunActivityDay {
  date: string;
  succeeded: number;
  failed: number;
  other: number;
  total: number;
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  runActivity: DashboardRunActivityDay[];
}

export interface SoloCompanyDashboardMetrics {
  activeAgents: number;
  runningRuns: number;
  pendingApprovals: number;
  blockedIssues: number;
  monthlySpendCents: number;
  doneThisWeek: number;
}

export interface SoloCompanyDashboardRecommendation {
  id: string;
  label: string;
  description: string;
  actionHref?: string;
}

export interface SoloCompanyDashboardSummary {
  company: import("./company.js").Company;
  metrics: SoloCompanyDashboardMetrics;
  attention: {
    approvals: import("./approval.js").Approval[];
    blockers: import("./issue.js").Issue[];
    failedRuns: import("./heartbeat.js").HeartbeatRun[];
  };
  employees: import("./agent.js").Agent[];
  projects: import("./project.js").Project[];
  startupIssues: import("./issue.js").Issue[];
  recentArtifacts: import("./work-product.js").IssueWorkProduct[];
  ceoRecommendations: SoloCompanyDashboardRecommendation[];
}
