import { and, desc, eq, like, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/client.js";
import { products } from "../schema/index.js";
import type { productCreateSchema, productQuerySchema, productUpdateSchema } from "../validators/products.js";

export async function listProducts(query: typeof productQuerySchema._output) {
  const conditions: SQL[] = [];

  if (!query.includeInactive) conditions.push(eq(products.isActive, true));
  if (query.search) conditions.push(like(products.name, `%${query.search}%`));

  return db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt));
}

export async function createProduct(input: typeof productCreateSchema._output) {
  const [product] = await db.insert(products).values(input).returning();
  return product;
}

export async function updateProduct(id: number, input: typeof productUpdateSchema._output) {
  const [product] = await db.update(products).set(input).where(eq(products.id, id)).returning();

  if (!product) {
    throw new HTTPException(404, { message: "Product not found" });
  }

  return product;
}

export async function deactivateProduct(id: number) {
  const [product] = await db.update(products).set({ isActive: false }).where(eq(products.id, id)).returning();

  if (!product) {
    throw new HTTPException(404, { message: "Product not found" });
  }

  return product;
}
