import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateJson, validateParams, validateQuery } from "../middleware/validate.js";
import { generateInvoice, getInvoiceById, getInvoicePdf, listInvoices, previewInvoice, voidInvoice } from "../services/invoices.js";
import type { AppEnv } from "../types.js";
import { ok } from "../utils/http.js";
import { idParamSchema } from "../validators/common.js";
import { invoiceGenerateSchema, invoiceQuerySchema } from "../validators/invoices.js";

export const invoiceRoutes = new Hono<AppEnv>();

invoiceRoutes.use("*", requireAuth);

invoiceRoutes.get("/", validateQuery(invoiceQuerySchema), async (c) => {
  const authUser = c.get("user");
  const query = c.get("validatedQuery") as typeof invoiceQuerySchema._output;

  if (authUser.role === "CUSTOMER") {
    if (!authUser.customerId) {
      return ok(c, []);
    }

    return ok(c, await listInvoices({ ...query, customerId: authUser.customerId }));
  }

  return ok(c, await listInvoices(query));
});

invoiceRoutes.post("/preview", requireRole("ADMIN"), validateJson(invoiceGenerateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof invoiceGenerateSchema._output;
  return ok(c, await previewInvoice(body));
});

invoiceRoutes.post("/generate", requireRole("ADMIN"), validateJson(invoiceGenerateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof invoiceGenerateSchema._output;
  return ok(c, await generateInvoice(body), 201);
});

invoiceRoutes.post("/:id/void", requireRole("ADMIN"), validateParams(idParamSchema), async (c) => {
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  return ok(c, await voidInvoice(id));
});

invoiceRoutes.get("/:id/pdf", validateParams(idParamSchema), async (c) => {
  const authUser = c.get("user");
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  const invoicePdf = await getInvoicePdf(id, authUser);

  return new Response(invoicePdf.pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoicePdf.filename}"`,
    },
  });
});

invoiceRoutes.get("/:id", validateParams(idParamSchema), async (c) => {
  const authUser = c.get("user");
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  return ok(c, await getInvoiceById(id, authUser));
});
