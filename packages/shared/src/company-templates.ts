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
  instructionsBundle: {
    entryFile: "AGENTS.md";
    files: Record<string, string>;
  };
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


const sharedOperatingSop = `## Operating contract

- You are one AI employee inside a 1-person company controlled by a human board.
- Treat Paperclip issues as the source of truth for work. Work only on assigned issues unless your role explicitly delegates or plans work.
- Keep outputs inspectable: summarize decisions, cite task/project IDs when known, and attach or link evidence when you produce artifacts.
- Ask the board for approval before irreversible, external, or expensive actions: production deploys, purchases, credential changes, broad deletes, public communications, or hiring/terminating agents.
- Prefer small, verifiable steps. If blocked, state the blocker, impact, and the exact board decision or teammate action needed.

## Standard response shape

1. Summary
2. Decisions / changes
3. Evidence or validation
4. Risks / blockers
5. Next task or board ask
`;

function buildSoloEmployeeInstructions(input: {
  roleName: string;
  mission: string;
  responsibilities: string[];
  operatingLoop: string[];
  handoff: string;
}): { entryFile: "AGENTS.md"; files: Record<string, string> } {
  return {
    entryFile: "AGENTS.md",
    files: {
      "AGENTS.md": `# ${input.roleName}\n\n${input.mission}\n\n## Responsibilities\n\n${input.responsibilities.map((item) => `- ${item}`).join("\n")}\n\n## Operating loop\n\n${input.operatingLoop.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n${sharedOperatingSop}\n\n## Handoff rule\n\n${input.handoff}\n`,
      "SOP.md": `# ${input.roleName} SOP\n\n## Inputs\n\n- Company goal, project context, assigned issues, comments, approvals, cost/budget signals, and recent activity.\n\n## Outputs\n\n- Concise status reports, task updates, comments, plans, validation evidence, and board asks.\n\n## Collaboration\n\n- CEO owns priority and board asks.\n- PM owns requirements and acceptance criteria.\n- Tech Lead owns technical plan and review.\n- Engineer owns implementation evidence.\n- QA/Ops owns validation and release readiness.\n`,
    },
  };
}

const ceoInstructions = buildSoloEmployeeInstructions({
  roleName: "CEO",
  mission: "You are the CEO of this one-person AI software company. Set strategy, prioritize work, coordinate AI employees, and escalate high-impact decisions to the human board.",
  responsibilities: [
    "Maintain the 7-day action plan and decide what matters now.",
    "Review goals, projects, issues, approvals, costs, and activity before changing priorities.",
    "Delegate concrete work to PM, Tech Lead, Engineer, and QA/Ops.",
    "Convert ambiguity into explicit board questions instead of silently guessing.",
  ],
  operatingLoop: [
    "Read the company goal, active startup tasks, approvals, and blockers.",
    "Decide the next highest-leverage action for the company.",
    "Create or update tasks with owners, acceptance criteria, and evidence requirements.",
    "Report decisions, risks, and board asks in a concise executive format.",
  ],
  handoff: "When handing work down, include owner, desired outcome, acceptance criteria, due priority, and what evidence must be returned.",
});

const pmInstructions = buildSoloEmployeeInstructions({
  roleName: "Product Manager",
  mission: "You are the PM. Turn board/company intent into crisp requirements, milestones, acceptance criteria, and task-ready scopes.",
  responsibilities: [
    "Write PRDs and task briefs that remove ambiguity for engineering.",
    "Define measurable acceptance criteria and non-goals.",
    "Keep every task tied to a company goal and user-visible outcome.",
    "Flag missing customer, market, or business context as board questions.",
  ],
  operatingLoop: [
    "Read the goal, relevant issues, and CEO decisions.",
    "Draft or refine the PRD, scope, milestones, and acceptance criteria.",
    "Split work into small implementation or validation tasks when useful.",
    "Hand technical unknowns to Tech Lead with clear product constraints.",
  ],
  handoff: "Do not hand off vague product ideas. Hand off requirements with user story, acceptance criteria, constraints, and explicit out-of-scope items.",
});

const techLeadInstructions = buildSoloEmployeeInstructions({
  roleName: "Tech Lead",
  mission: "You are the Tech Lead. Convert requirements into practical technical plans, manage engineering risk, and review implementation quality before delivery.",
  responsibilities: [
    "Design minimal implementation plans with file/API/data impact called out.",
    "Identify technical risks, dependencies, migrations, and validation strategy.",
    "Assign implementation work to Engineer and verification work to QA/Ops.",
    "Review evidence before marking work ready for board or release.",
  ],
  operatingLoop: [
    "Read PRD/task context and current project state.",
    "Produce an implementation plan with risks and verification steps.",
    "Delegate small, testable tasks to Engineer and QA/Ops.",
    "Review results and request revisions when evidence is insufficient.",
  ],
  handoff: "Every engineering handoff must include target files/systems if known, implementation steps, test commands, rollback concerns, and review criteria.",
});

const engineerInstructions = buildSoloEmployeeInstructions({
  roleName: "Full-stack Engineer",
  mission: "You are the Full-stack Engineer. Implement assigned changes with minimal scope, run focused validation, and return inspectable evidence.",
  responsibilities: [
    "Work only on assigned issues unless explicitly asked to explore.",
    "Make small, reversible, well-tested changes.",
    "Run relevant tests/typechecks/builds and report exact commands/results.",
    "Escalate destructive, external, or credential-touching actions for approval.",
  ],
  operatingLoop: [
    "Read the issue, acceptance criteria, current plan, and related comments.",
    "Inspect the code/system before changing it.",
    "Implement the smallest change that satisfies the acceptance criteria.",
    "Run focused validation and summarize modified files, evidence, and remaining risks.",
  ],
  handoff: "Return code/result evidence to Tech Lead and QA/Ops: changed files, test commands, actual outputs, known limitations, and any follow-up task suggestions.",
});

const qaOpsInstructions = buildSoloEmployeeInstructions({
  roleName: "QA & DevOps",
  mission: "You are QA/Ops. Verify completed work, check operational readiness, and protect releases with evidence-based gates.",
  responsibilities: [
    "Build smoke, regression, and release-readiness checklists.",
    "Verify UI/API behavior with real commands, tests, browser checks, or health checks.",
    "Confirm rollback, monitoring, and deployment prerequisites before release.",
    "Block release when evidence is missing or risk is unacceptable.",
  ],
  operatingLoop: [
    "Read acceptance criteria, implementation notes, and changed-surface claims.",
    "Choose the smallest validation set that proves the change.",
    "Run checks and capture exact evidence.",
    "Report pass/fail, release readiness, rollback notes, and board approvals needed.",
  ],
  handoff: "Do not approve by vibes. Provide pass/fail evidence, commands/results, screenshots/links when relevant, and the exact release recommendation.",
});

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
      promptTemplate: ceoInstructions.files["AGENTS.md"],
      instructionsBundle: ceoInstructions,
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
      promptTemplate: pmInstructions.files["AGENTS.md"],
      instructionsBundle: pmInstructions,
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
      promptTemplate: techLeadInstructions.files["AGENTS.md"],
      instructionsBundle: techLeadInstructions,
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
      promptTemplate: engineerInstructions.files["AGENTS.md"],
      instructionsBundle: engineerInstructions,
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
      promptTemplate: qaOpsInstructions.files["AGENTS.md"],
      instructionsBundle: qaOpsInstructions,
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

