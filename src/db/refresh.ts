import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { client, db } from "./client.js";
import {
  customers,
  dailyEntries,
  invoiceItems,
  invoices,
  payments,
  products,
  users,
} from "../schema/index.js";

const adminPhone = process.env.SEED_ADMIN_PHONE ?? "9999999999";
const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "password123";

const clearedTableSequences = [
  "customers",
  "products",
  "daily_entries",
  "invoices",
  "invoice_items",
  "payments",
] as const;

async function refresh() {
  await db.transaction(async (tx) => {
    await tx.delete(payments);
    await tx.delete(invoiceItems);
    await tx.delete(invoices);
    await tx.delete(dailyEntries);
    await tx.delete(users).where(eq(users.role, "CUSTOMER"));
    await tx.delete(customers);
    await tx.delete(products);

  });

  for (const table of clearedTableSequences) {
    await client.execute({
      sql: "DELETE FROM sqlite_sequence WHERE name = ?",
      args: [table],
    });
  }

  const [admin] = await db.select().from(users).where(eq(users.role, "ADMIN")).limit(1);

  if (!admin) {
    const password = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      name: adminName,
      phone: adminPhone,
      password,
      role: "ADMIN",
    });
    console.log(`Created admin user: ${adminPhone}`);
  } else {
    console.log(`Kept admin user id=${admin.id} phone=${admin.phone}`);
  }

  console.log("Database refreshed. Only admin credentials remain.");
}

refresh()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
