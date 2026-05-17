import bcrypt from "bcryptjs";
import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client.js";
import { customers, users, type Customer } from "../schema/index.js";
import type {
  customerCreateSchema,
  customerLocationSchema,
  customerPasswordUpdateSchema,
  customerQuerySchema,
  customerUpdateSchema,
} from "../validators/customers.js";

async function upsertCustomerUser(customer: Customer, password?: string) {
  const [customerUser] = await db.select().from(users).where(eq(users.customerId, customer.id)).limit(1);

  if (customerUser) {
    await db
      .update(users)
      .set({
        name: customer.name,
        phone: customer.phone,
        ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
      })
      .where(eq(users.id, customerUser.id));
    return;
  }

  if (!password) return;

  await db.insert(users).values({
    name: customer.name,
    phone: customer.phone,
    password: await bcrypt.hash(password, 12),
    role: "CUSTOMER",
    customerId: customer.id,
  });
}

export async function listCustomers(query: typeof customerQuerySchema._output) {
  const conditions: SQL[] = [];

  if (query.status) {
    conditions.push(eq(customers.status, query.status));
  } else if (!query.includeInactive) {
    conditions.push(eq(customers.status, "ACTIVE"));
  }

  if (query.search) {
    conditions.push(or(like(customers.name, `%${query.search}%`), like(customers.phone, `%${query.search}%`))!);
  }

  return db
    .select()
    .from(customers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(customers.createdAt));
}

export async function createCustomer(input: typeof customerCreateSchema._output) {
  const { password, ...customerData } = input;
  const [customer] = await db.insert(customers).values(customerData).returning();

  await upsertCustomerUser(customer, password);

  return customer;
}

export async function updateOwnCustomerLocation(customerId: number | null, input: typeof customerLocationSchema._output) {
  if (!customerId) {
    throw new HTTPException(403, { message: "Customer account is not linked to a customer profile" });
  }

  const [customer] = await db.update(customers).set(input).where(eq(customers.id, customerId)).returning();

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  return customer;
}

export async function updateCustomer(id: number, input: typeof customerUpdateSchema._output) {
  const { password, ...customerData } = input;
  const [customer] =
    Object.keys(customerData).length > 0
      ? await db.update(customers).set(customerData).where(eq(customers.id, id)).returning()
      : await db.select().from(customers).where(eq(customers.id, id)).limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  await upsertCustomerUser(customer, password);

  return customer;
}

export async function updateCustomerPassword(id: number, input: typeof customerPasswordUpdateSchema._output) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  await upsertCustomerUser(customer, input.password);

  return { message: "Customer password updated successfully" };
}

export async function deactivateCustomer(id: number) {
  const [customer] = await db.update(customers).set({ status: "INACTIVE" }).where(eq(customers.id, id)).returning();

  if (!customer) {
    throw new HTTPException(404, { message: "Customer not found" });
  }

  return customer;
}
