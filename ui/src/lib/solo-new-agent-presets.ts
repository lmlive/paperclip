import {
  COMPANY_TEMPLATES,
  type Agent,
  type AgentPermissions,
} from "@paperclipai/shared";

export const SOLO_NEW_AGENT_PRESET_IDS = [
  "solo_ceo",
  "solo_pm",
  "solo_tech_lead",
  "solo_engineer",
  "solo_qa_ops",
] as const;

export type SoloNewAgentPresetId = (typeof SOLO_NEW_AGENT_PRESET_IDS)[number];

type SoloEmployeeTemplateKey = "ceo" | "pm" | "tech_lead" | "engineer" | "qa_ops";

type SoloAgentLike = Pick<Agent, "id" | "metadata">;

export interface SoloNewAgentPreset {
  readonly id: SoloNewAgentPresetId;
  readonly employeeKey: SoloEmployeeTemplateKey;
  readonly name: string;
  readonly title: string;
  readonly role: string;
  readonly reportsToEmployeeKey: SoloEmployeeTemplateKey | null;
  readonly adapterType: string;
  readonly capabilities: string;
  readonly instructionsBundle: {
    readonly entryFile: "AGENTS.md";
    readonly files: Record<string, string>;
  };
  readonly permissions: Partial<AgentPermissions>;
  readonly metadata: Record<string, unknown>;
}

const soloPresetEmployeeKeys: Record<SoloNewAgentPresetId, SoloEmployeeTemplateKey> = {
  solo_ceo: "ceo",
  solo_pm: "pm",
  solo_tech_lead: "tech_lead",
  solo_engineer: "engineer",
  solo_qa_ops: "qa_ops",
};

function isSoloNewAgentPresetId(value: string | null): value is SoloNewAgentPresetId {
  return value !== null && Object.prototype.hasOwnProperty.call(soloPresetEmployeeKeys, value);
}

export function resolveSoloNewAgentPreset(value: string | null): SoloNewAgentPreset | null {
  if (!isSoloNewAgentPresetId(value)) return null;
  const employeeKey = soloPresetEmployeeKeys[value];
  const employee = COMPANY_TEMPLATES.solo_software_company.employees.find((item) => item.key === employeeKey);
  if (!employee) return null;

  const reportsToEmployeeKey = employee.reportsToKey && isSoloEmployeeTemplateKey(employee.reportsToKey)
    ? employee.reportsToKey
    : null;

  return {
    id: value,
    employeeKey,
    name: employee.name,
    title: employee.title,
    role: employee.role,
    reportsToEmployeeKey,
    adapterType: employee.adapterType,
    capabilities: employee.capabilities,
    instructionsBundle: employee.instructionsBundle,
    permissions: employee.permissions,
    metadata: {
      ...(employee.metadata ?? {}),
      companyTemplateId: "solo_software_company",
    },
  };
}

export function findSoloPresetReportsToAgentId(
  agents: readonly SoloAgentLike[],
  preset: SoloNewAgentPreset | null,
): string | null {
  if (!preset?.reportsToEmployeeKey) return null;
  const manager = agents.find((agent) => agent.metadata?.employeeTemplateId === preset.reportsToEmployeeKey);
  return manager?.id ?? null;
}

function isSoloEmployeeTemplateKey(value: string): value is SoloEmployeeTemplateKey {
  return ["ceo", "pm", "tech_lead", "engineer", "qa_ops"].includes(value);
}
