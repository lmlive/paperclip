import type {
  Agent,
  CompanySkillListItem,
} from "@paperclipai/shared";
import { AGENT_ROLES } from "@paperclipai/shared";
import { Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "../lib/utils";
import { roleLabels } from "./agent-config-primitives";
import { ReportsToPicker } from "./ReportsToPicker";
import { resolveSkillSummaryText } from "../lib/company-skill-summary";
import type { SoloNewAgentPreset } from "../lib/solo-new-agent-presets";
import { TrustPresetSection } from "./TrustPresetSection";
import type { AgentPermissions } from "@paperclipai/shared";

export function NewAgentPageHeader() {
  return (
    <div>
      <h1 className="text-lg font-semibold">New Agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Advanced agent configuration
      </p>
    </div>
  );
}

interface NewAgentIdentityFieldsProps {
  readonly name: string;
  readonly title: string;
  readonly onNameChange: (value: string) => void;
  readonly onTitleChange: (value: string) => void;
}

export function NewAgentIdentityFields({
  name,
  title,
  onNameChange,
  onTitleChange,
}: NewAgentIdentityFieldsProps) {
  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
          placeholder="Agent name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoFocus
        />
      </div>
      <div className="px-4 pb-2">
        <input
          className="w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          placeholder="Title (e.g. VP of Engineering)"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>
    </>
  );
}

interface NewAgentRoleFieldsProps {
  readonly agents: Agent[];
  readonly reportsTo: string | null;
  readonly role: string;
  readonly roleOpen: boolean;
  readonly isFirstAgent: boolean;
  readonly onReportsToChange: (value: string | null) => void;
  readonly onRoleChange: (value: string) => void;
  readonly onRoleOpenChange: (value: boolean) => void;
}

export function NewAgentRoleFields({
  agents,
  reportsTo,
  role,
  roleOpen,
  isFirstAgent,
  onReportsToChange,
  onRoleChange,
  onRoleOpenChange,
}: NewAgentRoleFieldsProps) {
  const effectiveRole = isFirstAgent ? "ceo" : role;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2">
      <Popover open={roleOpen} onOpenChange={onRoleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent/50",
              isFirstAgent && "cursor-not-allowed opacity-60",
            )}
            disabled={isFirstAgent}
          >
            <Shield className="h-3 w-3 text-muted-foreground" />
            {roleLabels[effectiveRole] ?? effectiveRole}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start">
          {AGENT_ROLES.map((agentRole) => (
            <button
              key={agentRole}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                agentRole === role && "bg-accent",
              )}
              onClick={() => {
                onRoleChange(agentRole);
                onRoleOpenChange(false);
              }}
            >
              {roleLabels[agentRole] ?? agentRole}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <ReportsToPicker
        agents={agents}
        value={reportsTo}
        onChange={onReportsToChange}
        disabled={isFirstAgent}
      />
    </div>
  );
}

interface NewAgentPresetNoticeProps {
  readonly preset: SoloNewAgentPreset;
}

export function NewAgentPresetNotice({ preset }: NewAgentPresetNoticeProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-card px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-4 w-4 text-primary" />
        <div className="min-w-0">
          <p className="font-medium">Solo company preset: {preset.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hermes is selected, heartbeat is enabled, and managed AGENTS.md instructions will be attached on hire.
          </p>
        </div>
      </div>
    </div>
  );
}

interface NewAgentCompanySkillsSectionProps {
  readonly availableSkills: readonly CompanySkillListItem[];
  readonly selectedSkillKeys: readonly string[];
  readonly onToggleSkill: (key: string, checked: boolean) => void;
}

export function NewAgentCompanySkillsSection({
  availableSkills,
  selectedSkillKeys,
  onToggleSkill,
}: NewAgentCompanySkillsSectionProps) {
  return (
    <div className="border-t border-border px-4 py-4">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Company skills</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional skills from the company library. Built-in Paperclip runtime skills are added automatically.
          </p>
        </div>
        {availableSkills.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No optional company skills installed yet.
          </p>
        ) : (
          <div className="space-y-3">
            {availableSkills.map((skill) => {
              const inputId = `skill-${skill.id}`;
              const checked = selectedSkillKeys.includes(skill.key);
              const summaryText = resolveSkillSummaryText(skill, { fallbackKey: true });
              return (
                <div key={skill.id} className="flex items-start gap-3">
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(next) => onToggleSkill(skill.key, next === true)}
                  />
                  <label htmlFor={inputId} className="grid gap-1 leading-none">
                    <span className="text-sm font-medium">{skill.name}</span>
                    {summaryText ? <span className="text-xs text-muted-foreground">{summaryText}</span> : null}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface NewAgentTrustPresetPanelProps {
  readonly permissions: Partial<AgentPermissions>;
  readonly disabled: boolean;
  readonly companyId: string | null | undefined;
  readonly projectCandidates: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly issueCandidates: readonly {
    readonly id: string;
    readonly identifier?: string | null;
    readonly title: string;
  }[];
  readonly candidatesLoading: boolean;
  readonly onChange: (permissions: Partial<AgentPermissions>) => void;
}

export function NewAgentTrustPresetPanel({
  permissions,
  disabled,
  companyId,
  projectCandidates,
  issueCandidates,
  candidatesLoading,
  onChange,
}: NewAgentTrustPresetPanelProps) {
  return (
    <div className="border-t border-border px-4 py-4">
      <TrustPresetSection
        permissions={permissions}
        onChange={onChange}
        disabled={disabled}
        companyId={companyId}
        projectCandidates={projectCandidates.map((project) => ({
          id: project.id,
          label: project.name,
        }))}
        issueCandidates={issueCandidates.map((issue) => ({
          id: issue.id,
          label: `${issue.identifier ?? issue.id.slice(0, 8)} · ${issue.title}`,
        }))}
        candidatesLoading={candidatesLoading}
      />
    </div>
  );
}
