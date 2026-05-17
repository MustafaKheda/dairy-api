import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client";
import { issueToken, toAuthUser } from "../middleware/auth";
import { customers, users, type User } from "../schema";
import type { changePasswordSchema, loginSchema } from "../validators/auth";

async function authResponse(user: User) {
  const authUser = toAuthUser(user);

  if (user.role !== "CUSTOMER") {
    return { user: authUser };
  }

  if (!user.customerId) {
    throw new HTTPException(403, { message: "Customer account is not linked to a customer profile" });
  }

  const [customer] = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);

  if (!customer || customer.status !== "ACTIVE") {
    throw new HTTPException(403, { message: "Customer account is inactive" });
  }

  return {
    user: authUser,
    customer,
  };
}

export async function login(input: typeof loginSchema._output) {
  const [user] = await db.select().from(users).where(eq(users.phone, input.phone)).limit(1);

  if (!user) {
    throw new HTTPException(401, { message: "Invalid phone or password" });
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);

  if (!passwordMatches) {
    throw new HTTPException(401, { message: "Invalid phone or password" });
  }

  const token = await issueToken(user);
  const data = await authResponse(user);

  return {
    token,
    ...data,
  };
}

export async function getCurrentUser(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new HTTPException(401, { message: "User not found" });
  }

  return authResponse(user);
}

export async function changePassword(userId: number, input: typeof changePasswordSchema._output) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new HTTPException(401, { message: "User not found" });
  }

  const passwordMatches = await bcrypt.compare(input.currentPassword, user.password);

  if (!passwordMatches) {
    throw new HTTPException(401, { message: "Current password is incorrect" });
  }

  await db
    .update(users)
    .set({
      password: await bcrypt.hash(input.newPassword, 12),
    })
    .where(eq(users.id, user.id));

  return { message: "Password changed successfully" };
}
