import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import { db } from "../db/client.js";
import { env } from "../lib/env.js";
import { users, type User } from "../schema/index.js";
import type { AppEnv, AuthUser, UserRole } from "../types.js";

const tokenTtlSeconds = 60 * 60 * 24 * 30;

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    customerId: user.customerId,
  };
}

export async function issueToken(user: User) {
  const now = Math.floor(Date.now() / 1000);

  return sign(
    {
      sub: String(user.id),
      phone: user.phone,
      role: user.role,
      customerId: user.customerId,
      iat: now,
      exp: now + tokenTtlSeconds,
    },
    env.jwtSecret,
  );
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  try {
    const payload = await verify(token, env.jwtSecret, "HS256");
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new HTTPException(401, { message: "Invalid token subject" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    c.set("user", toAuthUser(user));
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
});

export function requireRole(...roles: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");

    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    await next();
  });
}
