import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { companySkillsApi } from "../api/companySkills";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import type { AdapterEnvironmentTestResult, AgentPermissions } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";
import {
  AgentConfigForm,
  type CreateConfigValues,
} from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { getUIAdapter } from "../adapters";
import { isValidAdapterType } from "../adapters/metadata";
import { buildNewAgentHirePayload } from "../lib/new-agent-hire-payload";
import { createValuesForAdapterType } from "../lib/new-agent-create-values";
import {
  findSoloPresetReportsToAgentId,
  resolveSoloNewAgentPreset,
} from "../lib/solo-new-agent-presets";
import { buildPermissionsForTrustPreset, getTrustPreset } from "../lib/trust-policy-ui";
import {
  NewAgentCompanySkillsSection,
  NewAgentIdentityFields,
  NewAgentPageHeader,
  NewAgentPresetNotice,
  NewAgentRoleFields,
  NewAgentTrustPresetPanel,
} from "../components/NewAgentFormSections";
import { NewAgentFooter } from "../components/NewAgentFooter";
import { isValidOpenCodeModelId } from "@paperclipai/adapter-opencode-local";

export function NewAgent() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");
  const presetId = searchParams.get("preset");
  const soloPreset = useMemo(() => resolveSoloNewAgentPreset(presetId), [presetId]);
  const companyId = selectedCompanyId ?? "";

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [appliedSoloPresetId, setAppliedSoloPresetId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<CreateConfigValues>(defaultCreateValues);
  const [permissions, setPermissions] = useState<Partial<AgentPermissions>>(
    buildPermissionsForTrustPreset(null, "standard"),
  );
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([]);
  const [roleOpen, setRoleOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testAgentAction, setTestAgentAction] = useState<(() => void) | null>(null);
  const [testAgentState, setTestAgentState] = useState({ disabled: true, pending: false });
  const [testAgentFeedback, setTestAgentFeedback] = useState<{
    errorMessage: string | null;
    result: AdapterEnvironmentTestResult | null;
  }>({
    errorMessage: null,
    result: null,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!selectedCompanyId,
  });

  const { data: companySkills } = useQuery({
    queryKey: queryKeys.companySkills.list(companyId),
    queryFn: () => companySkillsApi.list(companyId),
    enabled: Boolean(selectedCompanyId),
  });

  const lowTrustSelected = getTrustPreset(permissions) === "low_trust_review";

  const { data: boundaryProjects, isLoading: boundaryProjectsLoading } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.projects.list(selectedCompanyId) : ["projects", "__low-trust-disabled"],
    queryFn: () => projectsApi.list(companyId),
    enabled: Boolean(selectedCompanyId && lowTrustSelected),
  });

  const { data: boundaryIssues, isLoading: boundaryIssuesLoading } = useQuery({
    queryKey: selectedCompanyId
      ? [...queryKeys.issues.list(selectedCompanyId), "low-trust-boundary-candidates"]
      : ["issues", "__low-trust-disabled"],
    queryFn: () => issuesApi.list(companyId, { limit: 100, sortField: "updated", sortDir: "desc" }),
    enabled: Boolean(selectedCompanyId && lowTrustSelected),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: "New Agent" },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (isFirstAgent) {
      if (!name) setName("CEO");
      if (!title) setTitle("CEO");
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requested = presetAdapterType;
    if (!requested) return;
    if (!isValidAdapterType(requested)) return;
    setConfigValues((prev) => {
      if (prev.adapterType === requested) return prev;
      return createValuesForAdapterType(requested);
    });
  }, [presetAdapterType]);

  useEffect(() => {
    if (!soloPreset || appliedSoloPresetId === soloPreset.id) return;
    setName(soloPreset.name);
    setTitle(soloPreset.title);
    setRole(soloPreset.role);
    setReportsTo(null);
    setPermissions(soloPreset.permissions);
    setConfigValues({
      ...createValuesForAdapterType(soloPreset.adapterType),
      heartbeatEnabled: true,
      intervalSec: 300,
    });
    setAppliedSoloPresetId(soloPreset.id);
  }, [appliedSoloPresetId, soloPreset]);

  const soloPresetManagerId = useMemo(
    () => findSoloPresetReportsToAgentId(agents ?? [], soloPreset),
    [agents, soloPreset],
  );

  useEffect(() => {
    if (!soloPresetManagerId) return;
    setReportsTo((current) => current ?? soloPresetManagerId);
  }, [soloPresetManagerId]);

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!selectedCompanyId) throw new Error("Select a company to create an agent");
      return agentsApi.hire(selectedCompanyId, data);
    },
    onSuccess: (result) => {
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId) });
      }
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Failed to create agent");
    },
  });

  function buildAdapterConfig() {
    const adapter = getUIAdapter(configValues.adapterType);
    return adapter.buildAdapterConfig(configValues);
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);
    if (configValues.adapterType === "opencode_local") {
      if (!isValidOpenCodeModelId(configValues.model)) {
        setFormError("OpenCode requires an explicit model in provider/model format.");
        return;
      }
    }
    createAgent.mutate(
      buildNewAgentHirePayload({
        name,
        effectiveRole,
        title,
        reportsTo,
        selectedSkillKeys,
        configValues,
        adapterConfig: buildAdapterConfig(),
        permissions,
        capabilities: soloPreset?.capabilities,
        metadata: soloPreset?.metadata,
        instructionsBundle: soloPreset?.instructionsBundle,
      }),
    );
  }

  const availableSkills = (companySkills ?? []).filter((skill) => !skill.key.startsWith("paperclipai/paperclip/"));

  function toggleSkill(key: string, checked: boolean) {
    setSelectedSkillKeys((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((value) => value !== key);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <NewAgentPageHeader />

      {soloPreset ? (
        <NewAgentPresetNotice preset={soloPreset} />
      ) : null}

      <div className="border border-border">
        <NewAgentIdentityFields
          name={name}
          title={title}
          onNameChange={setName}
          onTitleChange={setTitle}
        />

        <NewAgentRoleFields
          agents={agents ?? []}
          reportsTo={reportsTo}
          role={role}
          roleOpen={roleOpen}
          isFirstAgent={isFirstAgent}
          onReportsToChange={setReportsTo}
          onRoleChange={setRole}
          onRoleOpenChange={setRoleOpen}
        />

        <NewAgentTrustPresetPanel
          permissions={permissions}
          onChange={setPermissions}
          disabled={createAgent.isPending}
          companyId={selectedCompanyId}
          projectCandidates={boundaryProjects ?? []}
          issueCandidates={boundaryIssues ?? []}
          candidatesLoading={boundaryProjectsLoading || boundaryIssuesLoading}
        />

        <AgentConfigForm
          mode="create"
          values={configValues}
          onChange={(patch) => setConfigValues((prev) => ({ ...prev, ...patch }))}
          onTestActionChange={(fn) => setTestAgentAction(() => fn)}
          onTestActionStateChange={setTestAgentState}
          onTestFeedbackChange={setTestAgentFeedback}
        />

        <NewAgentCompanySkillsSection
          availableSkills={availableSkills}
          selectedSkillKeys={selectedSkillKeys}
          onToggleSkill={toggleSkill}
        />

        <NewAgentFooter
          createPending={createAgent.isPending}
          formError={formError}
          isFirstAgent={isFirstAgent}
          name={name}
          testAction={testAgentAction}
          testAgentFeedback={testAgentFeedback}
          testAgentState={testAgentState}
          onCancel={() => navigate("/agents")}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
