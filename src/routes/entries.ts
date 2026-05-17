import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateJson, validateParams, validateQuery } from "../middleware/validate";
import { createEntry, deleteEntry, listEntries, updateEntry } from "../services/entries";
import type { AppEnv } from "../types";
import { ok } from "../utils/http";
import { idParamSchema } from "../validators/common";
import { entryCreateSchema, entryQuerySchema, entryUpdateSchema } from "../validators/entries";

export const entryRoutes = new Hono<AppEnv>();

entryRoutes.use("*", requireAuth);

entryRoutes.get("/", validateQuery(entryQuerySchema), async (c) => {
  const authUser = c.get("user");
  const query = c.get("validatedQuery") as typeof entryQuerySchema._output;

  if (authUser.role === "CUSTOMER") {
    if (!authUser.customerId) {
      return ok(c, []);
    }

    return ok(c, await listEntries({ ...query, customerId: authUser.customerId }));
  }

  return ok(c, await listEntries(query));
});

entryRoutes.post("/", requireRole("ADMIN"), validateJson(entryCreateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof entryCreateSchema._output;
  return ok(c, await createEntry(body), 201);
});

entryRoutes.put(
  "/:id",
  requireRole("ADMIN"),
  validateParams(idParamSchema),
  validateJson(entryUpdateSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as typeof idParamSchema._output;
    const body = c.get("validatedBody") as typeof entryUpdateSchema._output;
    return ok(c, await updateEntry(id, body));
  },
);

entryRoutes.delete("/:id", requireRole("ADMIN"), validateParams(idParamSchema), async (c) => {
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  return ok(c, await deleteEntry(id));
});
