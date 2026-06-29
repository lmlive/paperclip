import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  activityLog,
  agents,
  companies,
  createDb,
  goals,
  issues,
  projects,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyService } from "../services/companies.js";
import { companyTemplateService } from "../services/company-templates.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company template tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyTemplateService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-template-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("bootstraps the solo software company org, project, issues, and activity", async () => {
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
    expect(result.issueIds).toHaveLength(5);

    const agentRows = await db.select().from(agents).where(eq(agents.companyId, company.id));
    expect(agentRows).toHaveLength(5);
    expect(agentRows.every((agent) => agent.adapterType === "hermes_local")).toBe(true);

    const byName = new Map(agentRows.map((agent) => [agent.name, agent]));
    const ceo = byName.get("CEO");
    expect(ceo).toMatchObject({ role: "ceo", reportsTo: null });
    expect(byName.get("PM")).toMatchObject({ role: "pm", reportsTo: ceo?.id });
    expect(byName.get("Tech Lead")).toMatchObject({ role: "cto", reportsTo: ceo?.id });
    expect(byName.get("Engineer")).toMatchObject({ role: "engineer", reportsTo: byName.get("Tech Lead")?.id });
    expect(byName.get("QA/Ops")).toMatchObject({ role: "qa", reportsTo: byName.get("Tech Lead")?.id });

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
    expect(issueRows).toHaveLength(5);
    expect(issueRows.every((issue) => issue.projectId === projectRows[0]?.id)).toBe(true);
    expect(issueRows.every((issue) => issue.goalId === goalRows[0]?.id)).toBe(true);
    expect(issueRows.every((issue) => issue.originKind === "company_template")).toBe(true);
    expect(issueRows.every((issue) => issue.identifier?.startsWith(`${company.issuePrefix}-`))).toBe(true);

    const activityRows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.companyId, company.id));
    expect(activityRows.some((row) => row.action === "company.template_bootstrapped")).toBe(true);
    expect(activityRows.find((row) => row.action === "company.template_bootstrapped")?.details).toMatchObject({
      templateId: "solo_software_company",
      agentCount: 5,
      projectCount: 1,
      issueCount: 5,
    });
  });
});
