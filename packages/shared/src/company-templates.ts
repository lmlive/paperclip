export const COMPANY_TEMPLATE_IDS = ["blank", "solo_software_company"] as const;

export type CompanyTemplateId = (typeof COMPANY_TEMPLATE_IDS)[number];
export type CompanyOperatingMode = CompanyTemplateId;

export interface CompanyEmployeeTemplate {
  key: string;
  name: string;
  role: "ceo" | "cto" | "pm" | "engineer" | "qa" | "general";
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
  defaultProjects: Array<{
    key: string;
    name: string;
    description?: string;
  }>;
  defaultIssues: Array<{
    title: string;
    description: string;
    assigneeEmployeeKey?: string;
    projectKey?: string;
    priority?: "critical" | "high" | "medium" | "low";
  }>;
}

const hermesRuntimeConfig = {
  heartbeat: {
    maxConcurrentRuns: 1,
  },
};

const standardEmployeePermissions = {
  canCreateAgents: false,
  canCreateSkills: true,
  trustPreset: "standard",
};

const managerEmployeePermissions = {
  ...standardEmployeePermissions,
  canCreateAgents: false,
  canAssignTasks: true,
};

const ceoEmployeePermissions = {
  ...managerEmployeePermissions,
  canCreateAgents: true,
};

export const SOLO_SOFTWARE_COMPANY_TEMPLATE: CompanyTemplateDefinition = {
  id: "solo_software_company",
  label: "1-person software company",
  description: "A Hermes-first AI software company with CEO, PM, Tech Lead, Engineer, and QA/Ops employees.",
  employees: [
    {
      key: "ceo",
      name: "CEO",
      role: "ceo",
      title: "CEO",
      adapterType: "hermes_local",
      capabilities: "Sets company strategy, reviews progress, prioritizes work, and asks the human board for high-impact decisions.",
      promptTemplate: "You are the CEO of this one-person AI software company. Review company goals, projects, issues, approvals, costs, and activity. Prioritize work, delegate to your team, and ask the human board for approvals when needed. Output: Summary, Decisions, Tasks created, Blockers, Board asks.",
      permissions: ceoEmployeePermissions,
      runtimeConfig: hermesRuntimeConfig,
      metadata: { employeeTemplateId: "ceo", department: "executive" },
    },
    {
      key: "pm",
      name: "PM",
      role: "pm",
      title: "Product Manager",
      reportsToKey: "ceo",
      adapterType: "hermes_local",
      capabilities: "Turns goals into PRDs, acceptance criteria, milestones, and inspectable tasks.",
      promptTemplate: "You are the Product Manager. Convert company goals and board requests into clear requirements, acceptance criteria, and task breakdowns. Keep every task tied to the company goal.",
      permissions: managerEmployeePermissions,
      runtimeConfig: hermesRuntimeConfig,
      metadata: { employeeTemplateId: "pm", department: "product" },
    },
    {
      key: "tech_lead",
      name: "Tech Lead",
      role: "cto",
      title: "Tech Lead",
      reportsToKey: "ceo",
      adapterType: "hermes_local",
      capabilities: "Designs implementation plans, reviews technical risk, and coordinates engineering execution.",
      promptTemplate: "You are the Tech Lead. Read requirements, design practical implementation plans, identify risks, assign engineering tasks, and review results before delivery.",
      permissions: managerEmployeePermissions,
      runtimeConfig: hermesRuntimeConfig,
      metadata: { employeeTemplateId: "tech_lead", department: "engineering" },
    },
    {
      key: "engineer",
      name: "Engineer",
      role: "engineer",
      title: "Full-stack Engineer",
      reportsToKey: "tech_lead",
      adapterType: "hermes_local",
      capabilities: "Implements code changes, fixes bugs, runs targeted validation, and reports artifacts for review.",
      promptTemplate: "You are the Full-stack Engineer. Work only on assigned issues, clarify acceptance criteria, implement minimal high-quality changes, run focused validation, and request approval before risky external actions.",
      permissions: standardEmployeePermissions,
      runtimeConfig: hermesRuntimeConfig,
      metadata: { employeeTemplateId: "engineer", department: "engineering" },
    },
    {
      key: "qa_ops",
      name: "QA/Ops",
      role: "qa",
      title: "QA & DevOps",
      reportsToKey: "tech_lead",
      adapterType: "hermes_local",
      capabilities: "Runs tests, verifies UI/API behavior, checks deployments, and reports release readiness.",
      promptTemplate: "You are QA & DevOps. Verify completed work with tests, browser checks, health checks, and deployment readiness reports. Do not deploy production without board approval.",
      permissions: standardEmployeePermissions,
      runtimeConfig: hermesRuntimeConfig,
      metadata: { employeeTemplateId: "qa_ops", department: "quality" },
    },
  ],
  defaultProjects: [
    {
      key: "delivery_system",
      name: "AI software delivery system",
      description: "Build the operating workflow for delivering software projects with AI employees.",
    },
  ],
  defaultIssues: [
    {
      title: "Draft the first 7-day company action plan",
      description: "Create a concise first-week execution plan tied to the company goal. Include priorities, risks, and board decisions needed.",
      assigneeEmployeeKey: "ceo",
      projectKey: "delivery_system",
      priority: "high",
    },
    {
      title: "Draft the first project PRD",
      description: "Turn the company goal into the first project PRD with scope, acceptance criteria, and milestones.",
      assigneeEmployeeKey: "pm",
      projectKey: "delivery_system",
      priority: "medium",
    },
    {
      title: "Design the technical delivery workflow",
      description: "Define how engineering tasks move from plan to implementation, review, validation, and release.",
      assigneeEmployeeKey: "tech_lead",
      projectKey: "delivery_system",
      priority: "medium",
    },
    {
      title: "Prepare the development environment checklist",
      description: "List the required repositories, commands, tests, secrets, and verification steps for engineering work.",
      assigneeEmployeeKey: "engineer",
      projectKey: "delivery_system",
      priority: "medium",
    },
    {
      title: "Prepare the QA and deployment readiness checklist",
      description: "Define the smoke tests, health checks, rollback checks, and release evidence required before delivery.",
      assigneeEmployeeKey: "qa_ops",
      projectKey: "delivery_system",
      priority: "medium",
    },
  ],
};

export const COMPANY_TEMPLATES: Record<CompanyTemplateId, CompanyTemplateDefinition> = {
  blank: {
    id: "blank",
    label: "Blank company",
    description: "Start with an empty company and configure employees manually.",
    employees: [],
    defaultProjects: [],
    defaultIssues: [],
  },
  solo_software_company: SOLO_SOFTWARE_COMPANY_TEMPLATE,
};

export function isCompanyTemplateId(value: string): value is CompanyTemplateId {
  return (COMPANY_TEMPLATE_IDS as readonly string[]).includes(value);
}
