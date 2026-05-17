import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateJson, validateParams, validateQuery } from "../middleware/validate";
import {
  createCustomer,
  deactivateCustomer,
  listCustomers,
  updateCustomer,
  updateCustomerPassword,
  updateOwnCustomerLocation,
} from "../services/customers";
import type { AppEnv } from "../types";
import { ok } from "../utils/http";
import { idParamSchema } from "../validators/common";
import {
  customerCreateSchema,
  customerLocationSchema,
  customerPasswordUpdateSchema,
  customerQuerySchema,
  customerUpdateSchema,
} from "../validators/customers";

export const customerRoutes = new Hono<AppEnv>();

customerRoutes.use("*", requireAuth);

customerRoutes.get("/", requireRole("ADMIN"), validateQuery(customerQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof customerQuerySchema._output;
  return ok(c, await listCustomers(query));
});

customerRoutes.post("/", requireRole("ADMIN"), validateJson(customerCreateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof customerCreateSchema._output;
  return ok(c, await createCustomer(body), 201);
});

customerRoutes.put("/me/location", requireRole("CUSTOMER"), validateJson(customerLocationSchema), async (c) => {
  const authUser = c.get("user");
  const body = c.get("validatedBody") as typeof customerLocationSchema._output;
  return ok(c, await updateOwnCustomerLocation(authUser.customerId, body));
});

customerRoutes.put(
  "/:id",
  requireRole("ADMIN"),
  validateParams(idParamSchema),
  validateJson(customerUpdateSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as typeof idParamSchema._output;
    const body = c.get("validatedBody") as typeof customerUpdateSchema._output;
    return ok(c, await updateCustomer(id, body));
  },
);

customerRoutes.put(
  "/:id/password",
  requireRole("ADMIN"),
  validateParams(idParamSchema),
  validateJson(customerPasswordUpdateSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as typeof idParamSchema._output;
    const body = c.get("validatedBody") as typeof customerPasswordUpdateSchema._output;
    return ok(c, await updateCustomerPassword(id, body));
  },
);

customerRoutes.delete("/:id", requireRole("ADMIN"), validateParams(idParamSchema), async (c) => {
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  return ok(c, await deactivateCustomer(id));
});
