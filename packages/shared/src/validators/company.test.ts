import { describe, expect, it } from "vitest";
import { createCompanySchema } from "./company.js";

// Phase 1 one-person-company contract tests.
// These are intentionally schema-level: the server route strips template-only
// fields before inserting into the companies table in a later phase.
describe("company validators", () => {
  it("defaults new companies to the blank template", () => {
    const parsed = createCompanySchema.parse({ name: "Acme AI" });

    expect(parsed.templateId).toBe("blank");
    expect(parsed.operatingMode).toBe("blank");
  });

  it("accepts the solo software company template", () => {
    const parsed = createCompanySchema.parse({
      name: "Solo Dev Co",
      templateId: "solo_software_company",
      operatingMode: "solo_software_company",
    });

    expect(parsed.templateId).toBe("solo_software_company");
    expect(parsed.operatingMode).toBe("solo_software_company");
  });

  it("rejects unknown company templates", () => {
    expect(
      createCompanySchema.safeParse({
        name: "Mystery Co",
        templateId: "unknown_template",
      }).success,
    ).toBe(false);
  });
});
