import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { validateJson } from "../middleware/validate";
import { changePassword, getCurrentUser, login } from "../services/auth";
import type { AppEnv } from "../types";
import { ok } from "../utils/http";
import { changePasswordSchema, loginSchema } from "../validators/auth";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", validateJson(loginSchema), async (c) => {
  const body = c.get("validatedBody") as typeof loginSchema._output;
  return ok(c, await login(body));
});

authRoutes.get("/me", requireAuth, async (c) => {
  const authUser = c.get("user");
  return ok(c, await getCurrentUser(authUser.id));
});

authRoutes.post("/change-password", requireAuth, validateJson(changePasswordSchema), async (c) => {
  const authUser = c.get("user");
  const body = c.get("validatedBody") as typeof changePasswordSchema._output;
  return ok(c, await changePassword(authUser.id, body));
});

authRoutes.post("/logout", requireAuth, (c) => ok(c, { message: "Logged out" }));
