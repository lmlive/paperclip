import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { errorHandler } from "../middleware/index.js";

const mockCompanyService = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}));

const mockCompanyTemplateService = vi.hoisted(() => ({
  bootstrap: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
  ensureRoleDefaultGrants: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockCompanyPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewExport: vi.fn(),
  previewImport: vi.fn(),
  importBundle: vi.fn(),
}));

const mockCompanyArtifactsService = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockFeedbackService = vi.hoisted(() => ({
  listFeedbackTraces: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  budgetService: () => mockBudgetService,
  companyArtifactsService: () => mockCompanyArtifactsService,
  companyPortabilityService: () => mockCompanyPortabilityService,
  companyService: () => mockCompanyService,
  companyTemplateService: () => mockCompanyTemplateService,
  feedbackService: () => mockFeedbackService,
  logActivity: mockLogActivity,
}));

function localTrustedBoardActor() {
  return {
    type: "board",
    userId: "local-board",
    source: "local_implicit",
    isInstanceAdmin: true,
    companyIds: [],
    memberships: [],
  };
}

function createCompanyResponse(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-29T00:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Solo Software Co",
    description: null,
    status: "active",
    issuePrefix: "SOL",
    issueCounter: 1,
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    requireBoardApprovalForNewAgents: false,
    feedbackDataSharingEnabled: false,
    brandColor: "#123456",
    logoAssetId: null,
    logoUrl: null,
    attachmentMaxBytes: 25_000_000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = localTrustedBoardActor();
    next();
  });
  app.use("/api/companies", companyRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("company create template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.create.mockResolvedValue(createCompanyResponse());
    mockCompanyTemplateService.bootstrap.mockResolvedValue({
      templateId: "solo_software_company",
      agentIdsByTemplateKey: {},
      projectIdsByTemplateKey: {},
      issueIds: [],
      goalId: null,
    });
  });

  it("strips template-only fields before company insert and bootstraps the selected template", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/companies")
      .send({
        name: "Solo Software Co",
        description: "AI delivery shop",
        templateId: "solo_software_company",
        operatingMode: "solo_software_company",
      });

    expect(res.status).toBe(201);
    expect(mockCompanyService.create).toHaveBeenCalledWith({
      name: "Solo Software Co",
      description: "AI delivery shop",
      budgetMonthlyCents: 0,
    });
    expect(mockCompanyTemplateService.bootstrap).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "solo_software_company",
      {
        actor: expect.objectContaining({
          actorType: "user",
          actorId: "local-board",
        }),
      },
    );
  });

  it("does not bootstrap the blank template", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/companies")
      .send({ name: "Blank Co", templateId: "blank" });

    expect(res.status).toBe(201);
    expect(mockCompanyService.create).toHaveBeenCalledWith({
      name: "Blank Co",
      budgetMonthlyCents: 0,
    });
    expect(mockCompanyTemplateService.bootstrap).not.toHaveBeenCalled();
  });
});
