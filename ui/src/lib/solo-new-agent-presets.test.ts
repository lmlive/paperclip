// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  findSoloPresetReportsToAgentId,
  resolveSoloNewAgentPreset,
} from "./solo-new-agent-presets";

describe("resolveSoloNewAgentPreset", () => {
  it("resolves the solo engineer preset from the shared company template", () => {
    const preset = resolveSoloNewAgentPreset("solo_engineer");

    expect(preset).toMatchObject({
      id: "solo_engineer",
      employeeKey: "engineer",
      name: "Engineer",
      title: "Full-stack Engineer",
      role: "engineer",
      adapterType: "hermes_local",
      reportsToEmployeeKey: "tech_lead",
      metadata: {
        companyTemplateId: "solo_software_company",
        employeeTemplateId: "engineer",
      },
    });
    expect(preset?.instructionsBundle.files["AGENTS.md"]).toContain("Full-stack Engineer");
  });

  it("returns null for unknown preset ids", () => {
    expect(resolveSoloNewAgentPreset("solo_sales")).toBeNull();
    expect(resolveSoloNewAgentPreset(null)).toBeNull();
  });
});

describe("findSoloPresetReportsToAgentId", () => {
  it("finds the manager by employee template metadata", () => {
    const preset = resolveSoloNewAgentPreset("solo_engineer");

    expect(
      findSoloPresetReportsToAgentId([
        { id: "ceo-agent", metadata: { employeeTemplateId: "ceo" } },
        { id: "lead-agent", metadata: { employeeTemplateId: "tech_lead" } },
      ], preset),
    ).toBe("lead-agent");
  });
});
