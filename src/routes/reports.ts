import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import {
  getCustomerLedgerReport,
  getCustomerSummaryReport,
  getDailySalesReport,
  getDashboardReport,
  getMonthlySalesReport,
} from "../services/reports";
import type { AppEnv } from "../types";
import { ok } from "../utils/http";
import {
  customerLedgerQuerySchema,
  customerSummaryQuerySchema,
  dailySalesQuerySchema,
  dashboardQuerySchema,
  monthlySalesQuerySchema,
} from "../validators/reports";

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.use("*", requireAuth);

reportRoutes.get("/dashboard", requireRole("ADMIN"), validateQuery(dashboardQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof dashboardQuerySchema._output;
  return ok(c, await getDashboardReport(query));
});

reportRoutes.get("/daily-sales", requireRole("ADMIN"), validateQuery(dailySalesQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof dailySalesQuerySchema._output;
  return ok(c, await getDailySalesReport(query));
});

reportRoutes.get("/monthly-sales", requireRole("ADMIN"), validateQuery(monthlySalesQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof monthlySalesQuerySchema._output;
  return ok(c, await getMonthlySalesReport(query));
});

reportRoutes.get("/customer-summary", requireRole("ADMIN"), validateQuery(customerSummaryQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof customerSummaryQuerySchema._output;
  return ok(c, await getCustomerSummaryReport(query));
});

reportRoutes.get("/customer-ledger", validateQuery(customerLedgerQuerySchema), async (c) => {
  const authUser = c.get("user");
  const query = c.get("validatedQuery") as typeof customerLedgerQuerySchema._output;
  return ok(c, await getCustomerLedgerReport(query, authUser));
});
