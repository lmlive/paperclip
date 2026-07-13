import type { DashboardSummary, SoloCompanyDashboardSummary } from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  soloSummary: (companyId: string) => api.get<SoloCompanyDashboardSummary>(`/companies/${companyId}/solo-dashboard`),
};
