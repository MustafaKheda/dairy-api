import { client } from "./client";

async function hasColumn(table: "daily_entries" | "invoice_items", column: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function ensureDailyEntryUnitColumn() {
  if (await hasColumn("daily_entries", "unit")) {
    return;
  }

  await client.execute("ALTER TABLE daily_entries ADD COLUMN unit TEXT NOT NULL DEFAULT 'LITER'");
  await client.execute(`
    UPDATE daily_entries
    SET unit = coalesce(
      (SELECT products.unit FROM products WHERE products.id = daily_entries.product_id),
      unit
    )
  `);
}

async function ensureInvoiceItemUnitColumn() {
  if (await hasColumn("invoice_items", "unit")) {
    return;
  }

  await client.execute("ALTER TABLE invoice_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'LITER'");
  await client.execute(`
    UPDATE invoice_items
    SET unit = coalesce(
      (SELECT products.unit FROM products WHERE products.id = invoice_items.product_id),
      unit
    )
  `);
}

export async function ensureDatabaseSchema() {
  await ensureDailyEntryUnitColumn();
  await ensureInvoiceItemUnitColumn();
}
