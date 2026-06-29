import type { Db } from "@paperclipai/db";
import {
  COMPANY_TEMPLATES,
  type CompanyTemplateId,
} from "@paperclipai/shared";
import { agentService } from "./agents.js";
import { goalService } from "./goals.js";
import { issueService } from "./issues.js";
import { projectService } from "./projects.js";
import { logActivity } from "./activity-log.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { approvalService } from "./approvals.js";
import { issueApprovalService } from "./issue-approvals.js";

interface CompanyTemplateActor {
  actorType: "user" | "agent" | "system" | "plugin";
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
}

interface BootstrapCompanyTemplateOptions {
  actor?: CompanyTemplateActor;
}

export interface BootstrapCompanyTemplateResult {
  templateId: CompanyTemplateId;
  agentIdsByTemplateKey: Record<string, string>;
  projectIdsByTemplateKey: Record<string, string>;
  issueIds: string[];
  goalId: string | null;
}

const SYSTEM_ACTOR: CompanyTemplateActor = {
  actorType: "system",
  actorId: "system",
};

export function companyTemplateService(db: Db) {
  const agents = agentService(db);
  const goals = goalService(db);
  const projects = projectService(db);
  const issues = issueService(db);
  const instructions = agentInstructionsService();
  const approvals = approvalService(db);
  const issueApprovals = issueApprovalService(db);

  return {
    bootstrap: async (
      companyId: string,
      templateId: CompanyTemplateId,
      options: BootstrapCompanyTemplateOptions = {},
    ): Promise<BootstrapCompanyTemplateResult> => {
      const template = COMPANY_TEMPLATES[templateId];
      const actor = options.actor ?? SYSTEM_ACTOR;

      if (template.id === "blank") {
        return {
          templateId,
          agentIdsByTemplateKey: {},
          projectIdsByTemplateKey: {},
          issueIds: [],
          goalId: null,
        };
      }

      const rootGoal = await goals.create(companyId, {
        title: template.label,
        description: template.description,
        level: "company",
        status: "active",
        parentId: null,
      });

      const agentIdsByTemplateKey: Record<string, string> = {};
      for (const employee of template.employees) {
        const reportsTo = employee.reportsToKey
          ? agentIdsByTemplateKey[employee.reportsToKey] ?? null
          : null;
        const created = await agents.create(companyId, {
          name: employee.name,
          role: employee.role,
          title: employee.title,
          reportsTo,
          capabilities: employee.capabilities,
          adapterType: employee.adapterType,
          adapterConfig: {
            promptTemplate: employee.promptTemplate,
          },
          runtimeConfig: employee.runtimeConfig ?? {},
          permissions: employee.permissions,
          metadata: {
            ...(employee.metadata ?? {}),
            companyTemplateId: template.id,
          },
        });

        const materialized = await instructions.materializeManagedBundle(
          created,
          employee.instructionsBundle.files,
          {
            entryFile: employee.instructionsBundle.entryFile,
            replaceExisting: true,
            clearLegacyPromptTemplate: true,
          },
        );
        const nextAdapterConfig = { ...materialized.adapterConfig };
        delete nextAdapterConfig.promptTemplate;
        delete nextAdapterConfig.bootstrapPromptTemplate;
        const updated = await agents.update(created.id, { adapterConfig: nextAdapterConfig });
        agentIdsByTemplateKey[employee.key] = updated?.id ?? created.id;
      }

      const projectIdsByTemplateKey: Record<string, string> = {};
      for (const projectTemplate of template.defaultProjects) {
        const created = await projects.create(companyId, {
          name: projectTemplate.name,
          description: projectTemplate.description ?? null,
          status: "planned",
          goalId: rootGoal.id,
        });
        projectIdsByTemplateKey[projectTemplate.key] = created.id;
      }

      const issueIds: string[] = [];
      const issueIdsByTitle: Record<string, string> = {};
      for (const issueTemplate of template.defaultIssues) {
        const assigneeAgentId = issueTemplate.assigneeEmployeeKey
          ? agentIdsByTemplateKey[issueTemplate.assigneeEmployeeKey] ?? null
          : null;
        const projectId = issueTemplate.projectKey
          ? projectIdsByTemplateKey[issueTemplate.projectKey] ?? null
          : null;
        const created = await issues.create(companyId, {
          title: issueTemplate.title,
          description: issueTemplate.description,
          status: "todo",
          priority: issueTemplate.priority ?? "medium",
          assigneeAgentId,
          projectId,
          goalId: rootGoal.id,
          originKind: "company_template",
          originId: template.id,
          originFingerprint: issueTemplate.title,
          createdByAgentId: null,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        });
        issueIds.push(created.id);
        issueIdsByTitle[issueTemplate.title] = created.id;
      }

      for (const approvalTemplate of template.defaultApprovals ?? []) {
        const requestedByAgentId = approvalTemplate.requestedByEmployeeKey
          ? agentIdsByTemplateKey[approvalTemplate.requestedByEmployeeKey] ?? null
          : null;
        const linkedIssueId = approvalTemplate.issueTitle
          ? issueIdsByTitle[approvalTemplate.issueTitle] ?? null
          : null;
        const created = await approvals.create(companyId, {
          type: approvalTemplate.type,
          requestedByAgentId,
          requestedByUserId: null,
          status: "pending",
          payload: approvalTemplate.payload,
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: new Date(),
        });

        if (linkedIssueId) {
          await issueApprovals.link(linkedIssueId, created.id, {
            agentId: requestedByAgentId,
            userId: null,
          });
        }

        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId ?? null,
          runId: actor.runId ?? null,
          action: "approval.created",
          entityType: "approval",
          entityId: created.id,
          details: {
            type: created.type,
            source: "company_template",
            templateId: template.id,
            issueIds: linkedIssueId ? [linkedIssueId] : [],
          },
        });
      }

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId ?? null,
        runId: actor.runId ?? null,
        action: "company.template_bootstrapped",
        entityType: "company",
        entityId: companyId,
        details: {
          templateId: template.id,
          agentCount: Object.keys(agentIdsByTemplateKey).length,
          projectCount: Object.keys(projectIdsByTemplateKey).length,
          issueCount: issueIds.length,
          approvalCount: template.defaultApprovals?.length ?? 0,
          goalId: rootGoal.id,
        },
      });

      return {
        templateId,
        agentIdsByTemplateKey,
        projectIdsByTemplateKey,
        issueIds,
        goalId: rootGoal.id,
      };
    },
  };
}
