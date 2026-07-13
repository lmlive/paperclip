import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { soloCompanyDashboardService } from "../services/solo-company-dashboard.js";
import { assertCompanyAccess } from "./authz.js";

export function soloCompanyDashboardRoutes(db: Db) {
  const router = Router();
  const svc = soloCompanyDashboardService(db);

  router.get("/companies/:companyId/solo-dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.summary(companyId));
  });

  return router;
}
