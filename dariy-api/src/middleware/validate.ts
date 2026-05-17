import { createMiddleware } from "hono/factory";
import type { z } from "zod";
import type { AppEnv } from "../types";

function validationError(error: z.ZodError) {
  return {
    formErrors: error.flatten().formErrors,
    fieldErrors: error.flatten().fieldErrors,
  };
}

export function validateJson<T extends z.ZodTypeAny>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const payload = await c.req.json().catch(() => undefined);
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return c.json(
        { success: false, error: "Validation failed", details: validationError(parsed.error) },
        400,
      );
    }

    c.set("validatedBody", parsed.data);
    await next();
  });
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const parsed = schema.safeParse(c.req.query());

    if (!parsed.success) {
      return c.json(
        { success: false, error: "Validation failed", details: validationError(parsed.error) },
        400,
      );
    }

    c.set("validatedQuery", parsed.data);
    await next();
  });
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const parsed = schema.safeParse(c.req.param());

    if (!parsed.success) {
      return c.json(
        { success: false, error: "Validation failed", details: validationError(parsed.error) },
        400,
      );
    }

    c.set("validatedParams", parsed.data);
    await next();
  });
}
