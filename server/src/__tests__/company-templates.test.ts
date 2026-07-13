import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  activityLog,
  agents,
  approvals,
  companies,
  createDb,
  goals,
  issueApprovals,
  issues,
  projects,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyService } from "../services/companies.js";
import { companyTemplateService } from "../services/company-templates.js";
import { soloCompanyDashboardService } from "../services/solo-company-dashboard.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company template tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyTemplateService", () => {
  const originalPaperclipHome = process.env.PAPERCLIP_HOME;
  const originalPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let paperclipHome!: string;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-template-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    if (originalPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = originalPaperclipHome;
    if (originalPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = originalPaperclipInstanceId;
    if (paperclipHome) {
      await fs.rm(paperclipHome, { recursive: true, force: true });
      paperclipHome = "";
    }

    await db.delete(activityLog);
    await db.delete(issueApprovals);
    await db.delete(approvals);
    await db.delete(issues);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("bootstraps the solo software company org, project, issues, instructions, and activity", async () => {
    paperclipHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-company-template-home-"));
    process.env.PAPERCLIP_HOME = paperclipHome;
    process.env.PAPERCLIP_INSTANCE_ID = "company-template-test";

    const company = await companyService(db).create({
      name: "Solo Software Co",
      description: "Ship software with AI employees",
    });

    const result = await companyTemplateService(db).bootstrap(company.id, "solo_software_company", {
      actor: {
        actorType: "user",
        actorId: "test-board",
        agentId: null,
        runId: null,
      },
    });

    expect(result.templateId).toBe("solo_software_company");
    expect(result.agentIdsByTemplateKey).toMatchObject({
      ceo: expect.any(String),
      pm: expect.any(String),
      tech_lead: expect.any(String),
      engineer: expect.any(String),
      qa_ops: expect.any(String),
    });
    expect(result.projectIdsByTemplateKey).toMatchObject({
      delivery_system: expect.any(String),
    });
    expect(result.issueIds).toHaveLength(6);

    const agentRows = await db.select().from(agents).where(eq(agents.companyId, company.id));
    expect(agentRows).toHaveLength(5);
    expect(agentRows.every((agent) => agent.adapterType === "hermes_local")).toBe(true);
    expect(agentRows.every((agent) => agent.adapterConfig.promptTemplate === undefined)).toBe(true);
    expect(agentRows.every((agent) => agent.adapterConfig.instructionsBundleMode === "managed")).toBe(true);
    expect(agentRows.every((agent) => agent.adapterConfig.instructionsEntryFile === "AGENTS.md")).toBe(true);

    const byName = new Map(agentRows.map((agent) => [agent.name, agent]));
    const ceo = byName.get("CEO");
    expect(ceo).toMatchObject({ role: "ceo", reportsTo: null });
    expect(byName.get("PM")).toMatchObject({ role: "pm", reportsTo: ceo?.id });
    expect(byName.get("Tech Lead")).toMatchObject({ role: "cto", reportsTo: ceo?.id });
    expect(byName.get("Engineer")).toMatchObject({ role: "engineer", reportsTo: byName.get("Tech Lead")?.id });
    expect(byName.get("QA/Ops")).toMatchObject({ role: "qa", reportsTo: byName.get("Tech Lead")?.id });

    const ceoInstructionsPath = ceo?.adapterConfig.instructionsFilePath;
    expect(typeof ceoInstructionsPath).toBe("string");
    await expect(fs.readFile(ceoInstructionsPath as string, "utf8")).resolves.toContain("# CEO");
    await expect(fs.readFile(ceoInstructionsPath as string, "utf8")).resolves.toContain("## Operating contract");
    const engineer = byName.get("Engineer");
    const engineerInstructionsPath = engineer?.adapterConfig.instructionsFilePath;
    expect(typeof engineerInstructionsPath).toBe("string");
    await expect(fs.readFile(engineerInstructionsPath as string, "utf8")).resolves.toContain("# Full-stack Engineer");
    await expect(fs.readFile(path.join(path.dirname(engineerInstructionsPath as string), "SOP.md"), "utf8")).resolves.toContain("# Full-stack Engineer SOP");

    const goalRows = await db.select().from(goals).where(eq(goals.companyId, company.id));
    expect(goalRows).toHaveLength(1);
    expect(goalRows[0]).toMatchObject({
      level: "company",
      status: "active",
      parentId: null,
    });

    const projectRows = await db.select().from(projects).where(eq(projects.companyId, company.id));
    expect(projectRows).toHaveLength(1);
    expect(projectRows[0]).toMatchObject({
      name: "AI software delivery system",
      goalId: goalRows[0]?.id,
    });

    const issueRows = await db.select().from(issues).where(eq(issues.companyId, company.id));
    expect(issueRows).toHaveLength(6);
    expect(issueRows.every((issue) => issue.projectId === projectRows[0]?.id)).toBe(true);
    expect(issueRows.every((issue) => issue.goalId === goalRows[0]?.id)).toBe(true);
    expect(issueRows.every((issue) => issue.originKind === "company_template")).toBe(true);
    expect(issueRows.every((issue) => issue.identifier?.startsWith(`${company.issuePrefix}-`))).toBe(true);

    const policyIssue = issueRows.find(
      (issue) => issue.title === "Approve the Task → Approval → Execute operating policy",
    );
    expect(policyIssue).toMatchObject({
      priority: "high",
      assigneeAgentId: ceo?.id,
    });

    const approvalRows = await db.select().from(approvals).where(eq(approvals.companyId, company.id));
    expect(approvalRows).toHaveLength(1);
    expect(approvalRows[0]).toMatchObject({
      type: "request_board_approval",
      status: "pending",
      requestedByAgentId: ceo?.id,
    });
    expect(approvalRows[0]?.payload).toMatchObject({
      title: "Approve solo company Task → Approval → Execute policy",
      riskClass: "governance",
      task: "Adopt the default approval gate for governed AI employee actions.",
    });
    expect(approvalRows[0]?.payload.governedActions).toContain("production_deploy");

    const issueApprovalRows = await db
      .select()
      .from(issueApprovals)
      .where(eq(issueApprovals.companyId, company.id));
    expect(issueApprovalRows).toHaveLength(1);
    expect(issueApprovalRows[0]).toMatchObject({
      issueId: policyIssue?.id,
      approvalId: approvalRows[0]?.id,
      linkedByAgentId: ceo?.id,
    });

    const activityRows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.companyId, company.id));
    expect(activityRows.some((row) => row.action === "company.template_bootstrapped")).toBe(true);
    expect(activityRows.find((row) => row.action === "company.template_bootstrapped")?.details).toMatchObject({
      templateId: "solo_software_company",
      agentCount: 5,
      projectCount: 1,
      issueCount: 6,
      approvalCount: 1,
    });
    expect(activityRows.some((row) => row.action === "approval.created")).toBe(true);

    const soloDashboard = await soloCompanyDashboardService(db).summary(company.id);
    expect(soloDashboard.company.id).toBe(company.id);
    expect(soloDashboard.metrics).toMatchObject({
      activeAgents: 5,
      pendingApprovals: 1,
      blockedIssues: 0,
      monthlySpendCents: 0,
    });
    expect(soloDashboard.employees.map((agent) => agent.name)).toEqual([
      "CEO",
      "PM",
      "Tech Lead",
      "Engineer",
      "QA/Ops",
    ]);
    expect(soloDashboard.startupIssues).toHaveLength(6);
    expect(soloDashboard.attention.approvals[0]?.payload).toMatchObject({
      title: "Approve solo company Task → Approval → Execute policy",
    });
    expect(soloDashboard.ceoRecommendations.map((recommendation) => recommendation.id)).toContain("review-approvals");
  });
});
