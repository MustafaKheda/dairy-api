import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateJson, validateQuery } from "../middleware/validate.js";
import { createPayment, listPayments } from "../services/payments.js";
import type { AppEnv } from "../types.js";
import { ok } from "../utils/http.js";
import { paymentCreateSchema, paymentQuerySchema } from "../validators/payments.js";

export const paymentRoutes = new Hono<AppEnv>();

paymentRoutes.use("*", requireAuth);

paymentRoutes.get("/", validateQuery(paymentQuerySchema), async (c) => {
  const authUser = c.get("user");
  const query = c.get("validatedQuery") as typeof paymentQuerySchema._output;

  if (authUser.role === "CUSTOMER") {
    if (!authUser.customerId) {
      return ok(c, []);
    }

    return ok(c, await listPayments({ ...query, customerId: authUser.customerId }));
  }

  return ok(c, await listPayments(query));
});

paymentRoutes.post("/", requireRole("ADMIN"), validateJson(paymentCreateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof paymentCreateSchema._output;
  return ok(c, await createPayment(body), 201);
});
