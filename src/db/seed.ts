import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { products, users } from "../schema";

const defaultProducts = [
  { name: "Milk", price: 60, unit: "LITER" as const },
  { name: "Curd", price: 80, unit: "KG" as const },
  { name: "Paneer", price: 350, unit: "KG" as const },
  { name: "Ghee", price: 650, unit: "LITER" as const },
  { name: "Buttermilk", price: 40, unit: "LITER" as const },
];

async function seed() {
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "9999999999";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "password123";

  const [existingAdmin] = await db.select().from(users).where(eq(users.phone, adminPhone)).limit(1);

  if (!existingAdmin) {
    const password = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      name: adminName,
      phone: adminPhone,
      password,
      role: "ADMIN",
    });
    console.log(`Created admin user: ${adminPhone}`);
  } else {
    console.log(`Admin user already exists: ${adminPhone}`);
  }

  for (const product of defaultProducts) {
    const [existingProduct] = await db.select().from(products).where(eq(products.name, product.name)).limit(1);

    if (!existingProduct) {
      await db.insert(products).values(product);
      console.log(`Created product: ${product.name}`);
    }
  }
}

seed()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
