import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    password: text("password").notNull(),
    role: text("role", { enum: ["ADMIN", "CUSTOMER"] }).notNull().default("ADMIN"),
    customerId: integer("customer_id").references(() => customers.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    phoneIdx: uniqueIndex("users_phone_unique").on(table.phone),
  }),
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    locationLabel: text("location_label"),
    googleLocation: text("google_location"),
    googlePlaceId: text("google_place_id"),
    googleFormattedAddress: text("google_formatted_address"),
    googleMapsUrl: text("google_maps_url"),
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    phoneIdx: uniqueIndex("customers_phone_unique").on(table.phone),
    statusIdx: index("customers_status_idx").on(table.status),
  }),
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    price: real("price").notNull(),
    unit: text("unit", { enum: ["LITER", "ML", "KG", "GRAM", "PIECE"] }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    activeIdx: index("products_is_active_idx").on(table.isActive),
  }),
);

export const dailyEntries = sqliteTable(
  "daily_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    unit: text("unit", { enum: ["LITER", "ML", "KG", "GRAM", "PIECE"] }).notNull().default("LITER"),
    quantity: real("quantity").notNull(),
    session: text("session", { enum: ["MORNING", "EVENING"] }).notNull(),
    entryDate: text("entry_date").notNull(),
    price: real("price").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    customerDateIdx: index("daily_entries_customer_date_idx").on(table.customerId, table.entryDate),
    productDateIdx: index("daily_entries_product_date_idx").on(table.productId, table.entryDate),
  }),
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    invoiceNumber: text("invoice_number").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    totalAmount: real("total_amount").notNull(),
    paidAmount: real("paid_amount").notNull().default(0),
    pendingAmount: real("pending_amount").notNull(),
    status: text("status", { enum: ["UNPAID", "PARTIAL", "PAID", "VOID"] }).notNull().default("UNPAID"),
    pdfUrl: text("pdf_url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    invoiceNumberIdx: uniqueIndex("invoices_invoice_number_unique").on(table.invoiceNumber),
    customerDateIdx: index("invoices_customer_date_idx").on(table.customerId, table.startDate, table.endDate),
    statusIdx: index("invoices_status_idx").on(table.status),
  }),
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    unit: text("unit", { enum: ["LITER", "ML", "KG", "GRAM", "PIECE"] }).notNull().default("LITER"),
    quantity: real("quantity").notNull(),
    price: real("price").notNull(),
    amount: real("amount").notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_items_invoice_idx").on(table.invoiceId),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id),
    amount: real("amount").notNull(),
    paymentDate: text("payment_date").notNull(),
    paymentMethod: text("payment_method", { enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] })
      .notNull()
      .default("CASH"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    invoiceIdx: index("payments_invoice_idx").on(table.invoiceId),
    dateIdx: index("payments_date_idx").on(table.paymentDate),
  }),
);

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type DailyEntry = typeof dailyEntries.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
