import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client.js";
import { customers, dailyEntries, products } from "../schema/index.js";
import type { entryCreateSchema, entryQuerySchema, entryUpdateSchema } from "../validators/entries.js";

type EntryQuery = typeof entryQuerySchema._output & {
  customerId?: number;
};

export async function listEntries(query: EntryQuery) {
  const conditions: SQL[] = [];

  if (query.customerId) conditions.push(eq(dailyEntries.customerId, query.customerId));
  if (query.productId) conditions.push(eq(dailyEntries.productId, query.productId));
  if (query.session) conditions.push(eq(dailyEntries.session, query.session));
  if (query.startDate) conditions.push(gte(dailyEntries.entryDate, query.startDate));
  if (query.endDate) conditions.push(lte(dailyEntries.entryDate, query.endDate));

  const rows = await db
    .select({
      id: dailyEntries.id,
      customerId: dailyEntries.customerId,
      customerName: customers.name,
      productId: dailyEntries.productId,
      productName: products.name,
      unit: dailyEntries.unit,
      quantity: dailyEntries.quantity,
      session: dailyEntries.session,
      entryDate: dailyEntries.entryDate,
      price: dailyEntries.price,
      amount: dailyEntries.quantity,
      createdAt: dailyEntries.createdAt,
    })
    .from(dailyEntries)
    .innerJoin(customers, eq(customers.id, dailyEntries.customerId))
    .innerJoin(products, eq(products.id, dailyEntries.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id));

  return rows.map((row) => ({
    ...row,
    amount: Number((row.quantity * row.price).toFixed(2)),
  }));
}

async function requireActiveCustomer(customerId: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);

  if (!customer || customer.status !== "ACTIVE") {
    throw new HTTPException(404, { message: "Active customer not found" });
  }

  return customer;
}

async function requireActiveProduct(productId: number) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  if (!product || !product.isActive) {
    throw new HTTPException(404, { message: "Active product not found" });
  }

  return product;
}

export async function createEntry(input: typeof entryCreateSchema._output) {
  await requireActiveCustomer(input.customerId);
  const product = await requireActiveProduct(input.productId);

  const [entry] = await db
    .insert(dailyEntries)
    .values({
      ...input,
      unit: input.unit ?? product.unit,
      price: input.price ?? product.price,
    })
    .returning();

  return entry;
}

export async function updateEntry(id: number, input: typeof entryUpdateSchema._output) {
  const update = { ...input };

  if (input.customerId) {
    await requireActiveCustomer(input.customerId);
  }

  if (input.productId) {
    const product = await requireActiveProduct(input.productId);

    if (input.unit === undefined) {
      update.unit = product.unit;
    }

    if (input.price === undefined) {
      update.price = product.price;
    }
  }

  const [entry] = await db.update(dailyEntries).set(update).where(eq(dailyEntries.id, id)).returning();

  if (!entry) {
    throw new HTTPException(404, { message: "Entry not found" });
  }

  return entry;
}

export async function deleteEntry(id: number) {
  const [entry] = await db.delete(dailyEntries).where(eq(dailyEntries.id, id)).returning();

  if (!entry) {
    throw new HTTPException(404, { message: "Entry not found" });
  }

  return entry;
}
