import {
  SOLO_SOFTWARE_COMPANY_TEMPLATE,
  type CompanyEmployeeTemplate,
} from "@paperclipai/shared";

export type SoloCompanyEmployeeKey = CompanyEmployeeTemplate["key"];

export function listOnePersonCompanyEmployeePresets(): CompanyEmployeeTemplate[] {
  return SOLO_SOFTWARE_COMPANY_TEMPLATE.employees;
}

export function getOnePersonCompanyEmployeePreset(key: SoloCompanyEmployeeKey): CompanyEmployeeTemplate | null {
  return SOLO_SOFTWARE_COMPANY_TEMPLATE.employees.find((employee) => employee.key === key) ?? null;
}

export function getOnePersonCompanyPromptTemplate(key: SoloCompanyEmployeeKey): string | null {
  return getOnePersonCompanyEmployeePreset(key)?.promptTemplate ?? null;
}
