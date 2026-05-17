import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateJson, validateParams, validateQuery } from "../middleware/validate.js";
import { createProduct, deactivateProduct, listProducts, updateProduct } from "../services/products.js";
import type { AppEnv } from "../types.js";
import { ok } from "../utils/http.js";
import { idParamSchema } from "../validators/common.js";
import { productCreateSchema, productQuerySchema, productUpdateSchema } from "../validators/products.js";

export const productRoutes = new Hono<AppEnv>();

productRoutes.use("*", requireAuth);

productRoutes.get("/", validateQuery(productQuerySchema), async (c) => {
  const query = c.get("validatedQuery") as typeof productQuerySchema._output;
  return ok(c, await listProducts(query));
});

productRoutes.post("/", requireRole("ADMIN"), validateJson(productCreateSchema), async (c) => {
  const body = c.get("validatedBody") as typeof productCreateSchema._output;
  return ok(c, await createProduct(body), 201);
});

productRoutes.put(
  "/:id",
  requireRole("ADMIN"),
  validateParams(idParamSchema),
  validateJson(productUpdateSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as typeof idParamSchema._output;
    const body = c.get("validatedBody") as typeof productUpdateSchema._output;
    return ok(c, await updateProduct(id, body));
  },
);

productRoutes.delete("/:id", requireRole("ADMIN"), validateParams(idParamSchema), async (c) => {
  const { id } = c.get("validatedParams") as typeof idParamSchema._output;
  return ok(c, await deactivateProduct(id));
});
