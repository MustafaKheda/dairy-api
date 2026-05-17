import type { Context } from "hono";

export function ok(c: Context, data: unknown, status = 200) {
  return c.json({ success: true, data }, status as never);
}

export function fail(c: Context, error: string, status = 400, details?: unknown) {
  return c.json({ success: false, error, details }, status as never);
}
